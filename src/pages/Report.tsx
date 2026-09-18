import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import type { ReportFigures } from '@/lib/aggregate';
import type { ReportCommentary } from '@/lib/report-spec';
import { QUESTIONS } from '@/lib/report-spec';

export default function Report() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['check', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checks')
        .select('id, created_at, figures, commentary, project_name')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as {
        id: string;
        created_at: string;
        figures: ReportFigures;
        commentary: ReportCommentary;
        project_name: string;
      };
    },
  });

  const name = data?.project_name;

  if (isLoading) {
    return (
      <Layout>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Layout>
    );
  }
  if (error || !data) {
    return (
      <Layout>
        <p className="text-sm text-destructive">This check could not be loaded.</p>
      </Layout>
    );
  }

  const { figures, commentary } = data;

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{name ?? 'Project Check'}</h1>
          <p className="text-sm text-muted-foreground">{new Date(data.created_at).toLocaleString()}</p>
        </div>
        <Button asChild variant="outline">
          <Link to={`/checks/${id}/print`} target="_blank">
            Export PDF
          </Link>
        </Button>
      </div>

      <p className="mt-6 max-w-3xl text-sm leading-relaxed">{commentary.intro}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Enquiries" value={figures.enquiryCount} />
        <Stat label="Contracts" value={figures.contractCount} />
        <Stat label="EOIs (date present)" value={figures.eoiCount} />
        <Stat label="Spend" value={`$${Math.round(figures.spendTotal).toLocaleString()}`} />
      </div>

      <section className="mt-10 space-y-6">
        {QUESTIONS.map((q) => {
          const block = commentary.questions.find((x) => x.id === q.id);
          return (
            <article key={q.id} className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">{q.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{q.decision}</p>
              <p className="mt-3 text-sm leading-relaxed">{block?.findings}</p>
              {block?.adsCommentary && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{block.adsCommentary}</p>
              )}
            </article>
          );
        })}
      </section>

      <section className="mt-10 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Prioritised actions</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {commentary.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </section>

      <section className="mt-6 rounded-xl border bg-[hsl(var(--highlight))] p-5">
        <h2 className="font-semibold">Needs testing</h2>
        <p className="mt-1 text-xs text-muted-foreground">Not in the data. Do not brief as fact.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {commentary.needsTesting.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
