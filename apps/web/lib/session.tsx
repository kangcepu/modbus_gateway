"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type User = {
  id: string;
  name: string;
  username: string;
  role: string;
  createdAt?: string;
  roleGroup?: { name: string; description?: string };
};
export async function request(path: string, options: RequestInit = {}) {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem("iot_session");
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/login")) {
      localStorage.removeItem("iot_session");
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join(". ")
        : data?.message || "Tidak dapat menghubungi server. Coba lagi.",
    );
  }
  return data;
}
const Context = createContext<{
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (localStorage.getItem("iot_session"))
        setUser(await request("auth/me"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat sesi.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const clear = () => setUser(null);
    window.addEventListener("session-expired", clear);
    return () => window.removeEventListener("session-expired", clear);
  }, [refresh]);
  const login = async (username: string, password: string) => {
    const result = await request("auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem("iot_session", result.token);
    setUser(result.user);
    setError("");
  };
  const logout = async () => {
    await request("auth/logout", { method: "POST" });
    localStorage.removeItem("iot_session");
    setUser(null);
  };
  return (
    <Context.Provider value={{ user, loading, error, refresh, login, logout }}>
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionProvider is required");
  return value;
}
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
export const cn = (...values: (string | false | undefined)[]) =>
  values.filter(Boolean).join(" ");
