import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import Auth from './components/Auth';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import Logo from './components/Logo';
import { BackgroundDecor } from './components/ui';

function SessionSplash() {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <BackgroundDecor />
      <div className="flex flex-col items-center gap-4">
        <Logo size={56} />
        <p className="font-display text-sm font-bold uppercase tracking-[0.28em] text-wafa-gold-300">
          Nexa | Wafacash Management
        </p>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-wafa-navy-800">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-wafa-gold-300 to-wafa-gold-600" />
        </div>
        <p className="text-xs text-slate-500">جارٍ استعادة الجلسة المحفوظة...</p>
      </div>
    </div>
  );
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  // The session token + last known profile are restored from localStorage by
  // the store. Refresh them from the server so Matricule, agency assignment and
  // the cropped headshot are always the persisted Wafacash values.
  useEffect(() => {
    if (token) fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Stored a token but no user yet — waiting for the server round-trip.
  if ((isHydrating && !user) || (token && !user)) {
    return <SessionSplash />;
  }

  if (!isAuthenticated || !user) {
    return <Auth />;
  }

  return user.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />;
}
