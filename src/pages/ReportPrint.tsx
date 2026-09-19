import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ReportBody } from '@/components/ReportBody';
import type { ReportFigures } from '@/lib/aggregate';
import type { ReportCommentary } from '@/lib/report-spec';

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

  if (!data) return <p className="p-8 text-sm">Loading…</p>;

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-10 text-black print:p-0">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-500">Project Check</p>
          <h1 className="mt-1 text-2xl font-semibold">{data.project_name}</h1>
          <p className="text-sm text-neutral-500">{new Date(data.created_at).toLocaleDateString()}</p>
        </div>
        <button className="rounded border px-3 py-1 text-sm print:hidden" onClick={() => window.print()}>
          Save as PDF
        </button>
      </div>
      <p className="mb-4 text-xs text-neutral-500 print:hidden">
        In the print window, choose “Save as PDF” as the destination.
      </p>
      <ReportBody figures={data.figures} commentary={data.commentary} print />
    </div>
  );
}
