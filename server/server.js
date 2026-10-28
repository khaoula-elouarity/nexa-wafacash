const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

// Always load .env from the server folder, regardless of the current working
// directory (e.g. `node server/server.js` from the project root).
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

/* ------------------------------------------------------------------ */
/* 1. Configuration & startup validation                              */
/* ------------------------------------------------------------------ */
const PORT = 5000; // fixed for local dev so the frontend can always reach http://localhost:5000
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_SECRET_CODE = process.env.ADMIN_SECRET_CODE;
const JWT_SECRET = process.env.JWT_SECRET || 'nexa_dev_jwt_secret_change_me';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Persistent JSON "database" lives next to this file: server/data/*.json
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

// Max accepted size for a base64 profile image (kept below express.json limit).
const MAX_IMAGE_CHARS = 6 * 1024 * 1024; // ~6MB of base64 text

// Comma separated list, e.g. "http://localhost:5173,http://127.0.0.1:5173"
const ALLOWED_ORIGINS = (
  process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const FROM_EMAIL = process.env.RESEND_FROM || 'Nexa | Wafacash Management <onboarding@resend.dev>';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPLOYEE_ID_REGEX = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

if (!RESEND_API_KEY) {
  console.error('\n❌ [NEXA] RESEND_API_KEY is missing.');
  console.error('   Create server/.env and add:  RESEND_API_KEY=re_xxxxxxxxxxxxxxxx\n');
  process.exit(1);
}

console.log('🔑 [NEXA | WAFACASH] Resend API key loaded.');
console.log(`✉️  [NEXA | WAFACASH] Sending from: ${FROM_EMAIL}`);

if (!ADMIN_SECRET_CODE) {
  console.warn('⚠️  [NEXA] ADMIN_SECRET_CODE is not set — admin sign-up is disabled.');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  [NEXA] JWT_SECRET is not set — using an insecure development default.');
}

const resend = new Resend(RESEND_API_KEY);

/* ------------------------------------------------------------------ */
/* 2. Middleware                                                       */
/* ------------------------------------------------------------------ */
app.use(
  cors({
    origin(origin, callback) {
      // Allow tools without an Origin header (curl, Postman, server-to-server).
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`🚫 [NEXA CORS] Blocked origin: ${origin}`);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Raised limit so base64 profile images fit in the JSON body.
app.use(express.json({ limit: '12mb' }));

// Hide secrets / huge payloads from the console log.
function redact(body) {
  if (!body || typeof body !== 'object') return body;
  const clone = { ...body };
  for (const key of ['password', 'adminPasscode', 'otp', 'token', 'profileImage']) {
    if (key in clone) clone[key] = '***';
  }
  return clone;
}

// Request logger — every incoming request (incl. every POST) is printed.
app.use((req, _res, next) => {
  const stamp = new Date().toISOString();
  if (req.method === 'POST') {
    console.log(`⬅️  [POST] ${stamp} ${req.originalUrl}  body=${JSON.stringify(redact(req.body ?? {}))}`);
  } else {
    console.log(`➡️  ${req.method} ${stamp} ${req.originalUrl}`);
  }
  next();
});

/* ------------------------------------------------------------------ */
/* 3. Persistent JSON file store                                      */
/* ------------------------------------------------------------------ */
const users = new Map(); // normalized email -> user record
const pendingRegistrations = new Map(); // email -> pending OTP registration (ephemeral)
const logs = []; // newest first, persisted to server/data/logs.json
const transactions = []; // persisted to server/data/transactions.json

const MAX_LOG_ENTRIES = 750;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('❌ [NEXA] Could not create data directory:', error.message);
  }
}

function readJSONFile(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    console.error(`⚠️  [NEXA] Failed to read ${path.basename(file)}, using fallback:`, error.message);
    return fallback;
  }
}

