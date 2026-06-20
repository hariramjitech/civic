import axios from 'axios';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Holds a reference to Clerk's getToken() function — registered on sign-in
let _getToken = null;

/**
 * Register Clerk's getToken() so the interceptor can fetch a fresh JWT
 * before every request. Call with null on sign-out to clear it.
 */
export const setGetTokenFn = (fn) => {
  _getToken = fn;
};

// Legacy helper kept for backward compat (no-op now — interceptor handles it)
export const setAuthToken = (_token) => {};

// Request interceptor: always attach a fresh Clerk JWT before sending
api.interceptors.request.use(async (config) => {
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('Could not refresh Clerk token:', err);
    }
  }
  return config;
});

export default api;
