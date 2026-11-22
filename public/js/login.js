import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, updateProfile, onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const cfg = JSON.parse(document.getElementById('firebase-web-config').textContent);
const message = document.getElementById('auth-message');
const form = document.getElementById('auth-form');
const registerTab = document.getElementById('tab-register');
const loginTab = document.getElementById('tab-login');
const nameField = document.getElementById('name-field');
const nameInput = document.getElementById('auth-name');
const passInput = document.getElementById('auth-password');
const submit = document.getElementById('auth-submit');
const google = document.getElementById('google-login');
let registerMode = false;
let busy = false;

function setMode(isRegister) {
  registerMode = isRegister;
  nameField.hidden = !isRegister;
  nameInput.required = isRegister;
  passInput.autocomplete = isRegister ? 'new-password' : 'current-password';
  submit.textContent = isRegister ? 'Criar conta' : 'Entrar com e-mail';
  registerTab.classList.toggle('is-active', isRegister);
  loginTab.classList.toggle('is-active', !isRegister);
  registerTab.setAttribute('aria-pressed', String(isRegister));
  loginTab.setAttribute('aria-pressed', String(!isRegister));
  message.hidden = true;
}
function showError(error) {
  const messages = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Confira o endereço de e-mail.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Esta conta não foi encontrada.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/weak-password': 'A senha precisa ser mais forte (mínimo de 6 caracteres).',
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere pop-ups.',
    'auth/unauthorized-domain': 'O domínio ainda não foi autorizado no Firebase.',
    'auth/operation-not-allowed': 'Habilite este método de login no Firebase Authentication.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
    'auth/network-request-failed': 'Falha de conexão. Verifique a internet.',
  };
  message.textContent = messages[error?.code] || error?.message || 'Ocorreu um erro ao autenticar.';
  message.hidden = false;
}
function setBusy(value) {
  busy = value;
  submit.disabled = value;
  google.disabled = value;
}
const params = new URLSearchParams(location.search);

if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
  showError({ message: 'Configuração do Firebase incompleta. Confira as variáveis de ambiente (README).' });
  setBusy(true);
} else {
  const firebase = initializeApp(cfg);
  const auth = getAuth(firebase);
  const finish = async (user, nome = '') => {
    const idToken = await user.getIdToken(true);
    const response = await fetch('/auth/session', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, nome }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível criar a sessão.');
    location.replace(data.redirect || '/');
  };
  registerTab.addEventListener('click', () => setMode(true));
  loginTab.addEventListener('click', () => setMode(false));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    message.hidden = true;
    try {
      const email = document.getElementById('auth-email').value.trim();
      const senha = passInput.value;
      let user;
      if (registerMode) {
        const nome = nameInput.value.trim();
        if (nome.length < 2) throw new Error('Informe seu nome completo.');
        const data = await createUserWithEmailAndPassword(auth, email, senha);
        user = data.user;
        await updateProfile(user, { displayName: nome });
        await finish(user, nome);
      } else {
        user = (await signInWithEmailAndPassword(auth, email, senha)).user;
        await finish(user);
      }
    } catch (error) { showError(error); } finally { setBusy(false); }
  });
  google.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    message.hidden = true;
    try {
      const user = (await signInWithPopup(auth, new GoogleAuthProvider())).user;
      await finish(user);
    } catch (error) { showError(error); } finally { setBusy(false); }
  });
  onAuthStateChanged(auth, async user => {
    if (params.get('logout') === '1') {
      if (user) await signOut(auth);
      history.replaceState({}, '', '/login');
      return;
    }
    if (user && !busy) {
      setBusy(true);
      try { await finish(user); } catch (error) { showError(error); setBusy(false); }
    }
  });
  if (params.get('erro') === 'sessao') showError({ message: 'Sua sessão expirou. Faça login novamente.' });
}