function writeJSONFile(file, value) {
  ensureDataDir();
  try {
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ [NEXA] Failed to persist ${path.basename(file)}:`, error.message);
  }
}

function loadUsers() {
  const parsed = readJSONFile(USERS_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

// Write the whole collection back to disk. The dataset is small (JSON file
// store), so a synchronous write keeps things simple and durable.
function persistUsers() {
  writeJSONFile(USERS_FILE, [...users.values()]);
}

function loadLogs() {
  const parsed = readJSONFile(LOGS_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function persistLogs() {
  writeJSONFile(LOGS_FILE, logs.slice(0, MAX_LOG_ENTRIES));
}

function loadTransactions() {
  const parsed = readJSONFile(TRANSACTIONS_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function persistTransactions() {
  writeJSONFile(TRANSACTIONS_FILE, transactions);
}

/* ------------------------------------------------------------------ */
/* 4. Helpers                                                          */
/* ------------------------------------------------------------------ */
// Constant-time string comparison to avoid leaking secrets via timing.
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Password hashing with Node's built-in scrypt (no extra dependencies).
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return safeCompare(derived, hash);
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecode(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

// Minimal HS256 token (JWT-compatible) — avoids adding a jsonwebtoken dependency.
function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(
    JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS })
  );
  const data = `${header}.${body}`;
  const signature = base64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  return `${data}.${signature}`;
}

// Verify signature + expiry, returning the decoded payload (or null).
function verifyToken(token) {
  try {
    const [header, body, signature] = String(token).split('.');
    if (!header || !body || !signature) return null;
    const expected = base64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
    if (!safeCompare(signature, expected)) return null;
    const payload = JSON.parse(base64urlDecode(body));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 5. Wafacash domain model                                            */
/* ------------------------------------------------------------------ */
const ROLE_LABELS = {
  admin: 'Directeur / Head Office Manager',
  employee: "Chef d'Agence / Guichetier",
};

const POSITION_OPTIONS = {
  admin: ['Directeur / Head Office Manager', 'Responsable Back Office', 'Responsable Conformité'],
  employee: ["Chef d'Agence", 'Guichetier', 'Chargé de Clientèle', 'Agent de Transfert'],
};

function defaultDepartment(role) {
  return role === 'admin' ? 'Direction Générale' : 'Réseau Agences';
}

function defaultPosition(role) {
  return ROLE_LABELS[role] ?? ROLE_LABELS.employee;
}

function defaultAgency(role) {
  return role === 'admin' ? 'Direction Générale - Casablanca' : 'Agence Casablanca - Maarif';
}

function fallbackEmployeeId(role, id) {
  const prefix = role === 'admin' ? 'WFC-DIR' : 'WFC-AGT';
  const suffix = String(id || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  return `${prefix}-${suffix || Math.floor(1000 + Math.random() * 9000)}`;
}

function nextEmployeeId(role) {
  const prefix = role === 'admin' ? 'WFC-DIR' : 'WFC-AGT';
  let counter = 1;
  let candidate = `${prefix}-${String(counter).padStart(4, '0')}`;
  while ([...users.values()].some((user) => user.employeeId === candidate)) {
    counter += 1;
    candidate = `${prefix}-${String(counter).padStart(4, '0')}`;
  }
  return candidate;
}

function isEmployeeIdTaken(employeeId, exceptUserId = null) {
  return [...users.values()].some(
    (user) => user.employeeId === employeeId && user.id !== exceptUserId
  );
}

function normalizeUser(record = {}) {
  const role = record.role === 'admin' ? 'admin' : 'employee';
  const id = record.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const agencyLocation = String(
    record.agencyLocation || record.location || defaultAgency(role)
  ).trim();

  return {
    ...record,
    id,
    fullName: String(record.fullName || record.email?.split('@')[0] || 'Wafacash Employee').trim(),
    email: String(record.email || '').trim().toLowerCase(),
    role,
    employeeId: String(record.employeeId || record.matricule || fallbackEmployeeId(role, id))
      .trim()
      .toUpperCase(),
    position: String(record.position || record.jobTitle || defaultPosition(role)).trim(),
    agencyLocation,
    location: agencyLocation, // backward-compatible alias
    department: String(record.department || defaultDepartment(role)).trim(),
    isVerified: record.isVerified !== false,
    profileImage: record.profileImage || null,
    bio: record.bio || '',
    phone: record.phone || '',
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
  };
}

function createUserRecord({
  fullName,
  email,
  role,
  passwordHash,
  isVerified = true,
  employeeId,
  position,
  agencyLocation,
  department,
}) {
  const now = new Date().toISOString();
  const normalizedRole = role === 'admin' ? 'admin' : 'employee';
  const userId = crypto.randomUUID();

  return normalizeUser({
    id: userId,
    fullName,
    email,
    role: normalizedRole,
    passwordHash,
    isVerified,
    employeeId: employeeId || nextEmployeeId(normalizedRole),
    position: position || defaultPosition(normalizedRole),
    agencyLocation: agencyLocation || defaultAgency(normalizedRole),
    department: department || defaultDepartment(normalizedRole),
    createdAt: now,
    updatedAt: now,
  });
}

// Shape a user record for API responses (never leak passwordHash).
function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] ?? ROLE_LABELS.employee,
    position: user.position || defaultPosition(user.role),
    employeeId: user.employeeId,
    matricule: user.employeeId, // convenient alias for UI consumers
    agencyLocation: user.agencyLocation || defaultAgency(user.role),
    location: user.agencyLocation || defaultAgency(user.role),
    department: user.department || defaultDepartment(user.role),
    isVerified: Boolean(user.isVerified),
    profileImage: user.profileImage || null,
    bio: user.bio || '',
    phone: user.phone || '',
    joinedAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* 6. Audit log helpers                                                */
/* ------------------------------------------------------------------ */
function appendLog({ type = 'info', action = 'event', message = '', actor, email, meta }) {
  const entry = {
    id: crypto.randomUUID(),
    type,
    action,
    message,
    actor: actor || email || 'system',
    email: email || null,
    meta: meta || null,
    createdAt: new Date().toISOString(),
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOG_ENTRIES) logs.length = MAX_LOG_ENTRIES;
  persistLogs();
  return entry;
}

/* ------------------------------------------------------------------ */
/* 7. Auth middleware                                                  */
/* ------------------------------------------------------------------ */
// Auth middleware — resolves the bearer token into req.user.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ success: false, error: 'جلسة غير صالحة. المرجو تسجيل الدخول من جديد.' });
  }
  const payload = verifyToken(token);
  if (!payload?.email) {
    return res.status(401).json({ success: false, error: 'انتهت صلاحية الجلسة. المرجو تسجيل الدخول من جديد.' });
  }
  const user = users.get(String(payload.email).trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ success: false, error: 'لم يتم العثور على المستخدم.' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'هذه العملية متاحة للمدير فقط.' });
  }
  next();
}

/* ------------------------------------------------------------------ */
/* 8. Load persisted users + migrate + demo seed                       */
/* ------------------------------------------------------------------ */
for (const record of loadUsers()) {
  if (!record?.email) continue;
  const normalized = normalizeUser(record);
  users.set(normalized.email, normalized);
}
// Persist any migrated records (adds employeeId / agencyLocation to legacy users).
persistUsers();
console.log(`💾 [NEXA] Loaded ${users.size} user record(s) from ${USERS_FILE}`);

logs.push(...loadLogs());
console.log(`🧾 [NEXA] Loaded ${logs.length} system log(s) from ${LOGS_FILE}`);

function seedDemoUsers() {
  if (String(process.env.SEED_DEMO_USERS).toLowerCase() === 'false') return;

  const demoPassword = 'Wafacash@2026';
  const demos = [
    {
      fullName: 'Youssef El Amrani',
      email: 'directeur@wafacash.ma',
      role: 'admin',
      employeeId: 'WFC-DIR-0001',
      position: 'Directeur / Head Office Manager',
      agencyLocation: 'Direction Générale - Casablanca',
      password: demoPassword,
    },
    {
      fullName: 'Salma Bennani',
      email: 'chef.maarif@wafacash.ma',
      role: 'employee',
      employeeId: 'WFC-AGT-1042',
      position: "Chef d'Agence",
      agencyLocation: 'Agence Casablanca - Maarif',
      password: demoPassword,
    },
    {
      fullName: 'Karim Idrissi',
      email: 'guichetier@wafacash.ma',
      role: 'employee',
      employeeId: 'WFC-AGT-1043',
      position: 'Guichetier',
      agencyLocation: 'Agence Casablanca - Maarif',
      password: demoPassword,
    },
  ];

  const seeded = [];
  for (const demo of demos) {
    const email = demo.email.toLowerCase();
    if (users.has(email)) continue; // never overwrite a persisted user
    const record = createUserRecord({
      fullName: demo.fullName,
      email,
      role: demo.role,
      passwordHash: hashPassword(demo.password),
      isVerified: true,
      employeeId: demo.employeeId,
      position: demo.position,
      agencyLocation: demo.agencyLocation,
    });
    record.bio =
      demo.role === 'admin'
        ? 'Directeur réseau Wafacash — pilotage des agences et de la conformité.'
        : `${demo.position} au sein de Wafacash.`;
    users.set(email, record);
    seeded.push({ email, password: demo.password, role: demo.role });
  }

  if (seeded.length) {
    persistUsers();
    console.log('\n🌱 [NEXA | WAFACASH] Demo users seeded (set SEED_DEMO_USERS=false to disable):');
    for (const account of seeded) {
      console.log(`   ${account.role.padEnd(8)} ${account.email} / ${account.password}`);
    }
    console.log('');
  }
}

function seedTransactions() {
  if (transactions.length) return;

  const agencyNames = [...new Set([...users.values()].map((user) => user.agencyLocation).filter(Boolean))];
  const fallbackAgencies = [
    'Agence Casablanca - Maarif',
    'Agence Casablanca - Centre Ville',
    'Agence Rabat - Agdal',
    'Agence Marrakech - Gueliz',
  ];
  const agencies = agencyNames.length ? agencyNames : fallbackAgencies;
  const types = ['Versement', 'Retrait', 'Transfert', 'Paiement'];
  const statuses = ['Validée', 'Validée', 'Validée', 'En attente', 'Rejetée'];
  const employeeIds = [...users.values()]
    .filter((user) => user.role === 'employee')
    .map((user) => user.employeeId);

  let counter = 1;
  for (const agency of agencies) {
    for (let index = 0; index < 8; index += 1) {
      const createdAt = new Date(Date.now() - (index % 3) * 86400000 - index * 3600000).toISOString();
      const type = types[(index + counter) % types.length];
      const status = statuses[(index + counter) % statuses.length];
      const amount = Math.round((850 + Math.random() * 14500) * 100) / 100;

      transactions.push({
        id: crypto.randomUUID(),
        reference: `WFC-${new Date(createdAt).getFullYear()}-${String(counter).padStart(5, '0')}`,
        type,
        amount,
        currency: 'MAD',
        status,
        agencyLocation: agency,
        employeeId: employeeIds.length ? employeeIds[counter % employeeIds.length] : 'WFC-AGT-0000',
        createdAt,
      });
      counter += 1;
    }
  }

  persistTransactions();
  console.log(`💳 [NEXA] Seeded ${transactions.length} Wafacash transaction record(s).`);
}

function computeAdminStats() {
  const allUsers = [...users.values()];
  const agencies = [...new Set(allUsers.map((user) => user.agencyLocation).filter(Boolean))];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayTransactions = transactions.filter(
    (transaction) => String(transaction.createdAt || '').slice(0, 10) === todayKey
  );

  const agencyStats = agencies
    .map((agency) => {
      const members = allUsers.filter((user) => user.agencyLocation === agency);
      const agencyTransactions = transactions.filter((transaction) => transaction.agencyLocation === agency);
      return {
        agency,
        employees: members.filter((member) => member.role === 'employee').length,
        managers: members.filter((member) => member.role === 'admin').length,
        transactions: agencyTransactions.length,
        volume:
          Math.round(
            agencyTransactions.reduce((total, transaction) => total + Number(transaction.amount || 0), 0) * 100
          ) / 100,
      };
    })
    .sort((a, b) => b.transactions - a.transactions);

  return {
    employees: allUsers.filter((user) => user.role === 'employee').length,
    admins: allUsers.filter((user) => user.role === 'admin').length,
    agencies: agencies.length,
    transactionsToday: todayTransactions.length,
    volumeToday:
      Math.round(
        todayTransactions.reduce((total, transaction) => total + Number(transaction.amount || 0), 0) * 100
      ) / 100,
    totalTransactions: transactions.length,
    agencyStats,
  };
}

/* ------------------------------------------------------------------ */
/* 9. Routes                                                           */
/* ------------------------------------------------------------------ */
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    platform: 'Nexa | Wafacash Management',
    uptime: process.uptime(),
    users: users.size,
    logs: logs.length,
    transactions: transactions.length,
    from: FROM_EMAIL,
    store: USERS_FILE,
  });
});

/**
 * /api/send-otp
 *  - mode: 'login'    -> password authentication, returns a token, NO email sent.
 *  - mode: 'register' -> validates (+ admin passcode), then emails an OTP.
 */
app.post('/api/send-otp', async (req, res) => {
  const { mode, email, password, fullName, role, adminPasscode, agencyLocation } = req.body || {};
  const action = mode === 'login' ? 'login' : 'register';

  if (!email || !EMAIL_REGEX.test(String(email))) {
    console.warn('⚠️  [NEXA] /api/send-otp called with invalid email:', email);
    return res.status(400).json({ success: false, error: 'البريد الإلكتروني غير صالح.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  /* ---------------------------- LOGIN ---------------------------- */
  if (action === 'login') {
    const user = users.get(normalizedEmail);
    // Generic 401 (same message for unknown email & wrong password) to
    // prevent user enumeration.
    if (!user || !verifyPassword(password, user.passwordHash)) {
      console.warn(`🔒 [NEXA] Failed login attempt for ${normalizedEmail}`);
      appendLog({
        type: 'warning',
        action: 'login_failed',
        message: 'محاولة تسجيل دخول فاشلة.',
        email: normalizedEmail,
      });
      return res.status(401).json({ success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    appendLog({
      type: 'success',
      action: 'login',
      message: `تسجيل دخول ناجح (${user.role === 'admin' ? 'Directeur' : 'Employé'}).`,
      email: normalizedEmail,
      actor: user.fullName,
      meta: { employeeId: user.employeeId, agencyLocation: user.agencyLocation },
    });
    console.log(`✅ [NEXA] Login OK for ${normalizedEmail} (role=${user.role})`);
    return res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح!',
      token,
      user: sanitizeUser(user),
    });
  }

  /* -------------------------- REGISTER --------------------------- */
  if (!password || String(password).length < 6) {
    return res.status(400).json({ success: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });
  }

  if (users.has(normalizedEmail)) {
    return res.status(409).json({ success: false, error: 'هذا البريد الإلكتروني مسجّل بالفعل.' });
  }

  const finalRole = role === 'admin' ? 'admin' : 'employee';

  // Guard the admin registration flow with a server-side secret passcode.
  if (finalRole === 'admin') {
    if (!ADMIN_SECRET_CODE) {
      console.warn('⛔ [NEXA] Admin registration requested but ADMIN_SECRET_CODE is not configured.');
      return res
        .status(403)
        .json({ success: false, error: 'تسجيل حساب المدير غير مُفعّل على هذا الخادم.' });
    }
    if (!safeCompare(adminPasscode, ADMIN_SECRET_CODE)) {
      console.warn(`⛔ [NEXA] Admin registration with invalid passcode for ${normalizedEmail}`);
      return res.status(403).json({ success: false, error: 'كود صلاحية المدير غير صحيح.' });
    }
  }

  // Stage the registration until the email is verified.
  const otp = generateOtp();
  pendingRegistrations.set(normalizedEmail, {
    fullName: String(fullName || '').trim(),
    role: finalRole,
    agencyLocation: String(agencyLocation || '').trim() || defaultAgency(finalRole),
    passwordHash: hashPassword(password),
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  try {
    console.log(`📨 [NEXA] Sending registration OTP to ${normalizedEmail} ...`);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [normalizedEmail],
      subject: 'رمز التحقق لإنشاء حسابك في Nexa | Wafacash Management - OTP',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 25px; background: #06101f; color: #fff; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="color: #d4af37; margin-top: 0;">Nexa | Wafacash Management</h2>
          <p style="color: #94a3b8; font-size: 14px;">مرحباً ${fullName || ''}، شكراً لتسجيلك في منصة إدارة وكالات Wafacash.</p>
          <p style="color: #94a3b8; font-size: 14px;">رمز التحقق (OTP) الخاص بك هو:</p>
          <div style="background: #0b1f3a; border: 1px solid #334155; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="color: #f0c75e; font-size: 32px; font-weight: bold; letter-spacing: 8px; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 12px;">هذا الرمز صالح لمدة 5 دقائق.</p>
        </div>
      `,
    });

    // Resend does NOT throw on API errors — it returns { data, error }.
    if (error) {
      console.error('❌ [NEXA] Resend API error:', JSON.stringify(error, null, 2));
      pendingRegistrations.delete(normalizedEmail);

      const isTestingRestriction =
        error.statusCode === 403 ||
        /testing email|verify a domain|own email address|resend\.dev|domains like/i.test(
          error.message || ''
        );

      // Never echo Resend's raw message back to the client: it can contain the
      // account owner's email address. Full detail stays in the server logs.
      return res.status(502).json({
        success: false,
        error: 'فشل إرسال رمز التحقق عبر البريد الإلكتروني. المرجو المحاولة لاحقاً.',
        hint: isTestingRestriction
          ? 'وضع الاختبار: يمكنك الإرسال فقط إلى بريد مالك حساب Resend، أو فعّل نطاقاً في resend.com/domains وغيّر RESEND_FROM.'
          : undefined,
      });
    }

    console.log(`✅ [NEXA] Registration OTP emailed to ${normalizedEmail}. id=${data?.id}`);
    return res.status(200).json({
      success: true,
      otpSent: true,
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني!',
    });
  } catch (error) {
    console.error('💥 [NEXA] Unexpected error while sending OTP:', error);
    pendingRegistrations.delete(normalizedEmail);
    return res.status(500).json({
      success: false,
      error: 'حدث خطأ غير متوقع في الخادم أثناء إرسال الرمز.',
      details: error.message,
    });
  }
});

