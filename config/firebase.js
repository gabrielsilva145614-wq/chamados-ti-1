const admin = require('firebase-admin');

function clientConfig() {
  return {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || undefined,
  };
}

function initFirebase() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_API_KEY || !process.env.FIREBASE_APP_ID) {
    throw new Error('Configure FIREBASE_PROJECT_ID, FIREBASE_API_KEY e FIREBASE_APP_ID (ver README).');
  }
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    let credential;
    if (raw) {
      const account = JSON.parse(raw);
      account.private_key = account.private_key?.replace(/\\n/g, '\n');
      credential = admin.credential.cert(account);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = admin.credential.applicationDefault();
    } else {
      throw new Error('Defina FIREBASE_SERVICE_ACCOUNT_JSON no Render ou GOOGLE_APPLICATION_CREDENTIALS localmente.');
    }
    admin.initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID });
  }
  return { auth: admin.auth(), db: admin.firestore(), admin };
}

module.exports = { initFirebase, clientConfig };
