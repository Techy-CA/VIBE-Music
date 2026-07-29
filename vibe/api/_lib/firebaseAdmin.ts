import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function loadServiceAccount(): ServiceAccount {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 env var is not set');
  }
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as ServiceAccount;
}

function ensureApp() {
  if (!getApps().length) {
    initializeApp({ credential: cert(loadServiceAccount()) });
  }
}

export function getAdminDb() {
  ensureApp();
  return getFirestore();
}

export function getAdminAuth() {
  ensureApp();
  return getAuth();
}

// ── Verify a client-sent Firebase ID token — used to gate endpoints that
// spend real quota (YouTube search) so only logged-in app users can hit them.
export async function verifyRequestAuth(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
