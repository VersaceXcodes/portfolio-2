import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

// Public views
import UV_Landing from '@/components/views/UV_Landing.tsx';
import UV_SignUp from '@/components/views/UV_SignUp.tsx';
import UV_SignIn from '@/components/views/UV_SignIn.tsx';

// Protected/editor views
import UV_Dashboard from '@/components/views/UV_Dashboard.tsx';
import UV_HeroEditor from '@/components/views/UV_HeroEditor.tsx';
import UV_AboutEditor from '@/components/views/UV_AboutEditor.tsx';
import UV_ProjectsEditor from '@/components/views/UV_ProjectsEditor.tsx';
import UV_ThemeEditor from '@/components/views/UV_ThemeEditor.tsx';
import UV_SEOEditor from '@/components/views/UV_SEOEditor.tsx';
import UV_SettingsEditor from '@/components/views/UV_SettingsEditor.tsx';
import UV_Preview from '@/components/views/UV_Preview.tsx';
import UV_Publish from '@/components/views/UV_Publish.tsx';
import UV_ExportPanel from '@/components/views/UV_ExportPanel.tsx';
import UV_ContactSubmissionsViewer from '@/components/views/UV_ContactSubmissionsViewer.tsx';
import UV_HelpDocs from '@/components/views/UV_HelpDocs.tsx';

// Shared chrome / layout components
import GV_TopNav from '@/components/views/GV_TopNav.tsx';
import GV_LeftRail from '@/components/views/GV_LeftRail.tsx';
import GV_Footer from '@/components/views/GV_Footer.tsx';
import GV_Notifications from '@/components/views/GV_Notifications.tsx';
import GV_UserMenu from '@/components/views/GV_UserMenu.tsx';
import GV_OnboardingTips from '@/components/views/GV_OnboardingTips.tsx';

/* eslint-disable react/display-name */

// Initialize a queried client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Simple loading indicator used during auth checks
const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
  </div>
);

// ProtectedRoute wrapper as per the routing pattern
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Critical: use individual selectors to avoid stale closures / extra renders
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  // Initialize auth state on app start
  const initialize_auth = useAppStore(state => state.initialize_auth);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);

  useEffect(() => {
    initialize_auth();
  }, [initialize_auth]);

  // Global loading state (from store) could show a spinner while auth is in progress
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <GV_Notifications />
        <GV_TopNav />
        {/* Optional user menu (depends on TopNav composition in your app) */}
        <GV_UserMenu />
        <div className="flex min-h-screen">
          {/* Left rail shown only for authenticated editor views */}
          {isAuthenticated && (
            <GV_LeftRail />
          )}

          {/* Main content area with routing */}
          <main className="flex-1 p-4 bg-white min-h-screen">
            <GV_OnboardingTips visibility={isAuthenticated ? true : false} />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<UV_Landing />} />
              <Route path="/signup" element={<UV_SignUp />} />
              <Route path="/signin" element={<UV_SignIn />} />

              {/* Protected routes (wrapped with ProtectedRoute) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <UV_Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/hero"
                element={
                  <ProtectedRoute>
                    <UV_HeroEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/about"
                element={
                  <ProtectedRoute>
                    <UV_AboutEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/projects"
                element={
                  <ProtectedRoute>
                    <UV_ProjectsEditor />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard/theme"
                element={
                  <ProtectedRoute>
                    <UV_ThemeEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/seo"
                element={
                  <ProtectedRoute>
                    <UV_SEOEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/settings"
                element={
                  <ProtectedRoute>
                    <UV_SettingsEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/preview"
                element={
                  <ProtectedRoute>
                    <UV_Preview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/publish"
                element={
                  <ProtectedRoute>
                    <UV_Publish />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/export"
                element={
                  <ProtectedRoute>
                    <UV_ExportPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/submissions"
                element={
                  <ProtectedRoute>
                    <UV_ContactSubmissionsViewer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/help"
                element={
                  <ProtectedRoute>
                    <UV_HelpDocs />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all: redirect based on auth status to either dashboard or signin */}
              <Route
                path="*"
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/signin" replace />
                }
              />
            </Routes>
          </main>
        </div>

        <GV_Footer />
      </QueryClientProvider>
    </Router>
  );
};

export default App;