/**
 * /api/verify-otp — registration only.
 * On success the pending account is created, PERSISTED to disk, and a token returned.
 */
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body || {};

  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'البريد الإلكتروني والرمز مطلوبان.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const pending = pendingRegistrations.get(normalizedEmail);

  if (!pending) {
    return res
      .status(400)
      .json({ success: false, error: 'لم يتم العثور على طلب تسجيل لهذا البريد. المرجو البدء من جديد.' });
  }
  if (Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(normalizedEmail);
    return res.status(400).json({ success: false, error: 'انتهت صلاحية الرمز. المرجو طلب رمز جديد.' });
  }
  if (String(pending.otp) !== String(otp)) {
    console.warn(`⚠️  [NEXA] Wrong OTP for ${normalizedEmail}`);
    return res.status(400).json({ success: false, error: 'رمز التحقق غير صحيح!' });
  }

  // Activate + persist the account.
  const user = createUserRecord({
    fullName: pending.fullName,
    email: normalizedEmail,
    role: pending.role,
    passwordHash: pending.passwordHash,
    isVerified: true,
    agencyLocation: pending.agencyLocation,
  });
  users.set(normalizedEmail, user);
  pendingRegistrations.delete(normalizedEmail);
  persistUsers();
  appendLog({
    type: 'success',
    action: 'register',
    message: 'تم إنشاء حساب جديد وحفظه بشكل دائم.',
    email: normalizedEmail,
    actor: user.fullName,
    meta: { role: user.role, employeeId: user.employeeId, agencyLocation: user.agencyLocation },
  });

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  console.log(`✅ [NEXA] Account activated & persisted for ${normalizedEmail} (role=${user.role})`);

  return res.status(200).json({
    success: true,
    message: 'تم إنشاء الحساب بنجاح!',
    token,
    user: sanitizeUser(user),
  });
});

