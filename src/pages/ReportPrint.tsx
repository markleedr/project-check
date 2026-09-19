import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import { supabase } from '@/integrations/supabase/client';
import { CheckReportSheet } from '@/components/CheckReportSheet';
import type { ReportFigures } from '@/lib/aggregate';
import { CHECK_REPORT_INK, CHECK_REPORT_YELLOW, type ReportCommentary } from '@/lib/report-spec';

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

  if (!data) {
    return <p style={{ padding: 40, fontFamily: 'Montserrat, sans-serif' }}>Loading…</p>;
  }

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print { .no-print { display: none !important; } body { background: #fff; } }
        .pp-report a { color: inherit; text-decoration: none; }
      `}</style>

      <div
        className="no-print"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          padding: 16,
          background: '#F4F4F2',
          fontFamily: 'Montserrat, sans-serif',
        }}
      >
        <button
          onClick={() => window.print()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: CHECK_REPORT_YELLOW,
            color: CHECK_REPORT_INK,
            fontWeight: 600,
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          <Download className="h-4 w-4" /> Save as PDF
        </button>
      </div>

      <CheckReportSheet
        projectName={data.project_name}
        preparedAt={data.created_at}
        figures={data.figures}
        commentary={data.commentary}
      />
    </>
  );
}
