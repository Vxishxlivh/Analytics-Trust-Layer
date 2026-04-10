import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const AUTH_URL = process.env.REACT_APP_AUTH_URL;
export const API = `${BACKEND_URL}/api`;
export const AUTH_API = `${AUTH_URL}/api`;

const TOKEN_KEY = "tl_token";

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common["Authorization"];
  }
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Restore token from localStorage on module load
const stored = getAuthToken();
if (stored) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${stored}`;
}