/**
 * GET /api/profile — current logged-in user profile (requires bearer token).
 */
app.get('/api/profile', authenticate, (req, res) => {
  res.json({ success: true, user: sanitizeUser(req.user) });
});

/**
 * POST /api/profile/update — update name, matricule, agency, bio, phone and
 * the cropped professional headshot, then persist the change to disk.
 */
app.post('/api/profile/update', authenticate, (req, res) => {
  const { fullName, employeeId, agencyLocation, location, department, bio, phone, profileImage, position } =
    req.body || {};
  const user = req.user;

  if (fullName !== undefined) {
    const name = String(fullName).trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'الاسم الكامل لا يمكن أن يكون فارغاً.' });
    }
    if (name.length > 120) {
      return res.status(400).json({ success: false, error: 'الاسم الكامل طويل جداً.' });
    }
    user.fullName = name;
  }

  if (employeeId !== undefined) {
    const matricule = String(employeeId).trim().toUpperCase();
    if (!EMPLOYEE_ID_REGEX.test(matricule)) {
      return res.status(400).json({
        success: false,
        error: 'رقم الموظف (Matricule) غير صالح. استعمل أحرفاً وأرقاماً وشرطات فقط.',
      });
    }
    if (isEmployeeIdTaken(matricule, user.id)) {
      return res.status(409).json({ success: false, error: 'رقم الموظف مستعمل من طرف حساب آخر.' });
    }
    user.employeeId = matricule;
  }

  const nextAgency = agencyLocation !== undefined ? agencyLocation : location;
  if (nextAgency !== undefined) {
    const agency = String(nextAgency).trim().slice(0, 120);
    if (!agency) {
      return res.status(400).json({ success: false, error: 'مكان الوكالة لا يمكن أن يكون فارغاً.' });
    }
    user.agencyLocation = agency;
    user.location = agency;
  }

  if (department !== undefined) user.department = String(department).trim().slice(0, 120);
  if (bio !== undefined) user.bio = String(bio).trim().slice(0, 600);
  if (phone !== undefined) user.phone = String(phone).trim().slice(0, 40);

  // Only head-office admins may change the job position from their own profile.
  if (position !== undefined && user.role === 'admin') {
    user.position = String(position).trim().slice(0, 120) || defaultPosition(user.role);
  }

  if (profileImage !== undefined) {
    if (profileImage === null || profileImage === '') {
      user.profileImage = null;
    } else {
      const value = String(profileImage);
      const isDataUrl = /^data:image\/(png|jpe?g);base64,/i.test(value);
      const isHttpUrl = /^https?:\/\//i.test(value);
      if (!isDataUrl && !isHttpUrl) {
        return res
          .status(400)
          .json({ success: false, error: 'صيغة الصورة غير صالحة (PNG أو JPG فقط).' });
      }
      if (value.length > MAX_IMAGE_CHARS) {
        return res.status(413).json({ success: false, error: 'حجم الصورة كبير جداً. الحد الأقصى 2MB.' });
      }
      user.profileImage = value;
    }
  }

  user.updatedAt = new Date().toISOString();
  users.set(user.email, user);
  persistUsers();
  appendLog({
    type: 'info',
    action: 'profile_update',
    message: 'تم تحديث الملف الشخصي وحفظه بشكل دائم.',
    email: user.email,
    actor: user.fullName,
    meta: { employeeId: user.employeeId, agencyLocation: user.agencyLocation },
  });

  console.log(`💾 [NEXA] Profile updated & persisted for ${user.email}`);
  return res.json({
    success: true,
    message: 'تم حفظ التغييرات بنجاح.',
    user: sanitizeUser(user),
  });
});

