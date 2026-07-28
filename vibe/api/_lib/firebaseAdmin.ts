import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function loadServiceAccount(): ServiceAccount {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 env var is not set');
  }
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as ServiceAccount;
}

export function getAdminDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert(loadServiceAccount()) });
  }
  return getFirestore();
}
