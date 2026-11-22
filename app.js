const path = require('node:path');
const express = require('express');
const { initFirebase, clientConfig } = require('./config/firebase');
const { buildRoutes } = require('./routes');
const helpers = require('./utils/helpers');
const { CATEGORIES, PRIORITIES, STATUSES } = require('./services/policies');

function createApp(firebase = initFirebase()) {
  const app = express();
  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(express.json({ limit: '20kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((req, res, next) => {
    Object.assign(res.locals, helpers, { CATEGORIES, PRIORITIES, STATUSES });
    res.locals.title = 'HelpDesk TI';
    res.locals.currentPath = req.path;
    res.locals.msg = typeof req.query.msg === 'string' ? req.query.msg.slice(0, 160) : '';
    res.locals.erro = typeof req.query.erro === 'string' ? req.query.erro.slice(0, 160) : '';
    res.locals.firebaseConfigJson = JSON.stringify(clientConfig()).replace(/</g, '\\u003c');
    next();
  });
  app.use(buildRoutes(firebase));
  app.use((req, res) => res.status(404).render('404', { title: 'Página não encontrada' }));
  app.use((error, req, res, next) => {
    console.error(error);
    if (!res.locals.currentUser) return res.status(error.status || 500).send('Falha na autenticação ou configuração. Verifique os logs do servidor.');
    res.status(error.status || 500).render('error', { title: 'Erro', error: { message: error.status ? error.message : 'Ocorreu um erro inesperado. Tente novamente.' } });
  });
  return app;
}
if (require.main === module) {
  try {
    const app = createApp();
    app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log(`HelpDesk TI ativo na porta ${process.env.PORT || 3000}`));
  } catch (error) { console.error('Configuração incompleta:', error.message); process.exit(1); }
}
module.exports = { createApp };
