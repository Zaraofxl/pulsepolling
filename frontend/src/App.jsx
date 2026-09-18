import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';

// Page Components
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreatePollPage from './pages/CreatePollPage';
import PollViewPage from './pages/PollViewPage';
import PollAdminLivePage from './pages/PollAdminLivePage';

// ============================================================================
// PROTECTED ROUTE WRAPPER
// Restricts access to authenticated users only.
// ============================================================================
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Authenticating...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ============================================================================
// ROOT APPLICATION COMPONENT
// Mounts global context providers, layout container, and routing hierarchy.
// ============================================================================
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="app-container">
            {/* Top Global Navigation Bar */}
            <Navbar />

            {/* Main Application Router Viewport */}
            <main className="main-content">
              <Routes>
                {/* Public Landing & Auth Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Public Audience Voting Route (by Mongo ID or short code) */}
                <Route path="/poll/:idOrCode" element={<PollViewPage />} />

                {/* Protected Creator Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/create"
                  element={
                    <ProtectedRoute>
                      <CreatePollPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/live/:id"
                  element={
                    <ProtectedRoute>
                      <PollAdminLivePage />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback 404 Route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
