const crypto = require('node:crypto');
const { ROLES } = require('../services/policies');
const { cleanText } = require('../services/firestore');
const cookieName = 'helpdesk_session';
const secret = process.env.CSRF_SECRET || crypto.randomBytes(48).toString('hex');

function cookieValue(req, name) {
  const cookie = (req.headers.cookie || '').split('; ').find(x => x.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}
function sessionCsrf(session) {
  return crypto.createHmac('sha256', secret).update(session).digest('hex');
}
function validCsrf(req) {
  const cookie = cookieValue(req, cookieName);
  const a = Buffer.from(req.body?._csrf || '', 'utf8');
  const b = Buffer.from(cookie ? sessionCsrf(cookie) : '', 'utf8');
  return a.length === b.length && b.length > 0 && crypto.timingSafeEqual(a, b);
}
function sameOrigin(req, res, next) {
  // Rejeita escritas cross-site, inclusive a criação/limpeza de sessão.
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const src = origin || referer;
  const host = req.get('X-Forwarded-Host') || req.get('Host');
  const proto = req.get('X-Forwarded-Proto') || req.protocol;
  try {
    if (!src || new URL(src).origin !== `${proto}://${host}`) return res.status(403).send('Origem inválida. Recarregue a página e tente novamente.');
  } catch { return res.status(403).send('Origem inválida.'); }
  next();
}
function csrf(req, res, next) {
  if (!validCsrf(req)) return res.status(403).send('Sessão de formulário inválida. Recarregue a página.');
  next();
}
function requireRoles(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.currentUser.perfil)) {
      return next();
    }

    return res.status(403).render('error', {
      title: 'Acesso negado',
      error: {
        status: 403,
        message: 'Seu perfil não tem permissão para esta ação.'
      }
    });
  };
}
function setSessionCookie(res, session) {
  res.cookie(cookieName, session, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 5 * 864e5 });
}
function clearSessionCookie(res) {
  res.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
}
function buildAuthMiddleware(firebase) {
  return async (req, res, next) => {
    const session = cookieValue(req, cookieName);
    if (!session) return res.redirect('/login');
    try {
      // O perfil vem SEMPRE do banco, a cada requisição, nunca do formulário/token.
      const decoded = await firebase.auth.verifySessionCookie(session, true);
      const doc = await firebase.db.collection('usuarios').doc(decoded.uid).get();
      if (!doc.exists || !ROLES.includes(doc.data().perfil)) throw new Error('Conta sem perfil válido.');
      req.currentUser = { ...doc.data(), uid: decoded.uid, email: decoded.email || doc.data().email }; 
      res.locals.currentUser = req.currentUser;
      res.locals.csrfToken = sessionCsrf(session);
      next();
    } catch (err) {
      clearSessionCookie(res);
      return res.redirect('/login?erro=sessao');
    }
  };
}
async function ensureProfile(db, decoded, providedName = '') {
  const ref = db.collection('usuarios').doc(decoded.uid);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      const nome = cleanText(decoded.name || providedName || decoded.email?.split('@')[0] || 'Usuário', 100);
      tx.create(ref, { uid: decoded.uid, nome, email: decoded.email || '', perfil: 'user', criadoEm: new Date().toISOString() });
    }
  });
  return (await ref.get()).data();
}
module.exports = { cookieName, cookieValue, sessionCsrf, sameOrigin, csrf, requireRoles, setSessionCookie, clearSessionCookie, buildAuthMiddleware, ensureProfile };
