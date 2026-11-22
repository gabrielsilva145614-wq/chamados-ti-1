const express = require('express');
const { sameOrigin, csrf, requireRoles, setSessionCookie, clearSessionCookie, buildAuthMiddleware, ensureProfile } = require('../middlewares/auth');
const { CATEGORIES, PRIORITIES, STATUSES, canAttend, canView } = require('../services/policies');
const { validateTicket, listTickets, getTicket, cleanText } = require('../services/firestore');

const send = (res, path, kind, value) => res.redirect(`${path}?${kind}=${encodeURIComponent(value)}`);
const run = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);

function buildRoutes({ db, auth, admin }) {
  const router = express.Router();
  router.get('/health', (req, res) => res.status(200).json({ ok: true }));
  router.get(['/login', '/login.html'], (req, res) => res.render('login', { title: 'Entrar' }));
  router.post('/auth/session', sameOrigin, run(async (req, res) => {
    const { idToken, nome } = req.body || {};
    if (!idToken || typeof idToken !== 'string') return res.status(400).json({ error: 'Token inválido.' });
    try {
      const decoded = await auth.verifyIdToken(idToken, true);
      if (Date.now() / 1000 - decoded.auth_time > 5 * 60) return res.status(401).json({ error: 'Faça login novamente para renovar sua autenticação.' });
      await ensureProfile(db, decoded, nome);
      const session = await auth.createSessionCookie(idToken, { expiresIn: 5 * 864e5 });
      setSessionCookie(res, session);
      res.json({ ok: true, redirect: '/' });
    } catch (err) {
      console.error('Erro no login:', err.code || err.message);
      res.status(401).json({ error: 'Não foi possível confirmar o login. Tente novamente.' });
    }
  }));
  router.post('/auth/logout', sameOrigin, (req, res) => { clearSessionCookie(res); res.redirect('/login?logout=1'); });
  router.use(buildAuthMiddleware({ db, auth }));
  router.use((req, res, next) => { res.locals.canAttend = canAttend(req.currentUser.perfil); res.locals.isAdmin = req.currentUser.perfil === 'admin'; next(); });
  router.use((req, res, next) => req.method === 'GET' ? next() : sameOrigin(req, res, () => csrf(req, res, next)));

  router.get('/', run(async (req, res) => {
    const tickets = await listTickets(db, req.currentUser);
    const total = tickets.length;
    const counts = Object.fromEntries(STATUSES.map(status => [status, tickets.filter(t => t.status === status).length]));
    res.render('dashboard', { title: 'Dashboard', total, counts, recentes: tickets.slice(0, 8) });
  }));
  router.get('/tickets', run(async (req, res) => {
    const all = await listTickets(db, req.currentUser);
    const q = cleanText(req.query.q, 120).toLowerCase();
    const status = STATUSES.includes(req.query.status) ? req.query.status : '';
    const tickets = all.filter(t => (!status || status === t.status) && (!q || [t.titulo, t.descricao, t.autorNome, t.protocolo].some(s => String(s || '').toLowerCase().includes(q))));
    res.render('tickets/index', { title: 'Chamados', tickets, filtros: { q, status } });
  }));
  router.get('/tickets/new', (req, res) => res.render('tickets/form', { title: 'Novo chamado', ticket: {}, errors: [], isEdit: false }));
  router.post('/tickets', run(async (req, res) => {
    const fields = validateTicket(req.body);
    const u = req.currentUser;
    const now = new Date().toISOString();
    const ticket = {
      ...fields, autorUid: u.uid, autorNome: u.nome, autorEmail: u.email,
      status: 'Aberto', tecnicoResponsavel: null, tecnicoUid: null, parecerTecnico: '',
      criadoEm: now, atualizadoEm: now,
      historico: [{ autorUid: u.uid, autorNome: u.nome, tipo: 'sistema', texto: 'Chamado aberto.', data: now }],
    };
    const ref = await db.collection('chamados').add(ticket);
    send(res, `/tickets/${ref.id}`, 'msg', 'Chamado aberto com sucesso!');
  }));

  const viewTicket = run(async (req, res, next) => {
    const ticket = await getTicket(db, req.params.id);
    // Para usuário comum, não revela existência de chamados de terceiros.
    if (!ticket || !canView(req.currentUser.perfil, req.currentUser.uid, ticket)) return res.status(404).render('404', { title: 'Chamado não encontrado' });
    req.ticket = ticket;
    next();
  });
  router.get('/tickets/:id', viewTicket, (req, res) => res.render('tickets/show', { title: req.ticket.protocolo, ticket: req.ticket }));
  router.get('/tickets/:id/edit', requireRoles('admin'), viewTicket, (req, res) => res.render('tickets/form', { title: 'Editar chamado', ticket: req.ticket, errors: [], isEdit: true }));
  router.post('/tickets/:id/edit', requireRoles('admin'), viewTicket, run(async (req, res) => {
    const fields = validateTicket(req.body);
    await db.collection('chamados').doc(req.ticket.id).update({ ...fields, atualizadoEm: new Date().toISOString() });
    send(res, `/tickets/${req.ticket.id}`, 'msg', 'Dados do chamado atualizados.');
  }));
  router.post('/tickets/:id/atender', requireRoles('tecnico', 'admin'), viewTicket, run(async (req, res) => {
    const { status, parecer } = req.body;
    if (!STATUSES.includes(status)) return send(res, `/tickets/${req.ticket.id}`, 'erro', 'Status inválido.');
    const note = cleanText(parecer, 2000);
    const u = req.currentUser;
    const ref = db.collection('chamados').doc(req.ticket.id);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error('Chamado não encontrado.'), { status: 404 });
      const old = snap.data();
      const now = new Date().toISOString();
      const history = { autorUid: u.uid, autorNome: u.nome, tipo: 'atendimento', texto: `${old.status} → ${status}${note ? ` | Parecer: ${note}` : ''}`, data: now };
      tx.update(ref, {
        status, tecnicoUid: u.uid, tecnicoResponsavel: { uid: u.uid, nome: u.nome, email: u.email },
        parecerTecnico: note || old.parecerTecnico || '', atualizadoEm: now,
        historico: admin.firestore.FieldValue.arrayUnion(history),
      });
    });
    send(res, `/tickets/${req.ticket.id}`, 'msg', 'Atendimento registrado.');
  }));
  router.post('/tickets/:id/comentarios', viewTicket, run(async (req, res) => {
    const texto = cleanText(req.body.comentario, 2000);
    if (!texto) return send(res, `/tickets/${req.ticket.id}`, 'erro', 'Escreva um comentário.');
    const u = req.currentUser;
    await db.collection('chamados').doc(req.ticket.id).update({
      historico: admin.firestore.FieldValue.arrayUnion({ autorUid: u.uid, autorNome: u.nome, tipo: 'comentario', texto, data: new Date().toISOString() }),
    });
    send(res, `/tickets/${req.ticket.id}`, 'msg', 'Comentário adicionado.');
  }));
  router.post('/tickets/:id/delete', requireRoles('admin'), viewTicket, run(async (req, res) => {
    await db.collection('chamados').doc(req.ticket.id).delete();
    send(res, '/tickets', 'msg', 'Chamado excluído.');
  }));

  router.get('/usuarios', requireRoles('admin'), run(async (req, res) => {
    const snap = await db.collection('usuarios').get();
    const usuarios = snap.docs.map(doc => doc.data()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    res.render('usuarios', { title: 'Gestão de usuários', usuarios });
  }));
  router.post('/usuarios/:uid/perfil', requireRoles('admin'), run(async (req, res) => {
    const perfil = req.body.perfil;
    const uid = req.params.uid;
    if (!['user', 'tecnico', 'admin'].includes(perfil) || !/^[a-zA-Z0-9_-]{4,128}$/.test(uid)) return send(res, '/usuarios', 'erro', 'Dados inválidos.');
    const ref = db.collection('usuarios').doc(uid);
    if (!(await ref.get()).exists) return send(res, '/usuarios', 'erro', 'Usuário não encontrado.');
    await ref.update({ perfil });
    send(res, '/usuarios', 'msg', 'Perfil atualizado com sucesso.');
  }));
  return router;
}
module.exports = { buildRoutes };