/**
 * GET /api/admin/employees — full employee directory (Directeur only).
 */
app.get('/api/admin/employees', authenticate, requireAdmin, (_req, res) => {
  const employees = [...users.values()]
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'fr');
    })
    .map(sanitizeUser);

  res.json({ success: true, employees, positions: POSITION_OPTIONS });
});

/**
 * POST /api/admin/employees/:id — update an employee's role, assignment or
 * matricule. Changes are persisted to users.json immediately.
 */
app.post('/api/admin/employees/:id', authenticate, requireAdmin, (req, res) => {
  const target = [...users.values()].find((user) => user.id === req.params.id);
  if (!target) {
    return res.status(404).json({ success: false, error: 'لم يتم العثور على الموظف.' });
  }

  const { fullName, employeeId, role, position, agencyLocation, department, phone, bio } =
    req.body || {};

  if (fullName !== undefined) {
    const name = String(fullName).trim();
    if (!name) return res.status(400).json({ success: false, error: 'الاسم الكامل مطلوب.' });
    target.fullName = name.slice(0, 120);
  }

  if (employeeId !== undefined) {
    const matricule = String(employeeId).trim().toUpperCase();
    if (!EMPLOYEE_ID_REGEX.test(matricule)) {
      return res.status(400).json({ success: false, error: 'رقم الموظف (Matricule) غير صالح.' });
    }
    if (isEmployeeIdTaken(matricule, target.id)) {
      return res.status(409).json({ success: false, error: 'رقم الموظف مستعمل من طرف حساب آخر.' });
    }
    target.employeeId = matricule;
  }

  if (role !== undefined) {
    const nextRole = role === 'admin' ? 'admin' : 'employee';
    if (target.id === req.user.id && nextRole !== 'admin') {
      return res.status(400).json({ success: false, error: 'لا يمكنك سحب صلاحية المدير من حسابك الحالي.' });
    }
    target.role = nextRole;
    if (position === undefined) target.position = defaultPosition(nextRole);
    if (department === undefined) target.department = defaultDepartment(nextRole);
  }

  if (position !== undefined) target.position = String(position).trim().slice(0, 120);
  if (agencyLocation !== undefined) {
    const agency = String(agencyLocation).trim().slice(0, 120);
    if (!agency) return res.status(400).json({ success: false, error: 'مكان الوكالة مطلوب.' });
    target.agencyLocation = agency;
    target.location = agency;
  }
  if (department !== undefined) target.department = String(department).trim().slice(0, 120);
  if (phone !== undefined) target.phone = String(phone).trim().slice(0, 40);
  if (bio !== undefined) target.bio = String(bio).trim().slice(0, 600);

  target.updatedAt = new Date().toISOString();
  users.set(target.email, target);
  persistUsers();
  appendLog({
    type: 'info',
    action: 'employee_update',
    message: `تم تحديث بيانات الموظف ${target.fullName}.`,
    email: target.email,
    actor: req.user.fullName,
    meta: {
      employeeId: target.employeeId,
      role: target.role,
      position: target.position,
      agencyLocation: target.agencyLocation,
    },
  });

  return res.json({
    success: true,
    message: 'تم حفظ بيانات الموظف بشكل دائم.',
    user: sanitizeUser(target),
  });
});

