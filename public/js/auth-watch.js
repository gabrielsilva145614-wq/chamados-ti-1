import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const cfg = JSON.parse(document.getElementById('firebase-web-config').textContent);
if (cfg.apiKey && cfg.projectId && cfg.appId) {
  const auth = getAuth(initializeApp(cfg));
  // O servidor também verifica a sessão a CADA rota. Este observador acompanha logout no navegador.
  onAuthStateChanged(auth, user => { if (!user) location.replace('/login'); });
}
