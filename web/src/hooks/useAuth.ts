'use client';

import { useState, useEffect } from 'react';
import { getAdminAuth, setAdminAuth, clearAdminAuth, fetchUsers } from '@/lib/api';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminName, setAdminName] = useState<string>('');

  useEffect(() => {
    const auth = getAdminAuth();
    if (auth) {
      // Verify auth is valid
      fetchUsers().then((res) => {
        if (res.ok) {
          // Decode the username from auth
          try {
            const decoded = atob(auth);
            const username = decoded.split(':')[0];
            setAdminName(username);
            setIsAuthenticated(true);
          } catch {
            clearAdminAuth();
            setIsAuthenticated(false);
          }
        } else {
          clearAdminAuth();
          setIsAuthenticated(false);
        }
      }).catch(() => {
        setIsAuthenticated(false);
      });
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const login = async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    setAdminAuth(username, password);

    try {
      const res = await fetchUsers();
      if (res.ok) {
        setAdminName(username);
        setIsAuthenticated(true);
        return { ok: true };
      } else {
        clearAdminAuth();
        return { ok: false, error: res.error || 'auth_failed' };
      }
    } catch {
      clearAdminAuth();
      return { ok: false, error: 'connection_error' };
    }
  };

  const logout = () => {
    clearAdminAuth();
    setIsAuthenticated(false);
    setAdminName('');
  };

  return {
    isAuthenticated,
    adminName,
    login,
    logout,
  };
}
