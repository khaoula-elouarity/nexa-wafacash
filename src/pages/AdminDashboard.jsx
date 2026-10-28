import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Clock,
  FileText,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCircle,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import DashboardShell from '../components/layout/DashboardShell';
import EmployeeProfile from '../components/EmployeeProfile';
import { Avatar, SectionHeading, StatCard, StatusBadge } from '../components/ui';
import { cn } from '../lib/utils';

const NAV = [
  { id: 'overview', label: 'لوحة القيادة', icon: LayoutDashboard },
  { id: 'agencies', label: 'الوكالات', icon: Building2 },
  { id: 'employees', label: 'الموظفون', icon: Users },
  { id: 'transactions', label: 'سجل المعاملات', icon: ListChecks },
  { id: 'logs', label: 'سجل النظام', icon: FileText },
  { id: 'profile', label: 'الملف الشخصي', icon: UserCircle },
];

const TITLES = {
  overview: ['لوحة قيادة المدير', 'مؤشرات شبكة وكالات Wafacash'],
  agencies: ['إحصائيات الوكالات', 'أداء كل وكالة وحجم معاملاتها'],
  employees: ['إدارة الموظفين', 'الملفات، الصلاحيات والتعيينات'],
  transactions: ['سجل المعاملات', 'جميع عمليات الشبكة'],
  logs: ['سجل النظام', 'تتبّع أحداث الدخول والتحديثات'],
  profile: ['الملف الشخصي', 'بيانات المدير المحفوظة بشكل دائم'],
};

const ROLE_OPTIONS = [
  { id: 'employee', label: "Chef d'Agence / Guichetier" },
  { id: 'admin', label: 'Directeur / Head Office Manager' },
];

const FALLBACK_POSITIONS = {
  admin: ['Directeur / Head Office Manager', 'Responsable Back Office', 'Responsable Conformité'],
  employee: ["Chef d'Agence", 'Guichetier', 'Chargé de Clientèle', 'Agent de Transfert'],
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

function LoadingBlock({ label = 'جارٍ تحميل البيانات...' }) {
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
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-500/10"
        >
          <RefreshCw size={14} />
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

function AgencyTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-right text-sm">
        <thead>
          <tr className="border-b border-wafa-gold-500/10 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-3 font-medium">الوكالة</th>
            <th className="px-3 py-3 font-medium">الموظفون</th>
            <th className="px-3 py-3 font-medium">المعاملات</th>
            <th className="px-3 py-3 font-medium">حجم المعاملات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-wafa-gold-500/8">
          {rows.map((row) => (
            <tr key={row.agency} className="transition-colors hover:bg-wafa-gold-500/5">
              <td className="px-3 py-3.5">
                <span className="inline-flex items-center gap-2 font-semibold text-white">
                  <Building2 size={15} className="text-wafa-gold-400" />
                  {row.agency}
                </span>
              </td>
              <td className="px-3 py-3.5 text-slate-300">{row.employees}</td>
              <td className="px-3 py-3.5 font-mono text-slate-300">{row.transactions}</td>
              <td className="px-3 py-3.5 font-mono text-wafa-gold-300">{formatMAD(row.volume)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                لا توجد بيانات وكالات بعد.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */
function OverviewView({ onNavigate }) {
  const fetchAdminStats = useAuthStore((s) => s.fetchAdminStats);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await fetchAdminStats());
    } catch (err) {
      setError(err.message || 'تعذّر تحميل إحصائيات الوكالات.');
    } finally {
      setLoading(false);
    }
  }, [fetchAdminStats]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="موظفو الشبكة" value={stats?.employees ?? 0} delta="Wafacash Management" tone="cyan" />
        <StatCard icon={Building2} label="الوكالات النشطة" value={stats?.agencies ?? 0} delta="شبكة Wafacash" tone="amber" />
        <StatCard icon={Wallet} label="معاملات اليوم" value={stats?.transactionsToday ?? 0} delta="مباشرة" tone="emerald" />
        <StatCard icon={ListChecks} label="حجم اليوم" value={formatMAD(stats?.volumeToday)} delta={`${stats?.totalTransactions ?? 0} عملية إجمالاً`} tone="violet" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionHeading
            icon={Building2}
            title="أداء الوكالات"
            subtitle="توزيع الموظفين والمعاملات حسب الوكالة"
            action={
              <button
                type="button"
                onClick={() => onNavigate('agencies')}
                className="text-xs font-medium text-wafa-gold-400 hover:text-wafa-gold-300"
              >
                عرض الكل
              </button>
            }
          />
          <AgencyTable rows={stats?.agencyStats ?? []} />
        </Panel>

        <Panel>
          <SectionHeading icon={ShieldCheck} title="ملخص الصلاحيات" subtitle="Modèle entreprise Wafacash" />
          <div className="space-y-3">
            <div className="rounded-xl border border-wafa-gold-500/20 bg-wafa-gold-500/5 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-wafa-gold-300">
                <ShieldCheck size={16} /> Directeur / Head Office
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                وصول كامل إلى إحصائيات الوكالات، إدارة الموظفين وسجل النظام.
              </p>
              <p className="mt-2 font-mono text-xs text-slate-300">{stats?.admins ?? 0} حساب مدير</p>
            </div>
            <div className="rounded-xl border border-wafa-gold-500/10 bg-wafa-navy-950/40 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <Users size={16} className="text-wafa-gold-400" /> Chef d'Agence / Guichetier
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                وصول إلى الملف الشخصي، مهام الوكالة اليومية وسجل معاملات الوكالة.
              </p>
              <p className="mt-2 font-mono text-xs text-slate-300">{stats?.employees ?? 0} موظف وكالة</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Agencies                                                            */
/* ------------------------------------------------------------------ */
function AgenciesView() {
  const fetchAdminStats = useAuthStore((s) => s.fetchAdminStats);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await fetchAdminStats());
    } catch (err) {
      setError(err.message || 'تعذّر تحميل إحصائيات الوكالات.');
    } finally {
      setLoading(false);
    }
  }, [fetchAdminStats]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  const rows = stats?.agencyStats ?? [];
  const maxTransactions = Math.max(1, ...rows.map((row) => row.transactions));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Building2} label="عدد الوكالات" value={stats?.agencies ?? 0} tone="cyan" />
        <StatCard icon={ListChecks} label="إجمالي المعاملات" value={stats?.totalTransactions ?? 0} tone="amber" />
        <StatCard icon={Wallet} label="حجم معاملات اليوم" value={formatMAD(stats?.volumeToday)} tone="emerald" />
      </div>

      <Panel>
        <SectionHeading icon={Building2} title="مقارنة الوكالات" subtitle="حسب عدد المعاملات المسجلة" />
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.agency}>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-white">{row.agency}</span>
                <span className="font-mono text-slate-400">
                  {row.transactions} معاملة · {formatMAD(row.volume)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-wafa-navy-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-wafa-gold-400 to-wafa-gold-600"
                  style={{ width: `${Math.max(4, (row.transactions / maxTransactions) * 100)}%` }}
                />
              </div>
            </div>
          ))}
          {!rows.length && <p className="py-8 text-center text-sm text-slate-500">لا توجد وكالات بعد.</p>}
        </div>
      </Panel>

      <Panel>
        <SectionHeading icon={ListChecks} title="تفاصيل الوكالات" subtitle="الموظفون والمعاملات والأحجام" />
        <AgencyTable rows={rows} />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Employee management                                                 */
