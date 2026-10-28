import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  Crop,
  Info,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from './ui';
import { cn, initials } from '../lib/utils';

/* ------------------------------------------------------------------ */
/* Validation rules                                                    */
/* ------------------------------------------------------------------ */
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPT_ATTR = '.png,.jpg,.jpeg,image/png,image/jpeg';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_EXT = /\.(png|jpe?g)$/i;
const OUTPUT_SIZE = 512; // exported headshot is a square 512×512
const MATRICULE_REGEX = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

const ROLE_LABELS = {
  admin: 'Directeur / Head Office Manager',
  employee: "Chef d'Agence / Guichetier",
};

const EMPLOYMENT_FIELDS = [
  {
    key: 'employeeId',
    label: 'رقم الموظف (Matricule)',
    icon: BadgeCheck,
    placeholder: 'WFC-AGT-1042',
    dir: 'ltr',
  },
  {
    key: 'agencyLocation',
    label: 'الوكالة / Agency Location',
    icon: Building2,
    placeholder: 'Agence Casablanca - Maarif',
  },
  { key: 'phone', label: 'الهاتف', icon: Phone, placeholder: '+212 6 12 34 56 78', dir: 'ltr' },
];

/* ------------------------------------------------------------------ */
/* Toast system (self-contained — no extra dependency)                 */
/* ------------------------------------------------------------------ */
const TOAST_STYLES = {
  success: { tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', Icon: CheckCircle2 },
  warning: { tone: 'border-amber-500/40 bg-amber-500/10 text-amber-300', Icon: AlertTriangle },
  error: { tone: 'border-rose-500/40 bg-rose-500/10 text-rose-300', Icon: XCircle },
  info: { tone: 'border-wafa-gold-500/40 bg-wafa-gold-500/10 text-wafa-gold-300', Icon: Info },
};

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    ({ variant = 'info', title, message, duration = 4200 }) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((list) => [...list, { id, variant, title, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
    },
    [dismiss]
  );

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  return { toasts, push, dismiss };
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2.5 px-4 sm:inset-x-auto sm:bottom-6 sm:end-6 sm:items-end">
      {toasts.map(({ id, variant, title, message }) => {
        const { tone, Icon } = TOAST_STYLES[variant] ?? TOAST_STYLES.info;
        return (
          <div
            key={id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl',
              tone
            )}
          >
            <Icon size={19} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{title}</p>
              {message && <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{message}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(id)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="إغلاق الإشعار"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Photo cropper — square 1:1 frame with circular / rounded guides     */
/* ------------------------------------------------------------------ */
function PhotoCropper({ image, onCancel, onApply }) {
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  const [boxSize, setBoxSize] = useState(300);
  const [natural, setNatural] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [shape, setShape] = useState('circle');

  // Measure the crop frame so the on-screen transform matches the export math.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setBoxSize(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Read natural dimensions of the selected image.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = image;
  }, [image]);

  // Lock background scroll + close on Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  const fit = natural ? Math.max(boxSize / natural.w, boxSize / natural.h) : 1;
  const displayW = natural ? natural.w * fit * zoom : boxSize;
  const displayH = natural ? natural.h * fit * zoom : boxSize;

  const clampOffset = useCallback(
    (next) => {
      const maxX = Math.max(0, (displayW - boxSize) / 2);
      const maxY = Math.max(0, (displayH - boxSize) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [displayW, displayH, boxSize]
  );

  // Derive the clamped offset during render so zoom changes stay in bounds
  // without a state-syncing effect.
  const safeOffset = clampOffset(offset);

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: safeOffset.x,
      originY: safeOffset.y,
    };
  };

  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    setOffset(
      clampOffset({
        x: dragRef.current.originX + (event.clientX - dragRef.current.startX),
        y: dragRef.current.originY + (event.clientY - dragRef.current.startY),
      })
    );
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const runExport = () => {
    const node = imgRef.current;
    if (!node || !natural) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Map the visible crop frame (boxSize × boxSize) back to source pixels.
    const scale = fit * zoom;
    const sourceSize = boxSize / scale;
    const sourceX = natural.w / 2 - (boxSize / 2 + safeOffset.x) / scale;
    const sourceY = natural.h / 2 - (boxSize / 2 + safeOffset.y) / scale;

    ctx.drawImage(node, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    onApply(canvas.toDataURL('image/jpeg', 0.92));
  };

  const zoomPercent = Math.round(((zoom - 1) / 2) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-wafa-navy-950/85 p-4 backdrop-blur-md"
      onClick={onCancel}
    >
      <div
        className="glass-strong w-full max-w-md animate-fade-up rounded-3xl p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-wafa-gold-500/25 bg-wafa-gold-500/10 text-wafa-gold-300">
              <Crop size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">ضبط الصورة الشخصية</h3>
              <p className="text-[11px] text-slate-400">قص مربّع 1:1 — صورة رسمية أوضح</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-wafa-navy-800 hover:text-white"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Crop frame */}
        <div className="mt-5 flex justify-center">
          <div
            ref={boxRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="relative aspect-square w-full max-w-[300px] cursor-grab touch-none overflow-hidden rounded-2xl border border-wafa-gold-500/20 bg-wafa-navy-950 active:cursor-grabbing"
            style={{ backgroundImage: 'linear-gradient(45deg, #081426 25%, transparent 25%, transparent 75%, #081426 75%), linear-gradient(45deg, #081426 25%, transparent 25%, transparent 75%, #081426 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}
          >
            <img
              ref={imgRef}
              src={image}
              alt="معاينة الصورة"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: displayW,
                height: displayH,
                transform: `translate(-50%, -50%) translate(${safeOffset.x}px, ${safeOffset.y}px)`,
              }}
            />

            {/* Visual guides + outside dimming */}
            <div className="pointer-events-none absolute inset-0">
              {shape === 'circle' ? (
                <div className="absolute inset-0 rounded-full border-2 border-white/85 shadow-[0_0_0_9999px_rgba(5,13,28,0.68)]" />
              ) : (
                <div className="absolute inset-0 rounded-3xl border-2 border-white/85 shadow-[0_0_0_9999px_rgba(5,13,28,0.68)]" />
              )}
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
              <span className="absolute left-2 top-2 h-4 w-4 rounded-tl-md border-l-2 border-t-2 border-wafa-gold-400" />
              <span className="absolute right-2 top-2 h-4 w-4 rounded-tr-md border-r-2 border-t-2 border-wafa-gold-400" />
              <span className="absolute bottom-2 left-2 h-4 w-4 rounded-bl-md border-b-2 border-l-2 border-wafa-gold-400" />
              <span className="absolute bottom-2 right-2 h-4 w-4 rounded-br-md border-b-2 border-r-2 border-wafa-gold-400" />
            </div>
          </div>
        </div>

        {/* Shape toggle */}
        <div className="mt-5 flex items-center justify-center">
          <div className="inline-flex gap-1 rounded-2xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 p-1">
            {[
              { id: 'circle', label: 'دائري' },
              { id: 'square', label: 'بطاقة' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setShape(option.id)}
                className={cn(
                  'rounded-xl px-4 py-1.5 text-xs font-semibold transition',
                  shape === option.id
                    ? 'bg-gradient-to-r from-wafa-gold-500 to-wafa-gold-700 text-wafa-navy-950'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom control */}
        <div className="mt-4 flex items-center gap-3">
          <ZoomOut size={16} className="shrink-0 text-slate-500" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-wafa-navy-800 accent-wafa-gold-500"
            aria-label="تكبير الصورة"
          />
          <ZoomIn size={16} className="shrink-0 text-slate-500" />
          <span className="w-10 shrink-0 text-end font-mono text-xs tabular-nums text-slate-400">
            {zoomPercent}%
          </span>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/60 px-3.5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-wafa-gold-500/40 hover:text-white"
          >
            <RotateCcw size={15} />
            إعادة ضبط
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-wafa-gold-500/15 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-wafa-navy-800 hover:text-white"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={runExport}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-wafa-gold-500 to-wafa-gold-700 px-4 py-2.5 text-sm font-semibold text-wafa-navy-950 shadow-[0_0_20px_rgba(212,175,55,0.35)] transition hover:brightness-110"
            >
              <CheckCircle2 size={16} />
              تطبيق الصورة
            </button>
          </div>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Info size={12} />
          اسحب الصورة لتحريكها واستخدم شريط التكبير للتقريب. الصورة النهائية بنسبة 1:1.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
function Panel({ children, className = '' }) {
  return <div className={cn('glass rounded-2xl p-5 sm:p-6', className)}>{children}</div>;
}

function Field({ label, icon: Icon, error, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {Icon && <Icon size={13} />}
        {label}
      </span>
      <input
        {...props}
        className={cn(
          'w-full rounded-xl border bg-wafa-navy-950/70 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600',
          'focus:border-wafa-gold-500/60 focus:ring-2 focus:ring-wafa-gold-500/20',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-rose-500/50' : 'border-wafa-gold-500/15'
        )}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Employee Profile page                                               */
/* ------------------------------------------------------------------ */
export default function EmployeeProfile() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const saveProfile = useAuthStore((s) => s.saveProfile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const { toasts, push, dismiss } = useToasts();
  const fileInputRef = useRef(null);
  const initializedFor = useRef(null);

  const [draft, setDraft] = useState({
    fullName: '',
    employeeId: '',
    agencyLocation: '',
    phone: '',
    bio: '',
    photo: null,
  });
  const [cropperImage, setCropperImage] = useState(null);
  const [saving, setSaving] = useState(false);

  // Pull the freshest profile from the server when the page opens.
  useEffect(() => {
    if (token) fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Seed the form once per user id (optimistic photo updates must not wipe edits).
  useEffect(() => {
    if (user && initializedFor.current !== user.id) {
      initializedFor.current = user.id;
      setDraft({
        fullName: user.fullName || '',
        employeeId: user.employeeId || '',
        agencyLocation: user.agencyLocation || user.location || '',
        phone: user.phone || '',
        bio: user.bio || '',
        photo: user.photo || null,
      });
    }
  }, [user]);

  const updateDraft = (key) => (event) =>
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  /* ----------------------- Photo handling ----------------------- */
  const openFilePicker = () => fileInputRef.current?.click();

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    const isImage = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXT.test(file.name || '');
    if (!isImage) {
      push({
        variant: 'warning',
        title: 'صيغة غير مدعومة',
        message: 'الصيغ المسموح بها هي PNG أو JPG أو JPEG فقط.',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      push({
        variant: 'warning',
        title: 'حجم الملف كبير جداً',
        message: `الحجم الحالي ${(file.size / 1024 / 1024).toFixed(2)}MB — الحد الأقصى 2MB. المرجو اختيار صورة أصغر.`,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCropperImage(String(reader.result));
    reader.onerror = () =>
      push({ variant: 'error', title: 'تعذّر قراءة الملف', message: 'حدث خطأ أثناء تحميل الصورة.' });
    reader.readAsDataURL(file);
  };

  // Apply the cropped result locally for instant reflection; persisted on Save.
  const handleApplyPhoto = (dataUrl) => {
    setDraft((prev) => ({ ...prev, photo: dataUrl }));
    updateUser({ photo: dataUrl });
    setCropperImage(null);
    push({
      variant: 'info',
      title: 'تم تطبيق الصورة',
      message: 'اضغط «حفظ التغييرات» لتثبيتها بشكل دائم في حسابك.',
    });
  };

  const handleRemovePhoto = () => {
    setDraft((prev) => ({ ...prev, photo: null }));
    updateUser({ photo: null });
    push({ variant: 'info', title: 'تمت إزالة الصورة', message: 'اضغط «حفظ التغييرات» لتأكيد الإزالة.' });
  };

  /* ----------------------- Save changes ----------------------- */
  const handleSave = async (event) => {
    event.preventDefault();

    if (!draft.fullName.trim()) {
      push({ variant: 'warning', title: 'الاسم مطلوب', message: 'المرجو إدخال الاسم الكامل.' });
      return;
    }
    if (!MATRICULE_REGEX.test(draft.employeeId.trim().toUpperCase())) {
      push({
        variant: 'warning',
        title: 'رقم الموظف غير صالح',
        message: 'استعمل صيغة مثل WFC-AGT-1042 (أحرف، أرقام وشرطات فقط).',
      });
      return;
    }
    if (!draft.agencyLocation.trim()) {
      push({ variant: 'warning', title: 'الوكالة مطلوبة', message: 'المرجو إدخال وكالة الموظف.' });
      return;
    }

    setSaving(true);
    try {
      await saveProfile({
        fullName: draft.fullName.trim(),
        employeeId: draft.employeeId.trim().toUpperCase(),
        agencyLocation: draft.agencyLocation.trim(),
        bio: draft.bio.trim(),
        phone: draft.phone.trim(),
        profileImage: draft.photo,
      });
      push({
        variant: 'success',
        title: 'تم حفظ التغييرات',
        message: 'تم حفظ بياناتك بشكل دائم في قاعدة بيانات Wafacash.',
      });
    } catch (error) {
      if (error.reason === 'no-token') {
        push({ variant: 'error', title: 'غير مصرّح', message: 'المرجو تسجيل الدخول من جديد.' });
      } else if (error.reason === 'unauthorized') {
        push({ variant: 'error', title: 'انتهت الجلسة', message: 'انتهت صلاحية الجلسة. المرجو تسجيل الدخول من جديد.' });
      } else {
        push({
          variant: 'error',
          title: 'تعذّر الحفظ',
          message: error.message || 'تعذّر الاتصال بالخادم. تأكد من تشغيله من جديد.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role] ?? ROLE_LABELS.employee;
  const isVerified = user.isVerified !== false;
  const activePhoto = draft.photo || user.photo;
  const displayPosition = user.position || roleLabel;

  return (
    <>
      <div className="space-y-6">
        {/* -------------------- Profile overview -------------------- */}
        <Panel className="relative overflow-hidden">
          <div className="pointer-events-none absolute -end-10 -top-12 h-52 w-52 rounded-full bg-wafa-gold-500/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-start">
            <div className="relative shrink-0">
              {activePhoto ? (
                <Avatar name={user.fullName} src={activePhoto} size={104} />
              ) : (
                <span className="grid h-[104px] w-[104px] place-items-center rounded-full bg-gradient-to-br from-wafa-gold-500 to-wafa-gold-700 text-3xl font-bold text-wafa-navy-950 ring-2 ring-wafa-navy-900">
                  {initials(user.fullName) || '؟'}
                </span>
              )}
              <button
                type="button"
                onClick={openFilePicker}
                title="تغيير الصورة"
                className="absolute -bottom-1 -start-1 grid h-10 w-10 place-items-center rounded-full border-4 border-wafa-navy-950 bg-wafa-gold-500 text-wafa-navy-950 shadow-lg transition hover:bg-wafa-gold-400"
                aria-label="تغيير الصورة"
              >
                <Camera size={17} />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
                <h2 className="truncate text-xl font-bold text-white sm:text-2xl">{user.fullName}</h2>
                {isVerified && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    <BadgeCheck size={14} />
                    حساب موثق
                  </span>
                )}
              </div>
              <p dir="ltr" className="mt-1.5 truncate font-mono text-sm text-slate-400">
                {user.email}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2.5 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/50 px-3.5 py-2 text-xs font-medium text-slate-300">
                  <Briefcase size={14} className="text-wafa-gold-300" />
                  {displayPosition}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/50 px-3.5 py-2 text-xs font-medium text-slate-300">
                  <BadgeCheck size={14} className="text-wafa-gold-300" />
                  {user.employeeId || '—'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/50 px-3.5 py-2 text-xs font-medium text-slate-300">
                  <MapPin size={14} className="text-wafa-gold-300" />
                  {user.agencyLocation || 'Wafacash'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/50 px-3.5 py-2 text-xs font-medium text-slate-300">
                  <Mail size={14} className="text-wafa-gold-300" />
                  عضو منذ {new Date(user.joinedAt).toLocaleDateString('fr-MA')}
                </span>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* -------------------- Photo upload -------------------- */}
          <Panel className="lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-wafa-gold-500/25 bg-wafa-gold-500/10 text-wafa-gold-300">
                <Camera size={18} />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">الصورة الشخصية</h3>
                <p className="text-xs text-slate-400">Professional headshot · 1:1</p>
              </div>
            </div>

            <div className="mt-5 flex justify-center">
              {activePhoto ? (
                <img
                  src={activePhoto}
                  alt="الصورة الشخصية"
                  className="h-40 w-40 rounded-2xl object-cover ring-2 ring-wafa-gold-500/30"
                />
              ) : (
                <div className="grid h-40 w-40 place-items-center rounded-2xl border-2 border-dashed border-wafa-gold-500/25 bg-wafa-navy-950/50 text-slate-600">
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={26} />
                    <span className="text-xs">لا توجد صورة</span>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              onChange={handleFile}
              className="sr-only"
            />

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                onClick={openFilePicker}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wafa-gold-500 to-wafa-gold-700 py-2.5 text-sm font-semibold text-wafa-navy-950 shadow-[0_0_20px_rgba(212,175,55,0.3)] transition hover:brightness-110"
              >
                <Upload size={16} />
                {activePhoto ? 'تغيير الصورة' : 'رفع صورة'}
              </button>
              {activePhoto && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10"
                >
                  <Trash2 size={16} />
                  إزالة الصورة
                </button>
              )}
            </div>

            <ul className="mt-5 space-y-2 border-t border-wafa-gold-500/10 pt-4 text-[11px] text-slate-500">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400" /> الصيغ المدعومة: PNG, JPG, JPEG
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400" /> الحد الأقصى للحجم: 2 ميجابايت
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400" /> حفظ دائم في server/data/users.json
              </li>
            </ul>
          </Panel>

          {/* -------------------- Editable details -------------------- */}
          <Panel className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-wafa-gold-500/25 bg-wafa-gold-500/10 text-wafa-gold-300">
                <Save size={18} />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">بيانات الموظف</h3>
                <p className="text-xs text-slate-400">حدّث بياناتك ثم احفظ التغييرات</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="الاسم الكامل / Full Name"
                  icon={BadgeCheck}
                  value={draft.fullName}
                  onChange={updateDraft('fullName')}
                  placeholder="مثال: سلمى بناني"
                />
                <Field
                  label="البريد الإلكتروني"
                  icon={Mail}
                  type="email"
                  dir="ltr"
                  value={user.email}
                  disabled
                  title="لا يمكن تغيير البريد الإلكتروني"
                />
                {EMPLOYMENT_FIELDS.map(({ key, label, icon, placeholder, dir }) => (
                  <Field
                    key={key}
                    label={label}
                    icon={icon}
                    dir={dir}
                    value={draft[key]}
                    onChange={updateDraft(key)}
                    placeholder={placeholder}
                  />
                ))}
                <Field
                  label="الدور / Rôle"
                  icon={Briefcase}
                  value={displayPosition}
                  disabled
                  title="يتم تدبير الدور من طرف الإدارة"
                />
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">نبذة تعريفية</span>
                <textarea
                  rows={3}
                  value={draft.bio}
                  onChange={updateDraft('bio')}
                  placeholder="اكتب نبذة قصيرة عن خبرتك ودورك في وكالة Wafacash..."
                  className="w-full resize-none rounded-xl border border-wafa-gold-500/15 bg-wafa-navy-950/70 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-wafa-gold-500/60 focus:ring-2 focus:ring-wafa-gold-500/20"
                />
              </label>

              <div className="flex flex-col-reverse items-stretch gap-3 border-t border-wafa-gold-500/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-slate-500">
                  يتم حفظ التغييرات نهائياً في قاعدة بيانات Wafacash وتبقى بعد تسجيل الخروج وإعادة التشغيل.
                </p>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-wafa-gold-300">
                    <BadgeCheck size={14} />
                    {roleLabel}
                  </span>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wafa-gold-500 to-wafa-gold-700 px-5 py-2.5 text-sm font-semibold text-wafa-navy-950 shadow-[0_0_20px_rgba(212,175,55,0.35)] transition hover:brightness-110 disabled:opacity-70"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                  </button>
                </div>
              </div>
            </form>
          </Panel>
        </div>
      </div>

      {cropperImage && (
        <PhotoCropper
          image={cropperImage}
          onCancel={() => setCropperImage(null)}
          onApply={handleApplyPhoto}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
