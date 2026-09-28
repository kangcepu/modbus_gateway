"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { AppShell } from "./components/shell";
import { Management } from "./components/management";
import { LiveDashboard } from "./components/live-dashboard";
import { request, useSession } from "@/lib/session";
import type { Device } from "@/lib/monitoring";
const titles: Record<string, string> = {
  mesin: "Gateway & Register",
  pengguna: "UserManagement",
  role: "Role Management",
  permission: "Permission Management",
};
export default function Home() {
  return (
    <Suspense fallback={<p className="empty">Memuat…</p>}>
      <Route />
    </Suspense>
  );
}
function Route() {
  const params = useSearchParams();
  const tab = params.get("tab") || "dashboard";
  return titles[tab] ? (
    <Administration key={tab} tab={tab} />
  ) : (
    <LiveDashboard key={tab} monitoring={tab === "monitoring"} />
  );
}
function Administration({ tab }: { tab: string }) {
  const { user } = useSession();
  const [initialized, setInitialized] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [roles, setRoles] = useState<any[]>([]),
    [permissions, setPermissions] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    if (user?.role !== "admin") return;
    setLoading(true);
    setError("");
    try {
      if (tab === "mesin") setDevices(await request("devices"));
      else {
        const [u, r, p, d] = await Promise.all([
          request("users"),
          request("access/role-groups"),
          request("access/permissions"),
          tab === "pengguna" ? request("devices") : Promise.resolve([]),
        ]);
        setDevices(d);
        setUsers(u);
        setRoles(r);
        setPermissions(p);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [tab, user]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <AppShell title={titles[tab]} activeHref={`/?tab=${tab}`}>
      <div className="page-heading">
        <div>
          <h1>{titles[tab]}</h1>
          <p>
            {tab === "mesin"
              ? "Kelola gateway TCP, Unit ID mesin, polling, dan register Modbus."
              : "Kelola data dan akses pengguna aplikasi."}
          </p>
        </div>
        <button
          className="btn-secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Muat ulang
        </button>
      </div>
      {error && (
        <p role="alert" className="notice text-rose-700">
          {error}
        </p>
      )}
      {user?.role !== "admin" ? (
        <div className="card empty">
          Halaman ini hanya tersedia untuk administrator.
        </div>
      ) : loading && !initialized ? (
        <div className="card empty" role="status">
          Memuat data…
        </div>
      ) : (
        <Management
          tab={tab}
          api={request}
          reload={load}
          devices={devices}
          users={users}
          roles={roles}
          permissions={permissions}
        />
      )}
    </AppShell>
  );
}
