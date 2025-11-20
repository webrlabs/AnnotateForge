import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useAuthStore } from '@/store/authStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/Layout/AppLayout';
import Login from '@/components/Auth/Login';
import Dashboard from '@/components/Dashboard/Dashboard';
import ProjectView from '@/components/Project/ProjectView';
import AnnotationView from '@/components/Annotation/AnnotationView';
import { TrainingList } from '@/components/Training/TrainingList';
import { TrainingWizard } from '@/components/Training/TrainingWizard';
import { TrainingMonitor } from '@/components/Training/TrainingMonitor';
import { ModelList } from '@/components/Training/ModelList';
import { ApiDocs } from '@/components/Docs/ApiDocs';
import { UserProfile } from '@/components/Profile/UserProfile';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Create MUI theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Protected Route wrapper with Layout
const ProtectedRoute = ({ children, noLayout = false }: { children: React.ReactNode; noLayout?: boolean }) => {
  const { token } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (noLayout) {
    return <>{children}</>;
  }

  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Dashboard />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <ProjectView />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/images/:imageId"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <AnnotationView />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/training"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <TrainingList />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/training/new"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <TrainingWizard />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/training/:jobId"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <TrainingMonitor />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/models"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <ModelList />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/docs/api"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <ApiDocs />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <UserProfile />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
