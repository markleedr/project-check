import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ColumnRole, FileKind, ROLE_LABELS, allowedRoles, headersToReview, mappingWarnings, suggestMapping } from '@/lib/columns';
import { washRecords, washedToCsv, type WashResult, type WashedAd } from '@/lib/wash';
import { buildFigures, suggestedActions } from '@/lib/aggregate';
import { fallbackCommentary } from '@/lib/commentary-fallback';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { spotCheckMessage } from '@/lib/spot';
import { AD_PLATFORMS, type AdPlatformId } from '@/lib/platforms';
import { recordsFromFile } from '@/lib/spreadsheet';
import { collectSpendRows, mappedSpendTotal, spendOverlapMessages } from '@/lib/spend-input';
import {
  ADS_GUIDE,
  FILE_ACCEPT,
  FILE_FORMAT_HINT,
  MARKETING_GUIDE,
  PLATFORM_EXPORT_HINT,
  SALES_GUIDE,
  SPEND_GUIDE,
  sameDevelopmentName,
  type UploadGuide,
} from '@/lib/upload-guide';

interface FileState {
  name: string;
  headers: string[];
  records: Record<string, string>[];
  mapping: Record<string, ColumnRole>;
  wash?: WashResult;
}

type PlatformFiles = Partial<Record<AdPlatformId, FileState>>;
type PlatformAmounts = Partial<Record<AdPlatformId, string>>;

const STEPS = [
  { id: 'name', label: 'Development' },
  { id: 'people', label: 'Enquiries & sales' },
  { id: 'spend', label: 'Spend' },
  { id: 'ads', label: 'Ads' },
  { id: 'review', label: 'Review' },
] as const;

