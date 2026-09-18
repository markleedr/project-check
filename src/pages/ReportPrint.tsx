import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { ReportFigures } from '@/lib/aggregate';
import type { ReportCommentary } from '@/lib/report-spec';
import { QUESTIONS } from '@/lib/report-spec';

export default function ReportPrint() {
  const { id } = useParams();
  const { data } = useQuery({
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
        created_at: string;
        figures: ReportFigures;
        commentary: ReportCommentary;
        project_name: string;
      };
    },
  });

  const name = data.project_name;

  if (!data) return <p className="p-8 text-sm">Loading…</p>;

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-10 text-black print:p-0">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-500">Project Check</p>
          <h1 className="mt-1 text-2xl font-semibold">{name}</h1>
          <p className="text-sm text-neutral-500">{new Date(data.created_at).toLocaleDateString()}</p>
        </div>
        <button className="rounded border px-3 py-1 text-sm print:hidden" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>
      <p className="text-sm leading-relaxed">{data.commentary.intro}</p>
      <p className="mt-4 text-sm">
        {data.figures.contractCount} contracts · {data.figures.enquiryCount} enquiries · $
        {Math.round(data.figures.spendTotal).toLocaleString()} spend
      </p>
      {QUESTIONS.map((q) => {
        const block = data.commentary.questions.find((x) => x.id === q.id);
        return (
          <section key={q.id} className="mt-6 break-inside-avoid">
            <h2 className="text-base font-semibold">{q.title}</h2>
            <p className="mt-2 text-sm leading-relaxed">{block?.findings}</p>
            {block?.adsCommentary && <p className="mt-2 text-sm leading-relaxed">{block.adsCommentary}</p>}
          </section>
        );
      })}
      <section className="mt-8">
        <h2 className="text-base font-semibold">Prioritised actions</h2>
        <ol className="mt-2 list-decimal pl-5 text-sm">
          {data.commentary.actions.map((a) => (
            <li key={a} className="mt-1">
              {a}
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-6">
        <h2 className="text-base font-semibold">Needs testing</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {data.commentary.needsTesting.map((a) => (
            <li key={a} className="mt-1">
              {a}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
