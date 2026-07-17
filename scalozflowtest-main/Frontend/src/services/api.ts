import axios from 'axios';
import { encryptPayload, decryptPayload } from './encryption';

const getBaseURL = () => {
  let url = import.meta.env.VITE_API_URL || '';
  if (!url) {
    url = `${window.location.origin}/api`;
  }
  // In local development, if we are accessing via a subdomain of localhost (e.g. scalozflow.localhost),
  // rewrite the API base URL to use the same hostname so that cookies are same-site and sent successfully.
  if (window.location.hostname.endsWith('.localhost') && url.includes('localhost')) {
    url = url.replace('localhost', window.location.hostname);
  }

  // In production, if we are accessing via a tenant subdomain (e.g. company.scalozflowtest.scaloz.com),
  // rewrite the API base URL to use the same tenant hostname so that cookies are sent successfully.
  if (window.location.hostname.includes('.scalozflowtest.scaloz.com') && url.includes('scalozflowtest.scaloz.com')) {
    url = url.replace('scalozflowtest.scaloz.com', window.location.hostname);
  }
  return url;
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
});

// Global request interceptor to add token and handle payload encryption
api.interceptors.request.use(
  async (config) => {
    // Add auth token if available
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Encrypt JSON payloads
    if (config.data && !(config.data instanceof FormData)) {
      const encrypted = await encryptPayload(config.data);
      if (encrypted) {
        config.data = {
          payload: encrypted
        };
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Global response interceptor to handle decryption and session expiration
api.interceptors.response.use(
  async (response) => {
    // Decrypt incoming payload if it exists
    if (response.data && response.data.payload) {
      const decrypted = await decryptPayload(response.data.payload);
      if (decrypted) {
        response.data = decrypted;
      }
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear local auth state if backend rejects the session
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      
      // Force redirect to login page if we're not already on an auth page
      const authPages = ['/login', '/register', '/forgot-password', '/reset-password', '/'];
      const isAuthPage = authPages.some(path => {
        if (path === '/') return window.location.pathname === '/' || window.location.pathname === '';
        return window.location.pathname.endsWith(path) || window.location.pathname.includes(path + '?');
      });
      
      if (!isAuthPage) {
        console.log('Redirecting to login: unauthorized request from', window.location.pathname);
        alert("You have been logged out of your account due to 15 minutes of inactivity.");
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/?redirect_to=${encodeURIComponent(currentPath)}`;
      } else {
        console.warn('Unauthorized request blocked redirect while on auth page:', window.location.pathname);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
