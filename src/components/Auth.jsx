import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import Logo, { Brand, Wordmark } from './Logo';
import { BackgroundDecor } from './ui';
import { cn, sleep } from '../lib/utils';

// Backend base URL — fixed for local dev so the frontend always reaches
// http://localhost:5000 regardless of any stray Vite env vars.
const API_BASE = 'http://localhost:5000';

async function postJSON(path, body, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

const ROLES = [
  { id: 'employee', label: 'Chef d\u2019Agence / Guichetier', short: 'موظف الوكالة', icon: User },
  { id: 'admin', label: 'Directeur / Head Office', short: 'المدير', icon: ShieldCheck },
];

const HIGHLIGHTS = [
  { icon: Building2, title: 'شبكة الوكالات', text: 'متابعة الوكالات وتوزيع الفرق' },
  { icon: BarChart3, title: 'إحصائيات الوكالة', text: 'مؤشرات المعاملات اليومية' },
  { icon: ShieldCheck, title: 'أمان مؤسسي', text: 'تحقق ثنائي وتشفير للبيانات' },
  { icon: Zap, title: 'مزامنة فورية', text: 'بيانات محفوظة بشكل دائم' },
];

function TextField({ icon: Icon, type = 'text', value, onChange, placeholder, label, endAdornment, dir }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>}
      <span className="relative block">
        <span className="pointer-events-none absolute inset-y-0 start-0 grid w-11 place-items-center text-slate-500">
          <Icon size={18} />
        </span>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          dir={dir}
          className={cn(
            'w-full rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/70 py-3 text-sm text-white outline-none transition',
            'placeholder:text-slate-600',
            'focus:border-wafa-gold-500/60 focus:bg-wafa-navy-950 focus:ring-2 focus:ring-wafa-gold-500/20',
            endAdornment ? 'ps-11 pe-11' : 'px-4 ps-11'
          )}
        />
        {endAdornment && (
          <span className="absolute inset-y-0 end-0 grid w-11 place-items-center">{endAdornment}</span>
        )}
      </span>
    </label>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden border-e border-wafa-gold-500/10 bg-gradient-to-br from-wafa-navy-900/80 via-wafa-navy-950 to-wafa-navy-900/60 p-10 lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
      <div className="pointer-events-none absolute -top-24 -end-24 h-72 w-72 rounded-full bg-wafa-gold-500/15 blur-[100px]" />

      <div className="relative">
        <Brand />
      </div>

      <div className="relative mt-16 flex flex-1 flex-col">
        <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-wafa-gold-500/30 bg-wafa-gold-500/10 px-3 py-1 text-xs font-medium text-wafa-gold-300">
          <Sparkles size={13} /> Nexa Enterprise · Wafacash
        </span>
        <Wordmark size="lg" />
        <p className="mt-6 max-w-md text-sm leading-relaxed text-slate-400">
          منصة موحّدة لإدارة وكالات Wafacash، متابعة المعاملات اليومية، وتدبير ملفات
          الموظفين بصلاحيات مدير الجهاز وموظفي الوكالات.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="glass rounded-2xl p-4 transition-colors duration-300 hover:border-wafa-gold-500/35"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-wafa-gold-500/25 bg-wafa-gold-500/10 text-wafa-gold-300">
                <Icon size={17} />
              </span>
              <p className="mt-3 text-sm font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-10 flex items-center gap-3 border-t border-wafa-gold-500/10 pt-5 text-xs text-slate-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        جميع أنظمة Wafacash تعمل بكفاءة
      </div>
    </div>
  );
}

function Captcha({ status, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={status === 'loading'}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-wafa-navy-950/60 px-4 py-3.5 text-start transition',
        status === 'verified'
          ? 'border-emerald-500/40 shadow-[0_0_18px_rgba(16,185,129,0.15)]'
          : 'border-wafa-gold-500/15 hover:border-wafa-gold-500/30'
      )}
    >
      <span
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-md border transition',
          status === 'verified'
            ? 'border-emerald-500 bg-emerald-500 text-wafa-navy-950'
            : 'border-slate-600 bg-wafa-navy-900'
        )}
      >
        {status === 'loading' && <Loader2 size={15} className="animate-spin text-wafa-gold-400" />}
        {status === 'verified' && <Check size={16} strokeWidth={3} />}
      </span>
      <span className="text-sm text-slate-300">أنا لست روبوت</span>
      <span className="ms-auto flex flex-col items-center text-[9px] leading-tight text-slate-500">
        <Fingerprint size={18} className={status === 'verified' ? 'text-emerald-400' : 'text-wafa-gold-500/70'} />
        NEXA Security
      </span>
    </button>
  );
}

