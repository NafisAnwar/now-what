import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  reload,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Initialize Firebase (singleton check)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function registerWithEmail(email: string, pass: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  // Send email verification link automatically on sign up
  try {
    await sendEmailVerification(result.user);
  } catch (err) {
    console.error('[auth] Failed to send email verification:', err);
  }
  return result.user;
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function refreshUserSession(user: User): Promise<User> {
  await reload(user);
  return auth.currentUser || user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, type User };
