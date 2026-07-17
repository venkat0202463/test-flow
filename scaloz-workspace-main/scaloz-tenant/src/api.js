import axios from "axios";

const getApiBaseUrl = () => {
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }

  const { protocol, hostname, port } = window.location;
  const portStr = port ? `:${port}` : '';
  const mainDomain = process.env.REACT_APP_MAIN_DOMAIN || 'scaloz.com';
  const workspacePrefix = process.env.REACT_APP_WORKSPACE_PREFIX || 'workspace';

  // Parse clean hostname by stripping tenant subdomain if any
  let cleanHostname = hostname;
  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    cleanHostname = 'localhost';
  } else if (hostname.endsWith(mainDomain)) {
    // If it's a tenant subdomain like tenant.apps.scaloz.com
    // cleanHostname should be the base portal domain apps.scaloz.com
    cleanHostname = `${workspacePrefix}.${mainDomain}`;
  } else {
    // Fallback logic
    const parts = hostname.split('.');
    if (parts.length > 2) {
      cleanHostname = parts.slice(-2).join('.');
    }
  }

  // Handle local development if needed, e.g. frontend on 3000, backend on 8085
  if (hostname.includes('localhost') && !process.env.REACT_APP_API_BASE_URL) {
    return `${protocol}//localhost:8085/api`;
  }

  return `${protocol}//${cleanHostname}${portStr}/api`;
};


const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Automatically add JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const rawToken = sessionStorage.getItem("token");
    if (rawToken) {
      // Handle cases where token might be double-quoted in sessionStorage
      const token = rawToken.startsWith('"') && rawToken.endsWith('"')
        ? rawToken.slice(1, -1)
        : rawToken;
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