/**
 * GET /api/admin/stats — agency-level KPIs for the Directeur dashboard.
 */
app.get('/api/admin/stats', authenticate, requireAdmin, (_req, res) => {
  res.json({ success: true, stats: computeAdminStats() });
});

/**
 * GET /api/admin/logs — persistent system audit log (Directeur only).
 */
app.get('/api/admin/logs', authenticate, requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), MAX_LOG_ENTRIES);
  res.json({ success: true, logs: logs.slice(0, limit) });
});

/**
 * GET /api/transactions — agency transaction log.
 * Employees only see their own agency; the Directeur sees the whole network.
 */
app.get('/api/transactions', authenticate, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 300);
  let scoped = transactions;
  if (req.user.role !== 'admin') {
    scoped = transactions.filter(
      (transaction) =>
        transaction.agencyLocation === req.user.agencyLocation ||
        transaction.employeeId === req.user.employeeId
    );
  }
  const ordered = [...scoped]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);

  res.json({
    success: true,
    agency: req.user.agencyLocation,
    transactions: ordered,
  });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, error: `المسار غير موجود: ${req.method} ${req.originalUrl}` });
});

// Global error handler (e.g. CORS rejection, oversized JSON body)
app.use((err, _req, res, _next) => {
  console.error('💥 [NEXA] Global error:', err.message);
  const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
  res.status(status).json({ success: false, error: err.message });
});

/* ------------------------------------------------------------------ */
/* 10. Start                                                           */
/* ------------------------------------------------------------------ */
ensureDataDir();
seedDemoUsers();
transactions.push(...loadTransactions());
seedTransactions();

appendLog({
  type: 'system',
  action: 'server_start',
  message: 'تم تشغيل خادم Nexa | Wafacash Management.',
  actor: 'system',
});

const server = app.listen(PORT, () => {
  console.log(`🚀 [NEXA | WAFACASH] Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ') || '(none)'}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [NEXA] Port ${PORT} is already in use.`);
    console.error('   Stop the process using it, then restart:');
    console.error(`   netstat -ano | findstr :${PORT}   (then: taskkill /PID <pid> /F)\n`);
  } else {
    console.error('💥 [NEXA] Server error:', err);
  }
  process.exit(1);
});
