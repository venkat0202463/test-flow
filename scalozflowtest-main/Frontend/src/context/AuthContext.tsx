/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: (redirectToWorkspace?: boolean) => void;
  isAuthenticated: () => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Token persistence is now handled by secure httpOnly browser cookies
// as per security guideline 2e, 2g, and 14

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const scalozToken = params.get('scaloz_token');
        if (scalozToken) {
          try {
            const response = await api.post('/auth/sso', { token: scalozToken });
            const { token, id, name, role, email, passwordResetRequired, empId, department, createdAt } = response.data;
            const userWithoutToken = { id, name, role, email, passwordResetRequired, empId, department, createdAt };
            setUser(userWithoutToken as User);
            sessionStorage.setItem('user', JSON.stringify(userWithoutToken));
            localStorage.setItem('user', JSON.stringify(userWithoutToken));
            if (token) {
              sessionStorage.setItem('token', token);
              localStorage.setItem('token', token);
            }

            // Navigate to the originally requested pathname, removing scaloz_token from the URL
            const redirectToParam = params.get('redirect_to');
            let targetPath = '/dashboard';
            if (redirectToParam) {
              let currentStr = redirectToParam;
              let safety = 10;
              while (safety-- > 0) {
                try {
                  // Try to decode if double encoded
                  try { currentStr = decodeURIComponent(currentStr); } catch (e) { }

                  if (currentStr.startsWith('http')) {
                    const url = new URL(currentStr);
                    const innerRedirect = url.searchParams.get('redirect_to');
                    if (innerRedirect) {
                      currentStr = innerRedirect;
                    } else {
                      targetPath = url.pathname + url.search;
                      break;
                    }
                  } else {
                    targetPath = currentStr;
                    break;
                  }
                } catch (e) {
                  targetPath = currentStr;
                  break;
                }
              }
            } else if (window.location.pathname && window.location.pathname !== '/') {
              targetPath = window.location.pathname;
            }

            // Ultimate fallback to guarantee PM Review Queue is reached if requested
            if (window.location.href.includes('pm-review-queue') || (redirectToParam && redirectToParam.includes('pm-review-queue'))) {
              targetPath = '/dashboard/pm-review-queue';
            }

            // Clean up url bar
            if (targetPath === window.location.pathname) {
              window.history.replaceState({}, document.title, targetPath);
            } else {
              window.history.replaceState({}, document.title, targetPath);
              window.location.replace(targetPath);
              return;
            }
          } catch (ssoError) {
            console.error("SSO authentication failed", ssoError);
            // Fall through to normal auth flow (will show login page)
          }
        }

        let storedUser = sessionStorage.getItem('user');
        if (!storedUser) {
          storedUser = localStorage.getItem('user');
          if (storedUser) {
            sessionStorage.setItem('user', storedUser);
            const token = localStorage.getItem('token');
            if (token) {
              sessionStorage.setItem('token', token);
            }
          }
        } else {
          // Self-heal: Copy session to localStorage if missing (so user doesn't have to log out/in)
          if (!localStorage.getItem('user')) {
            localStorage.setItem('user', storedUser);
            const token = sessionStorage.getItem('token');
            if (token) {
              localStorage.setItem('token', token);
            }
          }
        }
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Auth init failed", e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);


  const login = (newUser: User) => {
    const { token, ...userWithoutToken } = newUser;
    setUser(userWithoutToken as User);
    sessionStorage.setItem('user', JSON.stringify(userWithoutToken));
    localStorage.setItem('user', JSON.stringify(userWithoutToken));
    if (token) {
      sessionStorage.setItem('token', token);
      localStorage.setItem('token', token);
    }
  };

  const logout = async (redirectToWorkspace?: boolean) => {
    // Extract tenant subdomain from user.empId before nullifying user state
    let tenantSubdomain = '';
    if (user && user.empId && user.empId.includes('_')) {
      tenantSubdomain = user.empId.split('_')[0].toLowerCase();
    }

    try {
      api.post('/auth/logout').catch(e => console.error("Backend logout failed", e));
    } catch (e) {
      console.error("Backend logout failed", e);
    }
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    if (redirectToWorkspace) {
      const { protocol, hostname } = window.location;

      let targetHost = hostname;
      let portSuffix = '';
      if (hostname.includes('localhost') || hostname === '127.0.0.1') {
        const tenantPort = import.meta.env.VITE_TENANT_PORT || '3000';
        portSuffix = `:${tenantPort}`;
        targetHost = hostname;
      } else {
        // Replaces subdomain 'scalozflowtest' with 'workspacetest' in production
        targetHost = hostname.replace(/\bscalozflowtest\b/gi, 'workspacetest');
      }

      window.location.href = `${protocol}//${targetHost}${portSuffix}/?logout=true`;
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout> | undefined;

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (user) {
        inactivityTimer = setTimeout(() => {
          handleInactivityLogout();
        }, 15 * 60 * 1000); // 15 minutes
      }
    };

    const handleInactivityLogout = () => {
      alert("You have been logged out of your account due to 15 minutes of inactivity.");
      logout(true);
    };

    if (user) {
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      events.forEach(event => document.addEventListener(event, resetTimer));
      resetTimer();

      return () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        events.forEach(event => document.removeEventListener(event, resetTimer));
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isAuthenticated = () => !!user && !!user.id;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, isLoading }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
