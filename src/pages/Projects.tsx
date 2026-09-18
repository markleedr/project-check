import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';

export default function Projects() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; name: string; created_at: string }[];
    },
  });

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One development at a time. Mid-campaign: where does the next dollar go?
          </p>
        </div>
        <Button asChild>
          <Link to="/new">New check</Link>
        </Button>
      </div>
      <div className="mt-8 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && projects.length === 0 && (
          <p className="text-sm text-muted-foreground">No projects yet. Start a check and name the development.</p>
        )}
        {projects.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="block rounded-xl border bg-card p-4 hover:border-primary"
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