export default function NewCheck() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const existingProjectId = params.get('project');

  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(existingProjectId);
  const [marketing, setMarketing] = useState<FileState | null>(null);
  const [sales, setSales] = useState<FileState | null>(null);
  const [spendFiles, setSpendFiles] = useState<PlatformFiles>({});
  const [spendAmounts, setSpendAmounts] = useState<PlatformAmounts>({});
  const [unifiedSpend, setUnifiedSpend] = useState('');
  const [showPlatformSpend, setShowPlatformSpend] = useState(false);
  const [adFiles, setAdFiles] = useState<PlatformFiles>({});
  const [spot, setSpot] = useState('');
  const [spotMsg, setSpotMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllMap, setShowAllMap] = useState<Record<string, boolean>>({});

  const washedPeople = [marketing?.wash, sales?.wash].filter(Boolean) as WashResult[];
  const ready = Boolean(marketing?.wash && sales?.wash);

  const overlap = useMemo(
    () =>
      spendOverlapMessages({
        unified: unifiedSpend,
        amounts: spendAmounts,
        hasFile: Object.fromEntries(AD_PLATFORMS.map((p) => [p.id, Boolean(spendFiles[p.id])])) as Partial<
          Record<AdPlatformId, boolean>
        >,
      }),
    [unifiedSpend, spendAmounts, spendFiles],
  );

  const spendPreview = useMemo(
    () =>
      collectSpendRows({
        unified: unifiedSpend,
        amounts: spendAmounts,
        fromFiles: Object.fromEntries(
          AD_PLATFORMS.map((p) => {
            const f = spendFiles[p.id];
            if (!f) return [p.id, []];
            if (f.wash?.spend?.length) return [p.id, f.wash.spend];
            const amount = mappedSpendTotal(f.records, f.mapping);
            return [p.id, amount ? [{ campaign: null, source: p.id, amount, date: null }] : []];
          }),
        ),
      }).reduce((s, r) => s + r.amount, 0),
    [unifiedSpend, spendAmounts, spendFiles],
  );

  useEffect(() => {
    if (!existingProjectId) return;
    supabase
      .from('projects')
      .select('id, name')
      .eq('id', existingProjectId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setProjectId(data.id);
        setProjectName(data.name);
      });
  }, [existingProjectId]);

  useEffect(() => {
    if (step !== 4 || !marketing || !sales || marketing.wash || busy) return;
    void washPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wash when arriving on review with unwashed files
  }, [step, marketing, sales]);

  async function parseUpload(kind: FileKind, file: File): Promise<FileState> {
    const { headers, records } = await recordsFromFile(file, kind);
    return { name: file.name, headers, records, mapping: suggestMapping(headers, kind) };
  }

  async function washPeople() {
    if (!marketing) {
      toast.error('Add the marketing enquiry list first.');
      return;
    }
    if (!sales) {
      toast.error('Add the sales file first.');
      return;
    }
    setBusy(true);
    try {
      const m = await washRecords('marketing', marketing.records, marketing.mapping, marketing.headers);
      const s = await washRecords('sales', sales.records, sales.mapping, sales.headers);
      setMarketing({ ...marketing, wash: m });
      setSales({ ...sales, wash: s });
      const nextSpend: PlatformFiles = {};
      for (const p of AD_PLATFORMS) {
        const f = spendFiles[p.id];
        if (!f) continue;
        nextSpend[p.id] = {
          ...f,
          wash: await washRecords('spend', f.records, f.mapping, f.headers, { defaultPlatform: p.id }),
        };
      }
      setSpendFiles((prev) => ({ ...prev, ...nextSpend }));
      const nextAds: PlatformFiles = {};
      for (const p of AD_PLATFORMS) {
        const f = adFiles[p.id];
        if (!f) continue;
        nextAds[p.id] = {
          ...f,
          wash: await washRecords('ads', f.records, f.mapping, f.headers, { defaultPlatform: p.id }),
        };
      }
      setAdFiles((prev) => ({ ...prev, ...nextAds }));
      toast.success('Names stripped on this computer. Nothing has been sent yet.');
    } finally {
      setBusy(false);
    }
  }

  function collectedAds(): WashedAd[] {
    return AD_PLATFORMS.flatMap((p) => adFiles[p.id]?.wash?.ads ?? []);
  }

  async function checkSpot() {
    setSpotMsg(await spotCheckMessage(spot, marketing?.wash?.enquiries ?? [], sales?.wash?.sales ?? []));
  }

  function downloadWashed() {
    const packs: WashResult[] = [
      ...washedPeople,
      ...AD_PLATFORMS.map((p) => spendFiles[p.id]?.wash).filter(Boolean) as WashResult[],
      ...AD_PLATFORMS.map((p) => adFiles[p.id]?.wash).filter(Boolean) as WashResult[],
    ];
    packs.forEach((w, i) => {
      const csv = washedToCsv(w);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `washed-${w.kind}-${i + 1}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  async function findOrCreateProject(name: string): Promise<string> {
    if (projectId) return projectId;
    const { data: existing, error: listErr } = await supabase.from('projects').select('id, name').eq('user_id', user!.id);
    if (listErr) throw listErr;
    const match = existing?.find((p) => sameDevelopmentName(p.name, name));
    if (match) {
      setProjectId(match.id);
      return match.id;
    }
    const { data: project, error: pErr } = await supabase
      .from('projects')
      .insert({ user_id: user!.id, name })
      .select('id')
      .single();
    if (pErr) throw pErr;
    setProjectId(project.id);
    return project.id;
  }

  async function submit() {
    if (!user || !ready || !projectName.trim()) {
      toast.error('Name the development and strip names from marketing plus sales first.');
      return;
    }
    if (overlap.length > 0) {
      toast.error(overlap[0]);
      return;
    }
    setBusy(true);
    try {
      const name = projectName.trim();
      const pid = await findOrCreateProject(name);
      const spend = collectSpendRows({
        unified: unifiedSpend,
        amounts: spendAmounts,
        fromFiles: Object.fromEntries(AD_PLATFORMS.map((p) => [p.id, spendFiles[p.id]?.wash?.spend ?? []])),
      });
      const ads = collectedAds();
      const figures = buildFigures({
        enquiries: marketing?.wash?.enquiries ?? [],
        sales: sales?.wash?.sales ?? [],
        spend,
        ads,
        skippedNoJoinKey: {
          marketing: marketing?.wash?.skippedNoJoinKey ?? 0,
          sales: sales?.wash?.skippedNoJoinKey ?? 0,
        },
      });
      const actions = suggestedActions(figures);
      let commentary = fallbackCommentary(name, figures);
      const { data: ai, error: aiErr } = await supabase.functions.invoke('generate-commentary', {
        body: { projectName: name, figures, actions },
      });
      if (!aiErr && ai?.commentary) commentary = ai.commentary;

      const { data: check, error: cErr } = await supabase
        .from('checks')
        .insert({
          project_id: pid,
          user_id: user.id,
          status: 'ready',
          datasets: {
            enquiries: marketing?.wash?.enquiries ?? [],
            sales: sales?.wash?.sales ?? [],
            spend,
            ads,
          },
          figures,
          commentary,
          project_name: name,
          dropped_columns: {
            marketing: marketing?.wash?.droppedColumns ?? [],
            sales: sales?.wash?.droppedColumns ?? [],
          },
        })
        .select('id')
        .single();
      if (cErr) throw cErr;
      toast.success('Report ready. Raw lists never left this browser.');
      navigate(`/checks/${check.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the check');
    } finally {
      setBusy(false);
    }
  }

  function canContinue(): boolean {
    if (step === 0) return projectName.trim().length > 0;
    if (step === 1) return Boolean(marketing && sales);
    if (step === 2) return overlap.length === 0;
    return true;
  }

  function continueLabel(): string {
    if (step === STEPS.length - 1) return 'Build the report';
    if (step === STEPS.length - 2) return 'Strip names and review';
    return 'Continue';
  }

  async function onPrimary() {
    if (step < STEPS.length - 1) {
      if (!canContinue()) {
        if (step === 1) toast.error('Add both the marketing list and the sales file.');
        if (step === 2 && overlap[0]) toast.error(overlap[0]);
        return;
      }
      setStep((s) => s + 1);
      return;
    }
    await submit();
  }

  return (
    <Layout>
      <h1 className="text-2xl font-semibold">New check</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Four short steps. We strip names on this computer, then build a one-page report on where the next dollar should
        go.
      </p>

      <ol className="mt-6 flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={
              i === step
                ? 'rounded-full bg-primary px-3 py-1 text-primary-foreground'
                : i < step
                  ? 'rounded-full border border-primary px-3 py-1'
                  : 'rounded-full border px-3 py-1 text-muted-foreground'
            }
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-8">
        {step === 0 && (
          <div className="max-w-md space-y-2">
            <Label htmlFor="project">Which development is this?</Label>
            <Input
              id="project"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                if (!existingProjectId) setProjectId(null);
              }}
              placeholder="Solana Agnes Water"
            />
            <p className="text-sm text-muted-foreground">
              Use the project name sales already uses. A second check on the same name stays on that development.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-6 md:grid-cols-2">
            <FileCard
              guide={MARKETING_GUIDE}
              kind="marketing"
              mapKey="marketing"
              state={marketing}
              showAll={Boolean(showAllMap.marketing)}
              onShowAll={(v) => setShowAllMap((prev) => ({ ...prev, marketing: v }))}
              onPick={async (file) => setMarketing(await parseUpload('marketing', file))}
              onMap={(header, role) =>
                setMarketing((prev) =>
                  prev ? { ...prev, mapping: { ...prev.mapping, [header]: role }, wash: undefined } : prev,
                )
              }
            />
            <FileCard
              guide={SALES_GUIDE}
              kind="sales"
              mapKey="sales"
              state={sales}
              showAll={Boolean(showAllMap.sales)}
              onShowAll={(v) => setShowAllMap((prev) => ({ ...prev, sales: v }))}
              onPick={async (file) => setSales(await parseUpload('sales', file))}
              onMap={(header, role) =>
                setSales((prev) =>
                  prev ? { ...prev, mapping: { ...prev.mapping, [header]: role }, wash: undefined } : prev,
                )
              }
            />
          </div>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <GuideBlock guide={SPEND_GUIDE} />
            <p className="text-sm">Spend we will use: ${Math.round(spendPreview).toLocaleString()}</p>
            {overlap.map((m) => (
              <p key={m} className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {m}
              </p>
            ))}
            <div className="max-w-xs space-y-2">
              <Label>One total for this period (optional)</Label>
              <Input
                inputMode="decimal"
                value={unifiedSpend}
                onChange={(e) => setUnifiedSpend(e.target.value)}
                placeholder="e.g. 25000"
              />
            </div>
            <button
              type="button"
              className="text-sm underline text-muted-foreground"
              onClick={() => setShowPlatformSpend((v) => !v)}
            >
              {showPlatformSpend ? 'Hide Ads Manager files' : 'I have Ads Manager exports instead'}
            </button>
            {showPlatformSpend && (
              <div className="grid gap-4 md:grid-cols-2">
                {AD_PLATFORMS.map((p) => (
                  <div key={p.id} className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="font-medium">{p.label}</div>
                    <p className="text-xs text-muted-foreground">{PLATFORM_EXPORT_HINT[p.id]} Campaign-level is enough here.</p>
                    <div className="space-y-1">
                      <Label className="text-xs">Platform total (optional)</Label>
                      <Input
                        inputMode="decimal"
                        value={spendAmounts[p.id] ?? ''}
                        onChange={(e) => setSpendAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="Leave blank if you are uploading a file"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Campaign-level export</Label>
                      <Input
                        type="file"
                        accept={FILE_ACCEPT}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const parsed = await parseUpload('spend', file);
                          setSpendFiles((prev) => ({ ...prev, [p.id]: parsed }));
                        }}
                      />
                      <p className="text-xs text-muted-foreground">{FILE_FORMAT_HINT}</p>
                    </div>
                    {spendFiles[p.id] && (
                      <ColumnMap
                        kind="spend"
                        mapKey={`spend-${p.id}`}
                        state={spendFiles[p.id]!}
                        showAll={Boolean(showAllMap[`spend-${p.id}`])}
                        onShowAll={(v) => setShowAllMap((prev) => ({ ...prev, [`spend-${p.id}`]: v }))}
                        onMap={(header, role) =>
                          setSpendFiles((prev) => ({
                            ...prev,
                            [p.id]: {
                              ...prev[p.id]!,
                              mapping: { ...prev[p.id]!.mapping, [header]: role },
                              wash: undefined,
                            },
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <GuideBlock guide={ADS_GUIDE} />
            <p className="text-sm text-muted-foreground">Skip this step if you only want channel and sales numbers.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {AD_PLATFORMS.map((p) => (
                <div key={p.id} className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="font-medium">{p.label} ads</div>
                  <p className="text-xs text-muted-foreground">{PLATFORM_EXPORT_HINT[p.id]}</p>
                  <Input
                    type="file"
                    accept={FILE_ACCEPT}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const parsed = await parseUpload('ads', file);
                      setAdFiles((prev) => ({ ...prev, [p.id]: parsed }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{FILE_FORMAT_HINT}</p>
                  {adFiles[p.id] && (
                    <ColumnMap
                      kind="ads"
                      mapKey={`ads-${p.id}`}
                      state={adFiles[p.id]!}
                      showAll={Boolean(showAllMap[`ads-${p.id}`])}
                      onShowAll={(v) => setShowAllMap((prev) => ({ ...prev, [`ads-${p.id}`]: v }))}
                      onMap={(header, role) =>
                        setAdFiles((prev) => ({
                          ...prev,
                          [p.id]: {
                            ...prev[p.id]!,
                            mapping: { ...prev[p.id]!.mapping, [header]: role },
                            wash: undefined,
                          },
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {step === 4 && (
          <div className="space-y-8">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Check the mapped columns below, then build the report. Names, emails, phones and street addresses stay on
              this computer.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={washPeople} disabled={busy || !marketing || !sales} variant="secondary">
                Strip names on this computer
              </Button>
            </div>

            {washedPeople.length > 0 && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-destructive/30 bg-card p-4">
                    <h2 className="font-medium">Never leaving this computer</h2>
                    <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                      {Array.from(new Set(washedPeople.flatMap((w) => w.droppedColumns))).map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-primary/40 bg-card p-4">
                    <h2 className="font-medium">What we will store</h2>
                    <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                      {Array.from(new Set(washedPeople.flatMap((w) => w.keptColumns))).map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                      <li>Match codes (not the phone or email itself)</li>
                    </ul>
                  </div>
                </div>

                {washedPeople.map((w) => (
                  <SampleTable key={w.kind} result={w} />
                ))}

                <div className="max-w-md space-y-2">
                  <Label>Spot check someone you already know</Label>
                  <p className="text-xs text-muted-foreground">
                    Type a phone or email from your original file. If we cannot find them, the match will be wrong.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={spot}
                      onChange={(e) => setSpot(e.target.value)}
                      placeholder="0412 345 678 or name@email.com"
                    />
                    <Button type="button" variant="secondary" onClick={checkSpot}>
                      Check
                    </Button>
                  </div>
                  {spotMsg && <p className="text-sm">{spotMsg}</p>}
                </div>

                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer">Advanced: download the stripped file</summary>
                  <Button variant="outline" className="mt-3" onClick={downloadWashed}>
                    Download stripped CSV
                  </Button>
                </details>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            Back
          </Button>
        )}
        <Button onClick={() => void onPrimary()} disabled={busy || !canContinue() || (step === 4 && !ready)}>
          {busy ? 'Working…' : continueLabel()}
        </Button>
      </div>
    </Layout>
  );
}

function GuideBlock({ guide }: { guide: UploadGuide }) {
  return (
    <div className="max-w-2xl space-y-1 text-sm">
      <h2 className="text-lg font-semibold">{guide.title}</h2>
      <p>
        <span className="font-medium">You get: </span>
        {guide.youGet}
      </p>
      <p>
        <span className="font-medium">How to get the file: </span>
        {guide.howTo}
      </p>
      {guide.skip && (
        <p>
          <span className="font-medium">If you skip: </span>
          {guide.skip}
        </p>
      )}
    </div>
  );
}

function FileCard({
  guide,
  kind,
  mapKey,
  state,
  showAll,
  onShowAll,
  onPick,
  onMap,
}: {
  guide: UploadGuide;
  kind: FileKind;
  mapKey: string;
  state: FileState | null;
  showAll: boolean;
  onShowAll: (value: boolean) => void;
  onPick: (file: File) => void | Promise<void>;
  onMap: (header: string, role: ColumnRole) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <GuideBlock guide={guide} />
      <Input type="file" accept={FILE_ACCEPT} onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
      <p className="text-xs text-muted-foreground">{FILE_FORMAT_HINT}</p>
      {state && (
        <ColumnMap
          kind={kind}
          mapKey={mapKey}
          state={state}
          showAll={showAll}
          onShowAll={onShowAll}
          onMap={onMap}
        />
      )}
    </div>
  );
}

function ColumnMap({
  kind,
  mapKey,
  state,
  showAll,
  onShowAll,
  onMap,
}: {
  kind: FileKind;
  mapKey: string;
  state: FileState;
  showAll: boolean;
  onShowAll: (value: boolean) => void;
  onMap: (header: string, role: ColumnRole) => void;
}) {
  const visible = headersToReview(state.headers, state.mapping, kind, showAll);
  const warnings = mappingWarnings(state.mapping, kind);
  const hidden = state.headers.length - visible.length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {state.name} · {state.records.length} rows · we mapped the columns that matter
      </p>
      {warnings.map((w) => (
        <p key={w} className="text-xs text-destructive">
          {w}
        </p>
      ))}
      {visible.map((h) => (
        <div key={h} className="flex items-center justify-between gap-2">
          <span className="truncate text-xs">{h}</span>
          <Select value={state.mapping[h]} onValueChange={(v) => onMap(h, v as ColumnRole)}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedRoles(kind).map((role) => (
                <SelectItem key={`${mapKey}-${role}`} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      {(hidden > 0 || showAll) && (
        <button type="button" className="text-xs underline text-muted-foreground" onClick={() => onShowAll(!showAll)}>
          {showAll ? 'Show only columns that matter' : `Show all ${state.headers.length} columns`}
        </button>
      )}
    </div>
  );
}

function SampleTable({ result }: { result: WashResult }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium capitalize">
        {result.kind} sample · {result.rowCount} rows kept
        {result.skippedNoJoinKey ? ` · ${result.skippedNoJoinKey} without a phone or email` : ''}
      </h3>
      <div className="overflow-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {result.sample[0] && Object.keys(result.sample[0]).map((h) => <TableHead key={h}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.sample.map((row, i) => (
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
  );
}
