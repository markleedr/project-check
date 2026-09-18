import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';

export default function ProjectDetail() {
  const { id } = useParams();
  const { data: project } = useQuery({
    queryKey: ['project', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) throw error;
      return data as { id: string; name: string };
    },
  });
  const { data: checks = [] } = useQuery({
    queryKey: ['checks', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checks')
        .select('id, created_at, status')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; created_at: string; status: string }[];
    },
  });

  return (
    <Layout>
      <h1 className="text-2xl font-semibold">{project?.name ?? 'Project'}</h1>
      <div className="mt-6 space-y-3">
        {checks.map((c) => (
          <Link key={c.id} to={`/checks/${c.id}`} className="block rounded-xl border bg-card p-4 hover:border-primary">
            <div className="font-medium">Check {new Date(c.created_at).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{c.status}</div>
          </Link>
        ))}
        {checks.length === 0 && <p className="text-sm text-muted-foreground">No checks yet.</p>}
      </div>
    </Layout>
  );
}
