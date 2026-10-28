import { cn, initials } from '../lib/utils';

/* ------------------------------------------------------------------ */
/* Decorative fixed background layers                                  */
/* ------------------------------------------------------------------ */
export function BackgroundDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute -top-40 start-[-10%] h-[32rem] w-[32rem] rounded-full bg-wafa-gold-500/8 blur-[120px]" />
      <div className="absolute top-1/3 end-[-12%] h-[30rem] w-[30rem] rounded-full bg-wafa-navy-500/20 blur-[130px]" />
      <div className="absolute bottom-[-15%] start-1/3 h-[26rem] w-[26rem] rounded-full bg-wafa-gold-400/5 blur-[120px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-wafa-navy-950/50 to-wafa-navy-950" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status badge                                                        */
/* ------------------------------------------------------------------ */
const STATUS_STYLES = {
  'مكتمل': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  'قيد الإنجاز': 'border-wafa-gold-500/30 bg-wafa-gold-500/10 text-wafa-gold-300',
  'معلق': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'متأخر': 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  'جديد': 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  'مراجعة': 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  'Validée': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  'En attente': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Rejetée': 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const DOT_STYLES = {
  'مكتمل': 'bg-emerald-400',
  'قيد الإنجاز': 'bg-wafa-gold-400',
  'معلق': 'bg-amber-400',
  'متأخر': 'bg-rose-400',
  'جديد': 'bg-blue-400',
  'مراجعة': 'bg-violet-400',
  'Validée': 'bg-emerald-400',
  'En attente': 'bg-amber-400',
  'Rejetée': 'bg-rose-400',
};

export function StatusBadge({ status, className = '' }) {
  const style = STATUS_STYLES[status] ?? 'border-slate-600/40 bg-slate-700/30 text-slate-300';
  const dot = DOT_STYLES[status] ?? 'bg-slate-400';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold',
        style,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Progress bar                                                        */
/* ------------------------------------------------------------------ */
const PROGRESS_FILL = {
  cyan: 'from-wafa-gold-400 to-wafa-gold-600',
  emerald: 'from-emerald-400 to-teal-500',
  amber: 'from-amber-400 to-orange-500',
  violet: 'from-violet-400 to-fuchsia-500',
  rose: 'from-rose-400 to-red-500',
};

export function ProgressBar({ value = 0, tone = 'cyan', className = '', showLabel = true }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-wafa-navy-800/80">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(212,175,55,0.4)] transition-all duration-700 ease-out',
            PROGRESS_FILL[tone] ?? PROGRESS_FILL.cyan
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-10 text-end font-mono text-xs tabular-nums text-slate-400">{width}%</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */
const STAT_TONES = {
  cyan: 'border-wafa-gold-500/25 bg-wafa-gold-500/10 text-wafa-gold-300',
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
  blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
};

export function StatCard({ icon: Icon, label, value, delta, tone = 'cyan', trend = 'up' }) {
  return (
    <div className="group glass relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:border-wafa-gold-500/35 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]">
      <div className="pointer-events-none absolute -end-6 -top-6 h-20 w-20 rounded-full bg-wafa-gold-500/5 blur-2xl transition-opacity duration-300 group-hover:bg-wafa-gold-500/10" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">{value}</p>
          {delta != null && (
            <p
              className={cn(
                'mt-2 text-xs font-medium',
                trend === 'up' ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {trend === 'up' ? '▲' : '▼'} {delta}
            </p>
          )}
        </div>
        <span className={cn('grid h-11 w-11 place-items-center rounded-xl border', STAT_TONES[tone] ?? STAT_TONES.cyan)}>
          {Icon && <Icon size={20} />}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */
const AVATAR_GRADIENTS = [
  'from-wafa-gold-500 to-wafa-gold-700',
  'from-wafa-navy-500 to-wafa-navy-700',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-sky-500 to-indigo-600',
];

export function Avatar({ name = '', src = null, size = 40, className = '' }) {
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const gradient = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-wafa-navy-900',
        !src && gradient,
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      title={name}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'الصورة الشخصية'}
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(name) || '؟'
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Recharts custom tooltip                                             */
/* ------------------------------------------------------------------ */
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3.5 py-2.5 text-xs shadow-2xl">
      {label != null && <p className="mb-1.5 font-semibold text-slate-200">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color ?? entry.fill }}
            />
            <span className="text-slate-400">{entry.name}</span>
            <span className="ms-auto font-mono font-semibold tabular-nums text-white">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionHeading({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-wafa-gold-500/25 bg-wafa-gold-500/10 text-wafa-gold-300">
            <Icon size={18} />
          </span>
        )}
        <div>
          <h2 className="text-base font-bold text-white sm:text-lg">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
