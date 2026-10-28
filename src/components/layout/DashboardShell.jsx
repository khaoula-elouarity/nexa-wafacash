import { useState } from 'react';
import { Bell, LogOut, Menu, Search, Sparkles, X } from 'lucide-react';
import { Brand } from '../Logo';
import { Avatar, BackgroundDecor } from '../ui';
import { cn } from '../../lib/utils';

const CURRENT_YEAR = new Date().getFullYear();

function roleText(user) {
  if (user?.role === 'admin') return 'Directeur · Head Office';
  return user?.position || "Chef d'Agence / Guichetier";
}

function NavList({ nav, active, onNavigate }) {
  return (
    <nav className="space-y-1.5">
      {nav.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={cn(
              'group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-gradient-to-l from-wafa-gold-500/20 to-transparent text-wafa-gold-300'
                : 'text-slate-400 hover:bg-wafa-navy-800/50 hover:text-white'
            )}
          >
            {isActive && (
              <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-wafa-gold-400 shadow-[0_0_12px_rgba(233,196,106,0.8)]" />
            )}
            <Icon size={19} className={isActive ? 'text-wafa-gold-300' : 'group-hover:text-wafa-gold-300'} />
            <span>{item.label}</span>
            {item.badge != null && (
              <span
                className={cn(
                  'ms-auto rounded-full px-2 py-0.5 text-[10px] font-bold',
                  isActive ? 'bg-wafa-gold-500/20 text-wafa-gold-200' : 'bg-wafa-navy-800 text-slate-400'
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function SidebarContent({ user, nav, active, onNavigate, onLogout }) {
  const roleLabel = roleText(user);
  const roleBadge = user?.role === 'admin' ? 'Accès complet' : 'Accès agence';

  return (
    <div className="flex h-full flex-col p-5">
      <div className="relative mb-8 flex items-center justify-between">
        <Brand />
        <span className="pointer-events-none absolute -bottom-3 start-0 h-px w-full bg-gradient-to-l from-wafa-gold-500/50 to-transparent" />
      </div>

      <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
        القائمة الرئيسية
      </p>
      <NavList nav={nav} active={active} onNavigate={onNavigate} />

      <div className="mt-auto space-y-4 pt-6">
        <div className="relative overflow-hidden rounded-2xl border border-wafa-gold-500/25 bg-gradient-to-br from-wafa-gold-500/10 to-wafa-navy-800/40 p-4">
          <div className="pointer-events-none absolute -end-6 -top-6 h-20 w-20 rounded-full bg-wafa-gold-500/20 blur-2xl" />
          <div className="relative flex items-center gap-2 text-wafa-gold-300">
            <Sparkles size={16} />
            <span className="text-xs font-semibold">Wafacash Management</span>
          </div>
          <p className="relative mt-1.5 text-xs leading-relaxed text-slate-400">
            مساحة Nexa Enterprise المخصصة لشبكة وكالات Wafacash.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 p-3">
          <Avatar name={user?.fullName} src={user?.photo} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.fullName}</p>
            <p className="truncate text-[11px] text-slate-400">
              {roleLabel} · {roleBadge}
            </p>
            <p className="truncate text-[10px] text-wafa-gold-400/80">
              {user?.employeeId || '—'} · {user?.agencyLocation || 'Wafacash'}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="تسجيل الخروج"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardShell({
  user,
  nav,
  active,
  onNavigate,
  onLogout,
  title,
  subtitle,
  headerExtra,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleLabel = roleText(user);

  const handleNavigate = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <div className="relative min-h-screen">
      <BackgroundDecor />

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-e border-wafa-gold-500/10 glass-strong lg:block">
          <SidebarContent
            user={user}
            nav={nav}
            active={active}
            onNavigate={handleNavigate}
            onLogout={onLogout}
          />
        </aside>

        {/* Mobile drawer */}
        <div
          className={cn(
            'fixed inset-0 z-50 lg:hidden',
            mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
          )}
        >
          <div
            onClick={() => setMobileOpen(false)}
            className={cn(
              'absolute inset-0 bg-wafa-navy-950/80 backdrop-blur-sm transition-opacity duration-300',
              mobileOpen ? 'opacity-100' : 'opacity-0'
            )}
          />
          <aside
            className={cn(
              'absolute inset-y-0 start-0 w-72 max-w-[82%] border-e border-wafa-gold-500/15 bg-wafa-navy-950/95 shadow-2xl transition-transform duration-300 ease-out',
              mobileOpen ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute end-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-wafa-navy-800 hover:text-white"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
            <SidebarContent
              user={user}
              nav={nav}
              active={active}
              onNavigate={handleNavigate}
              onLogout={onLogout}
            />
          </aside>
        </div>

        {/* Main column */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-wafa-gold-500/10 glass-strong">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 text-slate-300 transition hover:text-white lg:hidden"
                aria-label="فتح القائمة"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-white sm:text-lg">{title}</h1>
                <p className="hidden truncate text-xs text-slate-400 sm:block">{subtitle}</p>
              </div>

              <div className="ms-auto flex items-center gap-2 sm:gap-3">
                {headerExtra}

                <div className="relative hidden md:block">
                  <span className="pointer-events-none absolute inset-y-0 start-0 grid w-9 place-items-center text-slate-500">
                    <Search size={16} />
                  </span>
                  <input
                    type="search"
                    placeholder="بحث في Wafacash..."
                    className="w-44 rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 py-2 ps-9 pe-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-wafa-gold-500/50 focus:ring-2 focus:ring-wafa-gold-500/15 lg:w-60"
                  />
                </div>

                <button
                  type="button"
                  className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 text-slate-400 transition hover:text-white"
                  aria-label="الإشعارات"
                >
                  <Bell size={18} />
                  <span className="absolute end-2.5 top-2.5 h-2 w-2 rounded-full bg-wafa-gold-400 shadow-[0_0_8px_rgba(233,196,106,0.9)]" />
                </button>

                <div className="flex items-center gap-2.5 rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 py-1.5 ps-1.5 pe-3">
                  <Avatar name={user?.fullName} src={user?.photo} size={30} />
                  <div className="hidden leading-tight sm:block">
                    <p className="max-w-[8rem] truncate text-xs font-semibold text-white">
                      {user?.fullName}
                    </p>
                    <p className="max-w-[10rem] truncate text-[10px] text-wafa-gold-400/80">
                      {roleLabel}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="animate-fade-up">{children}</div>
          </main>

          <footer className="border-t border-wafa-gold-500/10 px-6 py-5 text-center text-xs text-slate-600 lg:px-8">
            © {CURRENT_YEAR} Nexa | Wafacash Management — جميع الحقوق محفوظة.
          </footer>
        </div>
      </div>
    </div>
  );
}
