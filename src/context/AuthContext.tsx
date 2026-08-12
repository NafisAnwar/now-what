import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  resendVerificationEmail,
  refreshUserSession,
  logoutUser,
  onAuthStateChanged,
  type User,
} from '../data/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User | void>;
  signInWithEmail: (email: string, pass: string) => Promise<User>;
  signUpWithEmail: (email: string, pass: string) => Promise<User>;
  resendVerification: () => Promise<void>;
  checkVerificationStatus: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => { throw new Error('Not implemented'); },
  signUpWithEmail: async () => { throw new Error('Not implemented'); },
  resendVerification: async () => {},
  checkVerificationStatus: async () => false,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignInWithGoogle = async () => {
    try {
      return await loginWithGoogle();
    } catch (err: any) {
      console.error('[auth] Google sign in error:', err);
      throw err;
    }
  };

  const handleSignInWithEmail = async (email: string, pass: string) => {
    try {
      return await loginWithEmail(email, pass);
    } catch (err: any) {
      console.error('[auth] Email sign in error:', err);
      throw err;
    }
  };

  const handleSignUpWithEmail = async (email: string, pass: string) => {
    try {
      return await registerWithEmail(email, pass);
    } catch (err: any) {
      console.error('[auth] Email sign up error:', err);
      throw err;
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    await resendVerificationEmail(auth.currentUser);
  };

  const handleCheckVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    const updatedUser = await refreshUserSession(auth.currentUser);
    setUser({ ...updatedUser });
    return updatedUser.emailVerified;
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err: any) {
      console.error('[auth] Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle: handleSignInWithGoogle,
        signInWithEmail: handleSignInWithEmail,
        signUpWithEmail: handleSignUpWithEmail,
        resendVerification: handleResendVerification,
        checkVerificationStatus: handleCheckVerificationStatus,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
