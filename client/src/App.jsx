import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';

// Pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import Teachers from './pages/Teachers';
import Rooms from './pages/Rooms';
import TimeSlots from './pages/TimeSlots';
import TimetableView from './pages/TimetableView';
import StudentDashboard from './pages/StudentDashboard';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function ToasterWrapper() {
  const { theme } = useTheme();
  const bg = theme === 'dark' ? '#12192d' : '#ffffff';
  const color = theme === 'dark' ? '#f1f5f9' : '#1e293b';
  const border = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: bg,
          color,
          border: `1px solid ${border}`,
          borderRadius: 10,
          fontSize: '0.875rem'
        },
        success: { iconTheme: { primary: '#10b981', secondary: bg } },
        error:   { iconTheme: { primary: '#ef4444', secondary: bg } }
      }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToasterWrapper />

          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Admin routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute adminOnly><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
            } />
            <Route path="/departments" element={
              <ProtectedRoute adminOnly><AppLayout><Departments /></AppLayout></ProtectedRoute>
            } />
            <Route path="/classes" element={
              <ProtectedRoute adminOnly><AppLayout><Classes /></AppLayout></ProtectedRoute>
            } />
            <Route path="/subjects" element={
              <ProtectedRoute adminOnly><AppLayout><Subjects /></AppLayout></ProtectedRoute>
            } />
            <Route path="/teachers" element={
              <ProtectedRoute adminOnly><AppLayout><Teachers /></AppLayout></ProtectedRoute>
            } />
            <Route path="/rooms" element={
              <ProtectedRoute adminOnly><AppLayout><Rooms /></AppLayout></ProtectedRoute>
            } />
            <Route path="/timeslots" element={
              <ProtectedRoute adminOnly><AppLayout><TimeSlots /></AppLayout></ProtectedRoute>
            } />
            <Route path="/timetable" element={
              <ProtectedRoute adminOnly><AppLayout><TimetableView /></AppLayout></ProtectedRoute>
            } />

            {/* Student route */}
            <Route path="/student" element={
              <ProtectedRoute><AppLayout><StudentDashboard /></AppLayout></ProtectedRoute>
            } />

            {/* Catch-all redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