/* ------------------------------------------------------------------ */
function EmployeesView() {
  const fetchEmployees = useAuthStore((s) => s.fetchEmployees);
  const updateEmployee = useAuthStore((s) => s.updateEmployee);

  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    employeeId: '',
    agencyLocation: '',
    role: 'employee',
    position: '',
    phone: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchEmployees();
      setEmployees(data.employees);
      setPositions(data.positions);
    } catch (err) {
      setError(err.message || 'تعذّر تحميل قائمة الموظفين.');
    } finally {
      setLoading(false);
    }
  }, [fetchEmployees]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      [employee.fullName, employee.email, employee.employeeId, employee.agencyLocation, employee.position]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [employees, query]);

  const startEditing = (employee) => {
    setNotice('');
    setEditingId(employee.id);
    setForm({
      fullName: employee.fullName || '',
      employeeId: employee.employeeId || '',
      agencyLocation: employee.agencyLocation || '',
      role: employee.role,
      position: employee.position || '',
      phone: employee.phone || '',
    });
  };

  const changeRole = (nextRole) => {
    const options = positions[nextRole] || FALLBACK_POSITIONS[nextRole] || [];
    setForm((prev) => ({
      ...prev,
      role: nextRole,
      position: options.includes(prev.position) ? prev.position : options[0] || '',
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setNotice('');
    try {
      const updated = await updateEmployee(editingId, {
        fullName: form.fullName.trim(),
        employeeId: form.employeeId.trim().toUpperCase(),
        agencyLocation: form.agencyLocation.trim(),
        role: form.role,
        position: form.position,
        phone: form.phone.trim(),
      });
      setEmployees((list) => list.map((employee) => (employee.id === updated.id ? updated : employee)));
      setEditingId(null);
      setNotice('تم حفظ بيانات الموظف بشكل دائم.');
    } catch (err) {
      setNotice(err.message || 'تعذّر حفظ بيانات الموظف.');
    } finally {
      setSaving(false);
    }
  };

  const positionOptions = positions[form.role] || FALLBACK_POSITIONS[form.role] || [];
  const editingEmployee = employees.find((employee) => employee.id === editingId);

  return (
    <div className="space-y-6">
      {editingId && editingEmployee && (
        <Panel className="border-wafa-gold-500/30">
          <div className="flex items-start justify-between gap-3">
            <SectionHeading
              icon={Save}
              title={`تعديل: ${editingEmployee.fullName}`}
              subtitle="تغيير التعيين، الصلاحية أو رقم الموظف"
            />
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-wafa-navy-800 hover:text-white"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">الاسم الكامل</span>
              <input
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                className="w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/70 px-4 py-2.5 text-sm text-white outline-none focus:border-wafa-gold-500/60"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Matricule</span>
              <input
                dir="ltr"
                value={form.employeeId}
                onChange={(event) => setForm((prev) => ({ ...prev, employeeId: event.target.value }))}
                className="w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/70 px-4 py-2.5 text-sm text-white outline-none focus:border-wafa-gold-500/60"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">الوكالة</span>
              <input
                value={form.agencyLocation}
                onChange={(event) => setForm((prev) => ({ ...prev, agencyLocation: event.target.value }))}
                className="w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/70 px-4 py-2.5 text-sm text-white outline-none focus:border-wafa-gold-500/60"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">الدور / Rôle</span>
              <select
                value={form.role}
                onChange={(event) => changeRole(event.target.value)}
                className="w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/70 px-4 py-2.5 text-sm text-white outline-none focus:border-wafa-gold-500/60"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id} className="bg-wafa-navy-950">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">الوظيفة / Fonction</span>
              <select
                value={form.position}
                onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
                className="w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/70 px-4 py-2.5 text-sm text-white outline-none focus:border-wafa-gold-500/60"
              >
                {positionOptions.map((position) => (
                  <option key={position} value={position} className="bg-wafa-navy-950">
                    {position}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">الهاتف</span>
              <input
                dir="ltr"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/70 px-4 py-2.5 text-sm text-white outline-none focus:border-wafa-gold-500/60"
              />
            </label>

            <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-wafa-gold-500 to-wafa-gold-700 px-5 py-2.5 text-sm font-semibold text-wafa-navy-950 transition hover:brightness-110 disabled:opacity-70"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-xl border border-wafa-gold-500/15 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-wafa-navy-800"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading icon={Users} title="دليل الموظفين" subtitle="جميع حسابات Wafacash المحفوظة" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-0 grid w-10 place-items-center text-slate-500">
                <Search size={16} />
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث بالاسم، Matricule أو الوكالة..."
                className="w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 py-2.5 ps-10 pe-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-wafa-gold-500/50 sm:w-72"
              />
            </div>
            <button
              type="button"
              onClick={load}
              className="grid h-10 w-10 place-items-center rounded-xl border border-wafa-gold-500/15 text-slate-400 transition hover:text-wafa-gold-300"
              title="تحديث"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {notice && (
          <p className="mb-4 rounded-xl border border-wafa-gold-500/25 bg-wafa-gold-500/10 px-4 py-2.5 text-sm text-wafa-gold-300">
            {notice}
          </p>
        )}

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message={error} onRetry={load} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filtered.map((employee) => (
              <div
                key={employee.id}
                className="rounded-2xl border border-wafa-gold-500/12 bg-wafa-navy-950/40 p-4 transition hover:border-wafa-gold-500/30"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={employee.fullName} src={employee.photo} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-white">{employee.fullName}</p>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold',
                          employee.role === 'admin'
                            ? 'border-wafa-gold-500/40 bg-wafa-gold-500/10 text-wafa-gold-300'
                            : 'border-slate-600/40 bg-slate-700/20 text-slate-300'
                        )}
                      >
                        {employee.role === 'admin' ? 'Directeur' : 'Employé'}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-400">{employee.position}</p>
                    <p dir="ltr" className="mt-0.5 truncate font-mono text-[11px] text-wafa-gold-400/80">
                      {employee.employeeId} · {employee.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEditing(employee)}
                    className="rounded-lg border border-wafa-gold-500/20 px-3 py-1.5 text-xs font-semibold text-wafa-gold-300 transition hover:bg-wafa-gold-500/10"
                  >
                    تعديل
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-400 sm:grid-cols-2">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} className="text-wafa-gold-400/80" />
                    {employee.agencyLocation}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={13} className="text-wafa-gold-400/80" />
                    <span dir="ltr">{employee.phone || '—'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={13} className="text-wafa-gold-400/80" />
                    <span dir="ltr" className="truncate">{employee.email}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={13} className="text-wafa-gold-400/80" />
                    منذ {new Date(employee.joinedAt).toLocaleDateString('fr-MA')}
                  </span>
                </div>
              </div>
            ))}
            {!filtered.length && (
              <p className="col-span-full py-10 text-center text-sm text-slate-500">لا توجد نتائج مطابقة.</p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */
function TransactionsView() {
  const fetchTransactions = useAuthStore((s) => s.fetchTransactions);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTransactions(200);
      setTransactions(data.transactions);
    } catch (err) {
      setError(err.message || 'تعذّر تحميل سجل المعاملات.');
    } finally {
      setLoading(false);
    }
  }, [fetchTransactions]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter((transaction) =>
      [transaction.reference, transaction.type, transaction.status, transaction.agencyLocation, transaction.employeeId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [transactions, query]);

  const totalVolume = filtered.reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={ListChecks} label="المعاملات المعروضة" value={filtered.length} tone="cyan" />
        <StatCard icon={Wallet} label="الحجم الإجمالي" value={formatMAD(totalVolume)} tone="emerald" />
        <StatCard icon={Building2} label="النطاق" value="كل الشبكة" delta="Directeur" tone="amber" />
      </div>

      <Panel>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading icon={ListChecks} title="سجل معاملات الشبكة" subtitle="Versements, retraits, transferts et paiements" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-0 grid w-10 place-items-center text-slate-500">
                <Search size={16} />
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث بالمرجع أو الوكالة..."
                className="w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 py-2.5 ps-10 pe-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-wafa-gold-500/50 sm:w-64"
              />
            </div>
            <button
              type="button"
              onClick={load}
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
          <ErrorBlock message={error} onRetry={load} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead>
                <tr className="border-b border-wafa-gold-500/10 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-medium">المرجع</th>
                  <th className="px-3 py-3 font-medium">النوع</th>
                  <th className="px-3 py-3 font-medium">الوكالة</th>
                  <th className="px-3 py-3 font-medium">Matricule</th>
                  <th className="px-3 py-3 font-medium">المبلغ</th>
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
                    <td className="px-3 py-3.5 text-slate-400">{transaction.agencyLocation}</td>
                    <td dir="ltr" className="px-3 py-3.5 font-mono text-xs text-slate-400">
                      {transaction.employeeId}
                    </td>
                    <td className="px-3 py-3.5 font-mono font-semibold text-white">
                      {formatMAD(transaction.amount)}
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={transaction.status} />
                    </td>
                    <td className="px-3 py-3.5 text-xs text-slate-500">{formatDate(transaction.createdAt)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                      لا توجد معاملات مطابقة.
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

/* ------------------------------------------------------------------ */
/* System logs                                                         */
/* ------------------------------------------------------------------ */
const LOG_TONES = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  info: 'border-wafa-gold-500/25 bg-wafa-gold-500/10 text-wafa-gold-300',
  system: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
};

function LogsView() {
  const fetchSystemLogs = useAuthStore((s) => s.fetchSystemLogs);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLogs(await fetchSystemLogs(150));
    } catch (err) {
      setError(err.message || 'تعذّر تحميل سجل النظام.');
    } finally {
      setLoading(false);
    }
  }, [fetchSystemLogs]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Panel>
      <div className="mb-5 flex items-center justify-between gap-3">
        <SectionHeading icon={FileText} title="سجل النظام" subtitle="أحداث الدخول، التسجيل وتحديث الملفات" />
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-wafa-gold-500/20 px-3.5 py-2 text-xs font-semibold text-wafa-gold-300 transition hover:bg-wafa-gold-500/10"
        >
          <RefreshCw size={14} />
          تحديث
        </button>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : (
        <div className="space-y-2.5">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-2 rounded-xl border border-wafa-gold-500/10 bg-wafa-navy-950/40 p-3.5 sm:flex-row sm:items-center"
            >
              <span
                className={cn(
                  'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                  LOG_TONES[log.type] ?? LOG_TONES.info
                )}
              >
                {log.action}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{log.message}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {log.actor}
                  {log.email ? ` · ${log.email}` : ''}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-slate-500">{formatDate(log.createdAt)}</span>
            </div>
          ))}
          {!logs.length && <p className="py-10 text-center text-sm text-slate-500">لا توجد أحداث مسجلة بعد.</p>}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard shell                                                     */
/* ------------------------------------------------------------------ */
export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [view, setView] = useState('overview');

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
          <ShieldCheck size={15} />
          Directeur · Accès complet
        </span>
      }
    >
      {view === 'overview' && <OverviewView onNavigate={setView} />}
      {view === 'agencies' && <AgenciesView />}
      {view === 'employees' && <EmployeesView />}
      {view === 'transactions' && <TransactionsView />}
      {view === 'logs' && <LogsView />}
      {view === 'profile' && <EmployeeProfile />}
    </DashboardShell>
  );
}
