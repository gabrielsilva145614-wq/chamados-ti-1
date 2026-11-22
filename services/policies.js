const ROLES = ['user', 'tecnico', 'admin'];
const STATUSES = ['Aberto', 'Em Atendimento', 'Resolvido'];
const PRIORITIES = ['Baixa', 'Média', 'Alta', 'Crítica'];
const CATEGORIES = ['Hardware', 'Software', 'Rede', 'Acesso', 'Outros'];
const canAttend = role => role === 'tecnico' || role === 'admin';
const canAdmin = role => role === 'admin';
const canView = (role, uid, ticket) => canAttend(role) || (role === 'user' && ticket.autorUid === uid);
const canEdit = role => role === 'admin';
module.exports = { ROLES, STATUSES, PRIORITIES, CATEGORIES, canAttend, canAdmin, canView, canEdit };