function OtpStep({ email, otp, setOtp, otpRefs, onVerify, onBack, submitting, error, seconds, onResend }) {
  useEffect(() => {
    otpRefs.current[0]?.focus();
  }, [otpRefs]);

  const handleChange = (index, raw) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      setOtp((prev) => prev.map((d, i) => (i === index ? '' : d)));
      return;
    }
    setOtp((prev) => {
      const next = [...prev];
      let cursor = index;
      for (const ch of digits.split('')) {
        if (cursor > 5) break;
        next[cursor] = ch;
        cursor += 1;
      }
      return next;
    });
    otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      setOtp((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = '';
        } else if (index > 0) {
          next[index - 1] = '';
          otpRefs.current[index - 1]?.focus();
        }
        return next;
      });
    } else if (event.key === 'ArrowLeft' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    } else if (event.key === 'ArrowRight' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    const chars = digits.split('');
    setOtp((prev) => prev.map((d, i) => chars[i] ?? d));
    otpRefs.current[Math.min(chars.length, 5)]?.focus();
  };

  return (
    <form onSubmit={onVerify} className="animate-fade-up space-y-6">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-wafa-gold-500/30 bg-wafa-gold-500/10 text-wafa-gold-300 shadow-[0_0_24px_rgba(212,175,55,0.25)]">
          <KeyRound size={26} />
        </span>
        <h2 className="mt-4 text-xl font-bold text-white">تأكيد البريد الإلكتروني</h2>
        <p className="mt-1.5 text-sm text-slate-400">
          أدخل الرمز المكوّن من 6 أرقام المرسل إلى
          <br />
          <span dir="ltr" className="mt-1 inline-block font-mono font-semibold text-wafa-gold-300">
            {email}
          </span>
        </p>
      </div>

      <div dir="ltr" className="flex justify-center gap-2 sm:gap-3">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              otpRefs.current[index] = el;
            }}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            inputMode="numeric"
            maxLength={1}
            autoComplete="one-time-code"
            aria-label={`رقم ${index + 1}`}
            className={cn(
              'h-14 w-11 rounded-xl border bg-wafa-navy-950/80 text-center font-mono text-2xl font-bold text-white outline-none transition sm:h-16 sm:w-13',
              digit
                ? 'border-wafa-gold-500/70 shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                : 'border-wafa-gold-500/15 focus:border-wafa-gold-500/70 focus:shadow-[0_0_20px_rgba(212,175,55,0.35)]'
            )}
          />
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-center text-sm text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wafa-gold-500 to-wafa-gold-700 py-3 font-semibold text-wafa-navy-950 shadow-[0_0_24px_rgba(212,175,55,0.35)] transition hover:brightness-110 disabled:opacity-70"
      >
        {submitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
        {submitting ? 'جارٍ التحقق...' : 'تأكيد وإنشاء الحساب'}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={15} className="rotate-180" />
          رجوع
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={seconds > 0}
          className={cn(
            'inline-flex items-center gap-1.5 transition',
            seconds > 0 ? 'cursor-not-allowed text-slate-600' : 'text-wafa-gold-400 hover:text-wafa-gold-300'
          )}
        >
          <RefreshCw size={15} />
          {seconds > 0 ? `إعادة الإرسال (${seconds})` : 'إعادة إرسال الرمز'}
        </button>
      </div>
    </form>
  );
}

