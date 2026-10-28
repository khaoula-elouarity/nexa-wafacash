import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  Target,
  Timer,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import DashboardShell from '../components/layout/DashboardShell';
import EmployeeProfile from '../components/EmployeeProfile';
import { SectionHeading, StatCard, StatusBadge } from '../components/ui';
import { cn } from '../lib/utils';

const NAV = [
  { id: 'overview', label: 'لوحتي', icon: LayoutDashboard },
  { id: 'tasks', label: 'مهام الوكالة', icon: ListChecks, badge: 4 },
  { id: 'transactions', label: 'سجل المعاملات', icon: Wallet },
  { id: 'profile', label: 'الملف الشخصي', icon: User },
];

const TITLES = {
  overview: ['لوحة موظف Wafacash', 'ملخّص وكالتك ومهامك اليومية'],
  tasks: ['مهام الوكالة اليومية', 'تسيير عمليات الصندوق والوكالة'],
  transactions: ['سجل معاملات الوكالة', 'آخر العمليات المسجلة في وكالتك'],
  profile: ['الملف الشخصي', 'بياناتك المهنية المحفوظة بشكل دائم'],
};

const INITIAL_TASKS = [
  { id: 'WFC-T01', title: 'فتح الصندوق والتحقق من الرصيد الافتتاحي', category: 'Caisse', priority: 'عالية', due: 'اليوم', status: 'قيد الإنجاز', done: false },
  { id: 'WFC-T02', title: 'مراجعة ملفات KYC للعملاء الجدد', category: 'Conformité', priority: 'عاجلة', due: 'اليوم', status: 'قيد الإنجاز', done: false },
  { id: 'WFC-T03', title: 'تسوية عمليات التحويل الدولية', category: 'Transferts', priority: 'متوسطة', due: 'غداً', status: 'معلق', done: false },
  { id: 'WFC-T04', title: 'معالجة طلبات التحويل عبر Wafacash Express', category: 'Opérations', priority: 'عالية', due: 'غداً', status: 'جديد', done: false },
  { id: 'WFC-T05', title: 'إغلاق الصندوق وإعداد تقرير اليوم', category: 'Caisse', priority: 'متوسطة', due: 'بعد 3 أيام', status: 'معلق', done: false },
  { id: 'WFC-T06', title: 'أرشفة إيصالات المعاملات المنجزة', category: 'Back Office', priority: 'منخفضة', due: 'بعد 3 أيام', status: 'مكتمل', done: true },
];

const PRIORITY_STYLES = {
  'عاجلة': 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  'عالية': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  'متوسطة': 'border-wafa-gold-500/40 bg-wafa-gold-500/10 text-wafa-gold-300',
  'منخفضة': 'border-slate-600/40 bg-slate-700/20 text-slate-300',
};

const TYPE_ICONS = {
  Versement: TrendingUp,
  Retrait: ArrowUpRight,
  Transfert: Activity,
  Paiement: Wallet,
};

