import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ReportBody } from '@/components/ReportBody';
import type { ReportFigures } from '@/lib/aggregate';
import type { ReportCommentary } from '@/lib/report-spec';

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

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{data.project_name || 'Project Check'}</h1>
          <p className="text-sm text-muted-foreground">{new Date(data.created_at).toLocaleString()}</p>
        </div>
        <Button asChild variant="outline">
          <Link to={`/checks/${id}/print`} target="_blank">
            Save PDF
          </Link>
        </Button>
      </div>
      <ReportBody figures={data.figures} commentary={data.commentary} />
    </Layout>
  );
}
