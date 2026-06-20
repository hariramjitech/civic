import axios from 'axios';

// import.meta.env.DEV is true when running `npm run dev`, false in production build
const API_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_DEV   // → http://localhost:5000/api
  : import.meta.env.VITE_API_URL_PROD; // → https://civic-24jv.onrender.com/api

console.log(`🌐 API → ${API_URL}`);

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
