import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { AUTH_API, setAuthToken, getAuthToken } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (token) => {
    try {
      const res = await axios.get(`${AUTH_API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data.user || res.data);
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      fetchMe(token);
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  const login = async (email, password) => {
    const res = await axios.post(`${AUTH_API}/auth/login`, { email, password });
    const token = res.data.token || res.data.access_token;
    if (!token) throw new Error("No token in response");
    setAuthToken(token);
    const userInfo = res.data.user || res.data;
    setUser(userInfo);
    // also fetch /me to get full profile
    await fetchMe(token);
    return res.data;
  };

  const signup = async (data) => {
    const res = await axios.post(`${AUTH_API}/auth/signup`, data);
    const token = res.data.token || res.data.access_token;
    if (!token) throw new Error("No token in response");
    setAuthToken(token);
    const userInfo = res.data.user || res.data;
    setUser(userInfo);
    await fetchMe(token);
    return res.data;
  };

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
