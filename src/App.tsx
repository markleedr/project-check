import { Toaster as Sonner } from '@/components/ui/sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Auth from '@/pages/Auth';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import NewCheck from '@/pages/NewCheck';
import Report from '@/pages/Report';
import ReportPrint from '@/pages/ReportPrint';

const queryClient = new QueryClient();

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <Protected>
                  <Projects />
                </Protected>
              }
            />
            <Route
              path="/new"
              element={
                <Protected>
                  <NewCheck />
                </Protected>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <Protected>
                  <ProjectDetail />
                </Protected>
              }
            />
            <Route
              path="/checks/:id"
              element={
                <Protected>
                  <Report />
                </Protected>
              }
            />
            <Route
              path="/checks/:id/print"
              element={
                <Protected>
                  <ReportPrint />
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
