import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('studypact-user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      const session = localStorage.getItem('studypact-session');
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const result = await authService.getCurrentUser();
        if (result?.user) {
          setUser(result.user);
          localStorage.setItem('studypact-user', JSON.stringify(result.user));
        } else {
          localStorage.removeItem('studypact-session');
          localStorage.removeItem('studypact-user');
          setUser(null);
        }
      } catch (error) {
        localStorage.removeItem('studypact-session');
        localStorage.removeItem('studypact-user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const value = useMemo(() => ({
    user,
    setUser,
    loading,
    signOut: async () => {
      await authService.signOut();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
