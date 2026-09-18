import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { decodeSpreadsheetText, maybeSkipLinkedInPreamble, readCsv, rowsToObjects } from '@/lib/csv';
import { ColumnRole, FileKind, ROLE_LABELS, allowedRoles, suggestMapping } from '@/lib/columns';
import { hashPhoneDigits } from '@/lib/hash';
import { phoneJoinDigits } from '@/lib/phone';
import { washRecords, washedToCsv, type WashResult } from '@/lib/wash';
import { buildFigures, suggestedActions } from '@/lib/aggregate';
import { fallbackCommentary } from '@/lib/commentary-fallback';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const KINDS: { kind: FileKind; title: string; blurb: string }[] = [
  { kind: 'marketing', title: 'Marketing enquiries', blurb: 'Every digital enquiry, with UTM and dates.' },
  { kind: 'sales', title: 'Sales file', blurb: 'Everyone sales touched, including contracts. Offline lives here.' },
  { kind: 'spend', title: 'Spend', blurb: 'Channel or campaign spend. Separate from the ads export.' },
  { kind: 'ads', title: 'Ads export', blurb: 'Meta or LinkedIn export for creative commentary.' },
];

interface FileState {
  name: string;
  headers: string[];
  records: Record<string, string>[];
  mapping: Record<string, ColumnRole>;
  wash?: WashResult;
}