function formatMAD(value) {
  return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(Number(value) || 0)} MAD`;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('fr-MA', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function Panel({ children, className = '' }) {
  return <div className={cn('glass rounded-2xl p-5 sm:p-6', className)}>{children}</div>;
}

function LoadingBlock({ label = 'جارٍ تحميل المعاملات...' }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-wafa-gold-500/15 bg-wafa-navy-950/40 px-4 py-10 text-sm text-slate-400">
      <Loader2 size={18} className="animate-spin text-wafa-gold-400" />
      {label}
    </div>
  );
}

function ErrorBlock({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/5 px-4 py-8 text-center text-sm text-rose-300">
      <AlertTriangle size={20} />
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-500/10"
      >
        <RefreshCw size={14} />
        إعادة المحاولة
      </button>
    </div>
  );
}

function ProgressRing({ value = 0, size = 132 }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="wafaRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#b8860b" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#132947" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#wafaRingGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-white">{value}%</span>
        <span className="text-[11px] text-slate-400">معدل الإنجاز</span>
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition',
        task.done
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : 'border-wafa-gold-500/12 bg-wafa-navy-950/40 hover:border-wafa-gold-500/30'
      )}
    >
      <span
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-md border transition',
          task.done ? 'border-emerald-500 bg-emerald-500 text-wafa-navy-950' : 'border-slate-600'
        )}
      >
        {task.done && <CheckCircle2 size={15} />}
      </span>
      <input type="checkbox" checked={task.done} onChange={onToggle} className="sr-only" />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', task.done ? 'text-slate-500 line-through' : 'text-white')}>
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {task.category} · {task.due}
        </p>
      </div>
      <span className={cn('hidden rounded-full border px-3 py-1 text-xs font-semibold sm:inline-block', PRIORITY_STYLES[task.priority])}>
        {task.priority}
      </span>
      <StatusBadge status={task.status} className="hidden md:inline-flex" />
    </label>
  );
}

function EmployeeOverview({ user, tasks, completion, transactions }) {
  const pending = tasks.filter((task) => !task.done).length;
  const today = new Date().toDateString();
  const todayTransactions = transactions.filter(
    (transaction) => new Date(transaction.createdAt).toDateString() === today
  );
  const todayVolume = todayTransactions.reduce(
    (total, transaction) => total + Number(transaction.amount || 0),
    0
  );

  return (
    <div className="space-y-6">
      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-10 -top-10 h-48 w-48 rounded-full bg-wafa-gold-500/10 blur-3xl" />
        <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          <div className="text-center lg:text-start">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-wafa-gold-500/30 bg-wafa-gold-500/10 px-3 py-1 text-xs font-medium text-wafa-gold-300">
              <Building2 size={13} /> {user?.agencyLocation || 'Wafacash'}
            </span>
            <h2 className="text-2xl font-bold text-white">أهلاً بك، {user?.fullName}</h2>
            <p className="mt-1.5 max-w-xl text-sm text-slate-400">
              {user?.position || "Chef d'Agence / Guichetier"} · Matricule{' '}
              <span className="font-mono text-wafa-gold-300">{user?.employeeId || '—'}</span>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              لديك {pending} مهام قيد الإنجاز و{salutation(todayTransactions.length)} معاملة مسجلة اليوم في وكالتك.
            </p>
          </div>
          <ProgressRing value={completion} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ListChecks} label="مهام الوكالة" value={tasks.length} delta={`${pending} قيد الإنجاز`} tone="cyan" />
        <StatCard icon={CheckCircle2} label="مكتملة" value={tasks.filter((task) => task.done).length} delta="هذا الأسبوع" tone="emerald" />
        <StatCard icon={Wallet} label="معاملات اليوم" value={todayTransactions.length} delta="وكالتك" tone="amber" />
        <StatCard icon={TrendingUp} label="حجم اليوم" value={formatMAD(todayVolume)} delta="بالدرهم" tone="violet" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionHeading icon={Activity} title="آخر معاملات الوكالة" subtitle="أحدث العمليات المسجلة باسم وكالتك" />
          <div className="space-y-2.5">
            {transactions.slice(0, 5).map((transaction) => {
              const Icon = TYPE_ICONS[transaction.type] || Wallet;
              return (
                <div
                  key={transaction.id}
                  className="flex items-center gap-3 rounded-xl border border-wafa-gold-500/10 bg-wafa-navy-950/40 p-3.5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-wafa-gold-500/20 bg-wafa-gold-500/10 text-wafa-gold-300">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {transaction.type} · <span dir="ltr" className="font-mono text-xs text-slate-400">{transaction.reference}</span>
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(transaction.createdAt)}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-mono text-sm font-semibold text-white">{formatMAD(transaction.amount)}</p>
                    <StatusBadge status={transaction.status} className="mt-1" />
                  </div>
                </div>
              );
            })}
            {!transactions.length && (
              <p className="py-8 text-center text-sm text-slate-500">لا توجد معاملات مسجلة بعد.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <SectionHeading icon={Target} title="مهام قريبة" subtitle="المواعيد النهائية" />
          <div className="space-y-3">
            {tasks
              .filter((task) => !task.done)
              .slice(0, 4)
              .map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-xl border border-wafa-gold-500/10 bg-wafa-navy-950/40 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-wafa-gold-500/20 bg-wafa-gold-500/10 text-wafa-gold-300">
                    <Clock size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{task.title}</p>
                    <p className="text-xs text-slate-500">{task.due}</p>
                  </div>
                </div>
              ))}
            {pending === 0 && (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center text-sm text-emerald-300">
                لا توجد مهام معلّقة — أحسنت!
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function salutation(count) {
  if (count === 0) return 'لا توجد';
  if (count === 1) return 'معاملة واحدة';
  if (count === 2) return 'معاملتان';
  return `${count} معاملات`;
}

function MyTasksView({ tasks, onToggle, user }) {
  const remaining = tasks.filter((task) => !task.done).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={ListChecks} label="إجمالي المهام" value={tasks.length} tone="cyan" />
        <StatCard icon={CheckCircle2} label="منجزة" value={tasks.length - remaining} tone="emerald" />
        <StatCard icon={Timer} label="متبقية" value={remaining} tone="amber" />
      </div>
      <Panel>
        <SectionHeading
          icon={ListChecks}
          title="مهام الوكالة اليومية"
          subtitle={`${user?.agencyLocation || 'Wafacash'} — حدّد المهام المكتملة عند إنجازها`}
        />
        <div className="space-y-2.5">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={() => onToggle(task.id)} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function TransactionsView({
  user,
  transactions,
  loading,
  error,
  onRefresh,
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter((transaction) =>
      [transaction.reference, transaction.type, transaction.status, transaction.employeeId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [transactions, query]);

  const totalVolume = filtered.reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label="معاملات الوكالة" value={filtered.length} tone="cyan" />
        <StatCard icon={TrendingUp} label="الحجم الإجمالي" value={formatMAD(totalVolume)} tone="emerald" />
        <StatCard
          icon={Building2}
          label="الوكالة"
          value={user?.agencyLocation || 'Wafacash'}
          delta="سجل محفوظ بشكل دائم"
          tone="amber"
        />
      </div>

      <Panel>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading icon={Wallet} title="سجل معاملات الوكالة" subtitle="Versements, retraits, transferts et paiements" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-0 grid w-10 place-items-center text-slate-500">
                <Search size={16} />
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث بالمرجع أو النوع..."
                className="w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 py-2.5 ps-10 pe-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-wafa-gold-500/50 sm:w-60"
              />
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="grid h-10 w-10 place-items-center rounded-xl border border-wafa-gold-500/15 text-slate-400 transition hover:text-wafa-gold-300"
              title="تحديث"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message={error} onRetry={onRefresh} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-right text-sm">
              <thead>
                <tr className="border-b border-wafa-gold-500/10 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-medium">المرجع</th>
                  <th className="px-3 py-3 font-medium">النوع</th>
                  <th className="px-3 py-3 font-medium">المبلغ</th>
                  <th className="px-3 py-3 font-medium">Matricule</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                  <th className="px-3 py-3 font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wafa-gold-500/8">
                {filtered.map((transaction) => (
                  <tr key={transaction.id} className="transition-colors hover:bg-wafa-gold-500/5">
                    <td dir="ltr" className="px-3 py-3.5 font-mono text-xs text-wafa-gold-300">
                      {transaction.reference}
                    </td>
                    <td className="px-3 py-3.5 font-medium text-white">{transaction.type}</td>
                    <td className="px-3 py-3.5 font-mono font-semibold text-white">
                      {formatMAD(transaction.amount)}
                    </td>
                    <td dir="ltr" className="px-3 py-3.5 font-mono text-xs text-slate-400">
                      {transaction.employeeId}
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={transaction.status} />
                    </td>
                    <td className="px-3 py-3.5 text-xs text-slate-500">{formatDate(transaction.createdAt)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                      لا توجد معاملات مطابقة لوكالتك.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default function EmployeeDashboard() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchTransactions = useAuthStore((s) => s.fetchTransactions);

  const [view, setView] = useState('overview');
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState('');

  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    setTransactionsError('');
    try {
      const data = await fetchTransactions(80);
      setTransactions(data.transactions);
    } catch (err) {
      setTransactionsError(err.message || 'تعذّر تحميل سجل معاملات الوكالة.');
    } finally {
      setTransactionsLoading(false);
    }
  }, [fetchTransactions]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const completion = useMemo(() => {
    if (!tasks.length) return 0;
    return Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100);
  }, [tasks]);

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              done: !task.done,
              status: !task.done ? 'مكتمل' : 'قيد الإنجاز',
            }
          : task
      )
    );
  };

  const [title, subtitle] = TITLES[view] ?? TITLES.overview;

  return (
    <DashboardShell
      user={user}
      nav={NAV}
      active={view}
      onNavigate={setView}
      onLogout={logout}
      title={title}
      subtitle={subtitle}
      headerExtra={
        <span className="hidden items-center gap-2 rounded-xl border border-wafa-gold-500/25 bg-wafa-gold-500/10 px-3.5 py-2 text-xs font-semibold text-wafa-gold-300 sm:inline-flex">
          <BadgeCheck size={15} />
          {user?.employeeId || 'Wafacash'} · {user?.agencyLocation || 'Agence'}
        </span>
      }
    >
      {view === 'overview' && (
        <EmployeeOverview user={user} tasks={tasks} completion={completion} transactions={transactions} />
      )}
      {view === 'tasks' && <MyTasksView tasks={tasks} onToggle={toggleTask} user={user} />}
      {view === 'transactions' && (
        <TransactionsView
          user={user}
          transactions={transactions}
          loading={transactionsLoading}
          error={transactionsError}
          onRefresh={loadTransactions}
        />
      )}
      {view === 'profile' && <EmployeeProfile />}
    </DashboardShell>
  );
}