export default function Auth() {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('employee');
  const [step, setStep] = useState('credentials');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', adminPasscode: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState('idle');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [seconds, setSeconds] = useState(30);

  const otpRefs = useRef([]);

  useEffect(() => {
    if (step !== 'otp') return undefined;
    const timer = setInterval(() => setSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const updateForm = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    if (error) setError('');
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setStep('credentials');
  };

  const toggleCaptcha = async () => {
    if (captcha === 'loading') return;
    if (captcha === 'verified') {
      setCaptcha('idle');
      return;
    }
    setCaptcha('loading');
    await sleep(950);
    setCaptcha('verified');
  };

  const connectionError = (err) =>
    err.name === 'AbortError'
      ? 'انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.'
      : 'تعذّر الاتصال بالخادم. تأكد من تشغيله على http://localhost:5000.';

  /* --------------------------- LOGIN --------------------------- */
  const handleLogin = async () => {
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('المرجو إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (!form.password) {
      setError('المرجو إدخال كلمة المرور.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { ok, payload } = await postJSON('/api/send-otp', {
        mode: 'login',
        email: form.email.trim(),
        password: form.password,
      });

      if (ok && payload?.success && payload?.user) {
        // No OTP: the server verified the password. The store persists the
        // session token + full profile in localStorage.
        login({ user: payload.user, token: payload.token });
        return;
      }
      setError(payload?.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    } catch (err) {
      setError(connectionError(err));
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------- REGISTER ------------------------- */
  const handleRegister = async () => {
    if (!form.fullName.trim()) {
      setError('المرجو إدخال الاسم الكامل.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('المرجو إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (form.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    if (role === 'admin' && !form.adminPasscode.trim()) {
      setError('المرجو إدخال كود تفعيل المدير.');
      return;
    }
    if (captcha !== 'verified') {
      setError('المرجو تأكيد أنك لست روبوت لمتابعة العملية.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { ok, payload } = await postJSON('/api/send-otp', {
        mode: 'register',
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
        role,
        adminPasscode: role === 'admin' ? form.adminPasscode.trim() : undefined,
      });

      if (ok && payload?.success) {
        setSeconds(30);
        setOtp(['', '', '', '', '', '']);
        setStep('otp');
      } else {
        const base = payload?.error || 'تعذّر إرسال رمز التحقق. حاول مرة أخرى.';
        setError(payload?.hint ? `${base} — ${payload.hint}` : base);
      }
    } catch (err) {
      setError(connectionError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mode === 'login') handleLogin();
    else handleRegister();
  };

  /* ------------------------ VERIFY OTP ------------------------- */
  const handleVerify = async (event) => {
    event?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('المرجو إدخال الرمز المكوّن من 6 أرقام بالكامل.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { ok, payload } = await postJSON('/api/verify-otp', {
        email: form.email.trim(),
        otp: code,
      });

      if (ok && payload?.success && payload?.user) {
        register({ user: payload.user, token: payload.token });
        return;
      }
      setError(payload?.error || 'رمز التحقق غير صحيح!');
    } catch (err) {
      setError(connectionError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (seconds > 0 || submitting) return;
    setOtp(['', '', '', '', '', '']);
    setError('');
    setSubmitting(true);
    try {
      const { ok, payload } = await postJSON('/api/send-otp', {
        mode: 'register',
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
        role,
        adminPasscode: role === 'admin' ? form.adminPasscode.trim() : undefined,
      });
      if (ok && payload?.success) {
        setSeconds(30);
        otpRefs.current[0]?.focus();
      } else {
        setError(payload?.error || 'تعذّر إعادة إرسال الرمز.');
      }
    } catch (err) {
      setError(connectionError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
      <BackgroundDecor />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-wafa-gold-500/15 bg-wafa-navy-900/40 shadow-2xl backdrop-blur-xl lg:grid-cols-2">
        <BrandPanel />

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-6 flex flex-col items-center lg:hidden">
            <div className="flex items-center gap-3">
              <Logo size={40} />
              <Wordmark size="sm" tagline={false} />
            </div>
          </div>

          {step === 'credentials' ? (
            <div className="animate-fade-up">
              <div className="mb-6 flex gap-6 border-b border-wafa-gold-500/10">
                {[
                  { id: 'login', label: 'تسجيل الدخول' },
                  { id: 'register', label: 'إنشاء حساب' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => switchMode(tab.id)}
                    className={cn(
                      'relative -mb-px pb-3 text-sm font-semibold transition',
                      mode === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    {tab.label}
                    {mode === tab.id && (
                      <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-wafa-gold-400 to-wafa-gold-600 shadow-[0_0_12px_rgba(212,175,55,0.6)]" />
                    )}
                  </button>
                ))}
              </div>

              <h1 className="text-2xl font-bold text-white">
                {isLogin ? 'مرحباً بعودتك' : 'انضم إلى Nexa | Wafacash'}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {isLogin
                  ? 'سجّل الدخول للوصول إلى مساحة Wafacash الخاصة بك.'
                  : 'أنشئ حسابك الجديد. سيتم تأكيد بريدك الإلكتروني برمز OTP.'}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {!isLogin && (
                  <div>
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      نوع الحساب
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 p-1.5">
                      {ROLES.map((opt) => {
                        const Icon = opt.icon;
                        const active = role === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setRole(opt.id)}
                            className={cn(
                              'flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition-all duration-300',
                              active
                                ? 'bg-gradient-to-r from-wafa-gold-500 to-wafa-gold-700 text-wafa-navy-950 shadow-[0_0_20px_rgba(212,175,55,0.4)]'
                                : 'text-slate-400 hover:bg-wafa-navy-800/60 hover:text-slate-200'
                            )}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Icon size={16} />
                              {opt.short}
                            </span>
                            <span className="text-[9px] font-medium uppercase tracking-wide opacity-80">
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!isLogin && (
                  <TextField
                    icon={User}
                    label="الاسم الكامل"
                    value={form.fullName}
                    onChange={updateForm('fullName')}
                    placeholder="مثال: سلمى بناني"
                  />
                )}

                <TextField
                  icon={Mail}
                  type="email"
                  label="البريد الإلكتروني"
                  value={form.email}
                  onChange={updateForm('email')}
                  placeholder="name@wafacash.ma"
                  dir="ltr"
                />

                <TextField
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  label="كلمة المرور"
                  value={form.password}
                  onChange={updateForm('password')}
                  placeholder="••••••••"
                  dir="ltr"
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-slate-500 transition hover:text-wafa-gold-300"
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />

                {!isLogin && role === 'admin' && (
                  <TextField
                    icon={KeyRound}
                    label="كود تفعيل المدير"
                    value={form.adminPasscode}
                    onChange={updateForm('adminPasscode')}
                    placeholder="WAFACASH_ADMIN_XXXX"
                    dir="ltr"
                  />
                )}

                {!isLogin && <Captcha status={captcha} onToggle={toggleCaptcha} />}

                {error && (
                  <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wafa-gold-500 to-wafa-gold-700 py-3 font-semibold text-wafa-navy-950 shadow-[0_0_24px_rgba(212,175,55,0.35)] transition hover:brightness-110 disabled:opacity-70"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : isLogin ? (
                    <LogIn size={18} />
                  ) : null}
                  {submitting ? 'جارٍ المعالجة...' : isLogin ? 'دخول' : 'إنشاء حساب'}
                  {!submitting && !isLogin && <ArrowLeft size={18} />}
                </button>
              </form>

              {isLogin && (
                <div className="mt-5 rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/50 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
                  <p className="font-semibold text-wafa-gold-300">حسابات تجريبية</p>
                  <p dir="ltr" className="mt-1 font-mono text-slate-300">
                    directeur@wafacash.ma · Wafacash@2026
                  </p>
                  <p dir="ltr" className="font-mono text-slate-300">
                    chef.maarif@wafacash.ma · Wafacash@2026
                  </p>
                </div>
              )}

              <p className="mt-6 text-center text-xs text-slate-500">
                بالمتابعة أنت توافق على{' '}
                <span className="text-wafa-gold-400">سياسة الخصوصية</span> و{' '}
                <span className="text-wafa-gold-400">شروط الاستخدام</span>.
              </p>
            </div>
          ) : (
            <OtpStep
              email={form.email}
              otp={otp}
              setOtp={setOtp}
              otpRefs={otpRefs}
              onVerify={handleVerify}
              onBack={() => {
                setStep('credentials');
                setError('');
              }}
              submitting={submitting}
              error={error}
              seconds={seconds}
              onResend={resendCode}
            />
          )}
        </div>
      </div>
    </div>
  );
}