export default function NewCheck() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [files, setFiles] = useState<Partial<Record<FileKind, FileState>>>({});
  const [spot, setSpot] = useState('');
  const [spotMsg, setSpotMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const washed = useMemo(() => Object.values(files).map((f) => f?.wash).filter(Boolean) as WashResult[], [files]);
  const ready = Boolean(files.marketing?.wash && files.sales?.wash);

  async function onFile(kind: FileKind, file: File | null) {
    if (!file) return;
    const text = decodeSpreadsheetText(await file.arrayBuffer());
    let rows = readCsv(text);
    if (kind === 'ads') rows = maybeSkipLinkedInPreamble(rows);
    const { headers, records } = rowsToObjects(rows);
    const mapping = suggestMapping(headers, kind);
    setFiles((prev) => ({ ...prev, [kind]: { name: file.name, headers, records, mapping } }));
  }

  async function washKind(kind: FileKind) {
    const f = files[kind];
    if (!f) return;
    const wash = await washRecords(kind, f.records, f.mapping, f.headers);
    setFiles((prev) => ({ ...prev, [kind]: { ...f, wash } }));
  }

  async function washAll() {
    setBusy(true);
    try {
      for (const k of KINDS) {
        if (files[k.kind]) await washKind(k.kind);
      }
      toast.success('Washed on this computer. Nothing has been sent yet.');
    } finally {
      setBusy(false);
    }
  }

  async function checkSpot() {
    const digits = phoneJoinDigits(spot);
    if (!digits) {
      setSpotMsg('That does not look like a phone number.');
      return;
    }
    const token = await hashPhoneDigits(digits);
    const marketingHit = files.marketing?.wash?.enquiries?.some((e) => e.token === token);
    const salesHit = files.sales?.wash?.sales?.some((e) => e.token === token);
    if (marketingHit && salesHit) setSpotMsg('This number matches a marketing row and a sales row. They will join.');
    else if (marketingHit) setSpotMsg('This number matches a marketing enquiry only.');
    else if (salesHit) setSpotMsg('This number matches a sales row only (offline or unmatched).');
    else setSpotMsg('No match in the washed files.');
  }

  function downloadWashed() {
    washed.forEach((w) => {
      const csv = washedToCsv(w);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `washed-${w.kind}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  async function submit() {
    if (!user || !ready || !projectName.trim()) {
      toast.error('Name the development and wash marketing plus sales first.');
      return;
    }
    setBusy(true);
    try {
      const { data: project, error: pErr } = await supabase
        .from('projects')
        .insert({ user_id: user.id, name: projectName.trim() })
        .select('id')
        .single();
      if (pErr) throw pErr;

      const figures = buildFigures({
        enquiries: files.marketing?.wash?.enquiries ?? [],
        sales: files.sales?.wash?.sales ?? [],
        spend: files.spend?.wash?.spend ?? [],
        ads: files.ads?.wash?.ads ?? [],
        skippedNoJoinKey: {
          marketing: files.marketing?.wash?.skippedNoJoinKey ?? 0,
          sales: files.sales?.wash?.skippedNoJoinKey ?? 0,
        },
      });
      const actions = suggestedActions(figures);
      let commentary = fallbackCommentary(projectName.trim(), figures);
      const { data: ai, error: aiErr } = await supabase.functions.invoke('generate-commentary', {
        body: { projectName: projectName.trim(), figures, actions },
      });
      if (!aiErr && ai?.commentary) commentary = ai.commentary;

      const datasets = {
        enquiries: files.marketing?.wash?.enquiries ?? [],
        sales: files.sales?.wash?.sales ?? [],
        spend: files.spend?.wash?.spend ?? [],
        ads: files.ads?.wash?.ads ?? [],
      };
      const dropped = Object.fromEntries(
        KINDS.map((k) => [k.kind, files[k.kind]?.wash?.droppedColumns ?? []]),
      );

      const { data: check, error: cErr } = await supabase
        .from('checks')
        .insert({
          project_id: project.id,
          user_id: user.id,
          status: 'ready',
          datasets,
          figures,
          commentary,
          project_name: projectName.trim(),
          dropped_columns: dropped,
        })
        .select('id')
        .single();
      if (cErr) throw cErr;
      toast.success('Washed file stored. Raw lists never left this browser.');
      navigate(`/checks/${check.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the check');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <h1 className="text-2xl font-semibold">New check</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Map columns, wash on this computer, inspect the tokenised file, then send only that. Names, emails, phones and
        street addresses never upload.
      </p>

      <div className="mt-8 max-w-md space-y-2">
        <Label htmlFor="project">Development name</Label>
        <Input id="project" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Solana Agnes Water" />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {KINDS.map((k) => (
          <div key={k.kind} className="rounded-xl border bg-card p-4 space-y-3">
            <div>
              <div className="font-medium">{k.title}</div>
              <p className="text-xs text-muted-foreground">{k.blurb}</p>
            </div>
            <Input type="file" accept=".csv,.tsv,.txt" onChange={(e) => onFile(k.kind, e.target.files?.[0] ?? null)} />
            {files[k.kind] && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{files[k.kind]!.name} · {files[k.kind]!.records.length} rows</p>
                {files[k.kind]!.headers.map((h) => (
                  <div key={h} className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs">{h}</span>
                    <Select
                      value={files[k.kind]!.mapping[h]}
                      onValueChange={(v) =>
                        setFiles((prev) => ({
                          ...prev,
                          [k.kind]: {
                            ...prev[k.kind]!,
                            mapping: { ...prev[k.kind]!.mapping, [h]: v as ColumnRole },
                            wash: undefined,
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-56 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedRoles(k.kind).map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={washAll} disabled={busy || !files.marketing}>
          Wash on this computer
        </Button>
        <Button variant="outline" onClick={downloadWashed} disabled={washed.length === 0}>
          Download washed CSV
        </Button>
      </div>

      {washed.length > 0 && (
        <div className="mt-10 space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-destructive/30 bg-card p-4">
              <h2 className="font-medium">Never leaving this computer</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {Array.from(new Set(washed.flatMap((w) => w.droppedColumns))).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-primary/40 bg-card p-4">
              <h2 className="font-medium">What we will store</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {Array.from(new Set(washed.flatMap((w) => w.keptColumns))).map((c) => (
                  <li key={c}>{c}</li>
                ))}
                <li>Join tokens (hashed phone or email)</li>
              </ul>
            </div>
          </div>

          {washed.map((w) => (
            <div key={w.kind}>
              <h3 className="mb-2 text-sm font-medium capitalize">
                {w.kind} sample · {w.rowCount} rows kept
                {w.skippedNoJoinKey ? ` · ${w.skippedNoJoinKey} without a join key` : ''}
              </h3>
              <div className="overflow-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {w.sample[0] &&
                        Object.keys(w.sample[0]).map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {w.sample.map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((v, j) => (
                          <TableCell key={j} className="max-w-[180px] truncate text-xs">
                            {String(v ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}

          <div className="max-w-md space-y-2">
            <Label>Spot check a phone you already know</Label>
            <div className="flex gap-2">
              <Input value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="0412 345 678" />
              <Button type="button" variant="secondary" onClick={checkSpot}>
                Check
              </Button>
            </div>
            {spotMsg && <p className="text-sm">{spotMsg}</p>}
          </div>

          <Button onClick={submit} disabled={busy || !ready || !projectName.trim()}>
            Send washed files and build PDF
          </Button>
        </div>
      )}
    </Layout>
  );
}
