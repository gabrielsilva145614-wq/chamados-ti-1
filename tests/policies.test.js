const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../services/policies');
const { validateTicket } = require('../services/firestore');
test('user visualiza somente seus chamados', () => {
  assert.equal(p.canView('user', 'a1', { autorUid: 'a1' }), true);
  assert.equal(p.canView('user', 'a1', { autorUid: 'b2' }), false);
});
test('tecnico atende todos, mas nao administra', () => {
  assert.equal(p.canView('tecnico', 'x', { autorUid: 'y' }), true);
  assert.equal(p.canAttend('tecnico'), true);
  assert.equal(p.canAdmin('tecnico'), false);
  assert.equal(p.canEdit('tecnico'), false);
});
test('admin tem controle total', () => {
  assert.equal(p.canView('admin', 'x', { autorUid: 'y' }), true);
  assert.equal(p.canAttend('admin'), true);
  assert.equal(p.canEdit('admin'), true);
});
test('validacao do chamado evita dados internos do formulario', () => {
  const fields = validateTicket({ titulo: 'Impressora parou', descricao: 'A impressora nao funciona', autorUid: 'hacker', status: 'Resolvido', categoria: 'Hardware' });
  assert.equal(fields.status, undefined);
  assert.equal(fields.autorUid, undefined);
  assert.equal(fields.categoria, 'Hardware');
  assert.throws(() => validateTicket({ titulo: 'a', descricao: 'b' }));
});
