import { useId } from 'react';
import { cn } from '../lib/utils';

/**
 * Wafacash-styled "N" mark: corporate navy tile with a gold node / connection
 * point, matching the client's financial-services identity.
 */
export default function Logo({ size = 44, withTile = true, className = '' }) {
  const raw = useId();
  const gid = raw.replace(/[:]/g, '');
  const gradient = `url(#${gid}-n)`;

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="pointer-events-none absolute inset-0 rounded-2xl bg-wafa-gold-500/25 blur-xl" />
      <span
        className={cn(
          'relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl',
          withTile &&
            'border border-wafa-gold-500/35 bg-gradient-to-br from-wafa-navy-900 via-wafa-navy-950 to-wafa-navy-900 shadow-[0_0_24px_rgba(212,175,55,0.3)]'
        )}
      >
        {withTile && (
          <span className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-wafa-gold-400/18 to-transparent" />
        )}
        <svg viewBox="0 0 48 48" className="relative h-[64%] w-[64%] overflow-visible" fill="none">
          <defs>
            <linearGradient id={`${gid}-n`} x1="11" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fde68a" />
              <stop offset="0.5" stopColor="#e9c46a" />
              <stop offset="1" stopColor="#b8860b" />
            </linearGradient>
          </defs>
          <path
            d="M13 37V13l22 22V13"
            stroke={gradient}
            strokeWidth="4.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="35" cy="13" r="3.6" fill="#fde68a" />
          <circle cx="35" cy="13" r="7" stroke="#e9c46a" strokeOpacity="0.5" strokeWidth="1.4" />
          <circle cx="13" cy="37" r="2.1" fill="#fcd34d" />
        </svg>
      </span>
    </span>
  );
}

const WORDSIZES = {
  sm: { nexa: 'text-2xl', platform: 'text-[10px]', tag: 'text-[11px]' },
  md: { nexa: 'text-4xl', platform: 'text-xs', tag: 'text-sm' },
  lg: { nexa: 'text-5xl sm:text-6xl', platform: 'text-sm', tag: 'text-base' },
};

export function Wordmark({ size = 'md', tagline = true, className = '' }) {
  const s = WORDSIZES[size] ?? WORDSIZES.md;
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1" dir="ltr">
        <span
          className={cn(
            'bg-gradient-to-r from-wafa-gold-200 via-wafa-gold-400 to-wafa-gold-600 bg-clip-text font-display font-black uppercase tracking-[0.28em] text-transparent',
            s.nexa
          )}
        >
          NEXA
        </span>
        <span className={cn('font-sans font-light text-slate-500', s.nexa, 'text-[0.55em]')}>|</span>
        <span className={cn('font-sans font-semibold uppercase tracking-[0.18em] text-slate-200', s.nexa, 'text-[0.55em]')}>
          Wafacash Management
        </span>
      </div>
      {tagline && (
        <p className={cn('mt-3 font-arabic font-medium text-slate-400', s.tag)}>
          إدارة وكالات وعمليات Wafacash — Nexa Enterprise
        </p>
      )}
    </div>
  );
}

export function Brand({ logoSize = 42, className = '' }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Logo size={logoSize} />
      <div className="flex flex-col leading-none" dir="ltr">
        <span className="bg-gradient-to-r from-wafa-gold-200 to-wafa-gold-500 bg-clip-text font-display text-base font-black uppercase tracking-[0.22em] text-transparent">
          NEXA <span className="text-slate-600">|</span> WAFACASH
        </span>
        <span className="mt-1 font-sans text-[9px] font-medium uppercase tracking-[0.34em] text-slate-400">
          Management
        </span>
      </div>
    </div>
  );
}
