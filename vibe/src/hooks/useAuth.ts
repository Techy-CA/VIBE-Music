import { useEffect } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup,
  signOut, updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { createUserProfile, getUserProfile } from '../lib/firestore';
import { useAuthStore } from '../store/useAuthStore';

export const useAuth = () => {
  const { user, isLoading, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        let profile = await getUserProfile(firebaseUser.uid);
        if (!profile) {
          await createUserProfile(firebaseUser.uid, {
            id:       firebaseUser.uid,
            name:     firebaseUser.displayName || 'Music Fan',
            email:    firebaseUser.email ?? '',
            photoURL: firebaseUser.photoURL ?? undefined,
          });
          profile = await getUserProfile(firebaseUser.uid);
        }
        setUser(profile);
      } else {
        setUser(null);
      }
    });
    return unsub;
  }, []);

  const loginWithEmail    = (email: string, password: string) => {
    setLoading(true);
    return signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (email: string, password: string, name: string) => {
    setLoading(true);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await createUserProfile(cred.user.uid, {
      id: cred.user.uid, name, email,
    });
  };

  const loginWithGoogle = () => {
    setLoading(true);
    return signInWithPopup(auth, googleProvider);
  };

  const signOutUser = async () => {
    await signOut(auth);
    logout();
  };

  return { user, isLoading, loginWithEmail, registerWithEmail, loginWithGoogle, signOutUser };
};