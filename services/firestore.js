const { CATEGORIES, PRIORITIES, STATUSES } = require('./policies');

const toJs = (value) => {
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (Array.isArray(value)) return value.map(toJs);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJs(v)]));
  return value;
};
const fromSnap = snap => snap.exists ? { id: snap.id, ...toJs(snap.data()), protocolo: `CH-${snap.id.slice(0, 8).toUpperCase()}` } : null;
const cleanText = (s, max = 200) => String(s || '').trim().slice(0, max);

function validateTicket(body) {
  const titulo = cleanText(body.titulo, 150);
  const descricao = cleanText(body.descricao, 5000);
  if (titulo.length < 3 || descricao.length < 5) throw Object.assign(new Error('Informe um título de pelo menos 3 caracteres e uma descrição de pelo menos 5 caracteres.'), { status: 422 });
  const prioridade = PRIORITIES.includes(body.prioridade) ? body.prioridade : 'Média';
  const categoria = CATEGORIES.includes(body.categoria) ? body.categoria : 'Outros';
  return { titulo, descricao, prioridade, categoria, setor: cleanText(body.setor, 60) };
}

async function listTickets(db, currentUser) {
  const col = db.collection('chamados');
  // Filtro também no banco: nunca lê chamados de terceiros para perfil user.
  const snap = currentUser.perfil === 'user'
    ? await col.where('autorUid', '==', currentUser.uid).get()
    : await col.get();
  return snap.docs.map(fromSnap).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
}

async function getTicket(db, id) {
  if (!/^[a-zA-Z0-9]{15,40}$/.test(id)) return null;
  return fromSnap(await db.collection('chamados').doc(id).get());
}

module.exports = { fromSnap, cleanText, validateTicket, listTickets, getTicket, STATUSES };
