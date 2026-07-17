import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import KanbanBoard from './pages/KanbanBoard';
import ProjectDetails from './pages/ProjectDetails';
import TimelinePage from './pages/Timeline';
import InsightsPage from './pages/Insights';
import SettingsPage from './pages/Settings';
import ReleasesPage from './pages/Releases';
import BacklogPage from './pages/Backlog';
import SprintBoard from './pages/SprintBoard';
import BoardSettings from './pages/BoardSettings';
import ProfilePage from './pages/Profile';
import MyTasks from './pages/MyTasks';
import ManagementConsole from './components/ManagementConsole';
import ArchivedPage from './pages/Archived';
import NotificationsPage from './pages/Notifications';
import Plans from './pages/Plans';
import PmReviewQueue from './pages/PmReviewQueue';
import MySubmittedTasks from './pages/MySubmittedTasks';
import TaskDetailPage from './pages/TaskDetailPage';

const SSORedirect = () => {
  useEffect(() => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    let targetHost = hostname;
    let portSuffix = '';

    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      const tenantPort = import.meta.env.VITE_TENANT_PORT || '3000';
      portSuffix = `:${tenantPort}`;
      const parts = hostname.split('.');
      if (parts.length > 1) {
        targetHost = hostname;
      } else {
        targetHost = 'localhost';
      }
    } else {
      // Replaces scalozflowtest with workspacetest case-insensitively
      targetHost = hostname.replace(/\bscalozflowtest\b/gi, 'workspacetest');
    }

    const currentUrl = window.location.href;
    window.location.href = `${protocol}//${targetHost}${portSuffix}/?redirect_to=${encodeURIComponent(currentUrl)}`;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 font-medium">Redirecting to Scaloz Workspace...</p>
    </div>
  );
};

const DashboardRouteGuard = () => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated()) return <SSORedirect />;
  if (user?.passwordResetRequired) return <Navigate to="/reset-password" />;
  return <DashboardLayout />;
};

function App() {
  const { isAuthenticated, user } = useAuth();
  console.log("[App] Auth State:", { authenticated: isAuthenticated(), user });


  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={isAuthenticated() ? <Navigate to="/dashboard" /> : <SSORedirect />} />
        <Route path="/login" element={<Navigate to="/" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/dashboard" element={<DashboardRouteGuard />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="kanban-select" element={<Navigate to="/dashboard/projects" />} />
          <Route path="project-details/:id" element={<ProjectDetails />} />
          <Route path="project/:id" element={<KanbanBoard />} />
          <Route path="backlog/:id" element={<BacklogPage />} />
          <Route path="sprint-board/:id" element={<SprintBoard />} />
          <Route path="board-settings/:id" element={<BoardSettings />} />
          <Route path="roadmap/:id" element={<TimelinePage />} />
          <Route path="insights/:id" element={<InsightsPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="releases/:id" element={<ReleasesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="plans" element={<Plans />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="archived/:id" element={<ArchivedPage />} />
          <Route path="task/:id" element={<TaskDetailPage />} />
          <Route path="pm-review-queue" element={<PmReviewQueue />} />
          <Route path="my-submitted-tasks" element={<MySubmittedTasks />} />
          <Route path="management-console" element={(user?.role === 'MANAGER' || user?.role === 'ADMIN') ? <ManagementConsole /> : <Navigate to="/dashboard" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
