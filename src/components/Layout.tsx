import { Link } from 'react-router-dom';
import AppSwitcher from '@/components/AppSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="font-semibold tracking-tight">
            Project Check
          </Link>
          <div className="flex items-center gap-3">
            {user && (
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            )}
            <AppSwitcher currentTool="project-check" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
