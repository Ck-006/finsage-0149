import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, FIREBASE_CONFIGURED } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Firebase is not configured (empty .env), skip auth and show app directly
    if (!FIREBASE_CONFIGURED) {
      setUser({ uid: 'demo', email: 'demo@finsage.app', displayName: 'Demo User' } as unknown as User);
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading };
}
