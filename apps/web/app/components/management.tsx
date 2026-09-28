"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Radio, Trash2 } from "lucide-react";
import { Modal } from "./modal";
import { MachineAccess } from "./machine-access";
import { ModbusTools } from "./modbus-tools";

type Tag = {
  id: string;
  name: string;
  address: number;
  functionCode: number;
  dataType: string;
  scale?: number;
  unit?: string;
};
type Device = {
  id: string;
  name: string;
  host: string;
  port: number;
  unitId: number;
  enabled: boolean;
  gatewayId?: string;
  gatewayEnabled?: boolean;
  machineEnabled?: boolean;
  pollIntervalMs?: number;
  tags: Tag[];
};
type User = {
  id: string;
  name: string;
  username: string;
  role: string;
  roleGroupId?: string | null;
};
type Permission = { id: string; code: string; name: string; category: string };
type Role = {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: Permission[];
};
type Api = (path: string, options?: RequestInit) => Promise<any>;
type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  min?: number;
  max?: number;
  step?: string;
  options?: string[];
  optionLabels?: Record<string, string>;
  optional?: boolean;
};
type Editor = {
  title: string;
  path: string;
  method: "POST" | "PATCH";
  fields: Field[];
  defaults?: Record<string, unknown>;
};
const deviceFields = (d?: Device): Field[] => [
  { name: "name", label: "Nama mesin", value: d?.name },
  { name: "host", label: "Host / alamat IP gateway", value: d?.host },
  {
    name: "port",
    label: "Port TCP",
    type: "number",
    value: d?.port ?? 502,
    min: 1,
    max: 65535,
  },
  {
    name: "unitId",
    label: "Unit ID mesin",
    type: "number",
    value: d?.unitId ?? 1,
    min: 0,
    max: 247,
  },
  {
    name: "pollIntervalMs",
    label: "Interval polling (ms)",
    type: "number",
    value: d?.pollIntervalMs ?? 1000,
    min: 250,
  },
];
const tagFields = (t?: Tag): Field[] => [
  { name: "name", label: "Nama register", value: t?.name },
  {
    name: "address",
    label: "Alamat register",
    type: "number",
    min: 0,
    max: 65535,
    value: t?.address ?? 0,
  },
  {
    name: "functionCode",
    label: "Function code",
    type: "number",
    options: ["1", "2", "3", "4"],
    value: t?.functionCode ?? 3,
  },
  {
    name: "dataType",
    label: "Tipe data",
    options: ["uint16", "int16", "uint32", "int32", "float32", "coil"],
    value: t?.dataType ?? "uint16",
  },
  {
    name: "scale",
    label: "Skala",
    type: "number",
    step: "any",
    value: t?.scale ?? 1,
  },
  { name: "unit", label: "Satuan", value: t?.unit, optional: true },
];
export function Management({
  tab,
  api,
  reload,
  devices,
  users,
  roles,
  permissions,
}: {
  tab: string;
  api: Api;
  reload: () => Promise<void>;
  devices: Device[];
  users: User[];
  roles: Role[];
  permissions: Permission[];
}) {
  const [accessUser, setAccessUser] = useState<User | null>(null);
  const [diagnostic, setDiagnostic] = useState<Device | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removal, setRemoval] = useState<{ path: string; name: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const open = (value: Editor, ids: string[] = []) => {
    setError("");
    setEditor(value);
    setSelectedPermissions(ids);
  };
  const mutate = async (path: string, method: string, body?: unknown) => {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await api(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setEditor(null);
      setRemoval(null);
      setMessage(
        method === "DELETE"
          ? "Data berhasil dihapus."
          : "Data berhasil disimpan.",
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan gagal.");
    } finally {
      setPending(false);
    }
  };
  const userFields = (u?: User): Field[] => [
    { name: "name", label: "Nama lengkap", value: u?.name },
    { name: "username", label: "Username", value: u?.username },
    ...(!u ? [{ name: "password", label: "Password", type: "password" }] : []),
    {
      name: "role",
      label: "Role",
      options: ["operator", "admin"],
      value: u?.role || "operator",
    },
    {
      name: "roleGroupId",
      label: "Role group",
      options: ["", ...roles.map((role) => role.id)],
      optionLabels: Object.fromEntries([
        ["", "Tanpa role group"],
        ...roles.map((role) => [role.id, role.name]),
      ]),
      value: u?.roleGroupId || "",
      optional: true,
    },
  ];
  const roleFields = (r?: Role): Field[] => [
    { name: "code", label: "Kode role", value: r?.code },
    { name: "name", label: "Nama role", value: r?.name },
    {
      name: "description",
      label: "Deskripsi",
      value: r?.description,
      optional: true,
    },
  ];
  const permissionFields = (p?: Permission): Field[] => [
    { name: "code", label: "Kode permission", value: p?.code },
    { name: "name", label: "Nama permission", value: p?.name },
    {
      name: "category",
      label: "Kategori",
      value: p?.category || "Konfigurasi",
    },
  ];
  const create = () => {
    if (tab === "mesin")
      open({
        title: "Tambah koneksi Modbus TCP",
        path: "devices",
        method: "POST",
        fields: deviceFields(),
        defaults: { enabled: true },
      });
    if (tab === "pengguna")
      open({
        title: "Tambah pengguna",
        path: "users",
        method: "POST",
        fields: userFields(),
      });
    if (tab === "role")
      open({
        title: "Tambah role group",
        path: "access/role-groups",
        method: "POST",
        fields: roleFields(),
      });
    if (tab === "permission")
      open({
        title: "Tambah permission",
        path: "access/permissions",
        method: "POST",
        fields: permissionFields(),
      });
  };
  const actions = (name: string, path: string, edit: () => void) => (
    <div className="flex justify-end gap-1">
      <button className="icon-btn" aria-label={`Ubah ${name}`} onClick={edit}>
        <Pencil size={16} />
      </button>
      <button
        className="icon-btn text-rose-600 hover:bg-rose-50"
        aria-label={`Hapus ${name}`}
        onClick={() => {
          setError("");
          setRemoval({ path, name });
        }}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
  const filteredDevices = devices.filter((d) =>
    `${d.name} ${d.host}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <Modal
        open={!!accessUser}
        title={`Akses mesin · ${accessUser?.name || ""}`}
        onClose={() => setAccessUser(null)}
      >
        {accessUser && (
          <MachineAccess
            key={accessUser.id}
            user={accessUser}
            devices={devices}
          />
        )}
      </Modal>
      <Modal
        open={!!diagnostic}
        title={`Diagnostik · ${diagnostic?.name || ""}`}
        onClose={() => setDiagnostic(null)}
      >
        {diagnostic && <ModbusTools key={diagnostic.id} device={diagnostic} />}
      </Modal>
      {tab === "mesin" && (
        <p className="notice text-xs">
          Mesin dengan host/port yang sama memakai gateway bersama. Host, port,
          dan interval polling berlaku untuk seluruh mesin pada gateway itu.
          Koneksi baru memakai interval gateway yang sudah ada. FC1/FC2 memakai
          tipe coil; FC3/FC4 memakai tipe numerik. Alamat register dimulai dari
          0.
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {tab === "mesin" ? (
          <label className="w-full sm:w-72">
            <span className="sr-only">Cari mesin atau alamat IP</span>
            <input
              className="input"
              placeholder="Cari mesin atau alamat IP…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        ) : (
          <p className="text-sm text-slate-500">
            {
              (tab === "pengguna"
                ? users
                : tab === "role"
                  ? roles
                  : permissions
              ).length
            }{" "}
            data terdaftar
          </p>
        )}
        <button className="btn" onClick={create}>
          <Plus size={16} />
          Tambah{" "}
          {tab === "mesin" ? "koneksi" : tab === "role" ? "role group" : tab}
        </button>
      </div>
      {tab === "mesin" ? (
        <>
          {!filteredDevices.length && (
            <div className="card empty">
              <Radio size={30} className="mx-auto mb-3 text-slate-300" />
              <p>
                {search
                  ? "Tidak ada mesin yang cocok dengan pencarian."
                  : "Belum ada koneksi Modbus. Tambahkan gateway TCP dan Unit ID mesin pertama."}
              </p>
            </div>
          )}
          {filteredDevices.map((d) => (
            <article key={d.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{d.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {d.host}:{d.port} · Unit ID {d.unitId} ·{" "}
                    {d.pollIntervalMs ?? 1000} ms
                  </p>
                  <span className="badge mt-3">
                    {d.enabled ? "Polling aktif" : "Polling nonaktif"}
                  </span>
                </div>
                {actions(d.name, `devices/${d.id}`, () =>
                  open({
                    title: "Ubah koneksi Modbus",
                    path: `devices/${d.id}`,
                    method: "PATCH",
                    fields: [
                      ...deviceFields(d),
                      {
                        name: "enabled",
                        label: "Polling",
                        options: ["true", "false"],
                        value: String(d.machineEnabled ?? d.enabled),
                      },
                    ],
                  }),
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => setDiagnostic(d)}
                >
                  Diagnostik Modbus
                </button>
                {d.gatewayEnabled === false && d.gatewayId && (
                  <button
                    className="btn-secondary"
                    disabled={pending}
                    onClick={() =>
                      void mutate(`gateways/${d.gatewayId}`, "PATCH", {
                        enabled: true,
                      })
                    }
                  >
                    Aktifkan gateway
                  </button>
                )}
              </div>
              <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-slate-700">
                  Register{" "}
                  <span className="text-slate-400">({d.tags.length})</span>
                </h3>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    open({
                      title: `Tambah register · ${d.name}`,
                      path: `devices/${d.id}/tags`,
                      method: "POST",
                      fields: tagFields(),
                      defaults: { enabled: true },
                    })
                  }
                >
                  <Plus size={14} />
                  Tambah register
                </button>
              </div>
              {d.tags.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nama register</th>
                        <th>Alamat</th>
                        <th>Function code</th>
                        <th>Tipe data</th>
                        <th>
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.tags.map((t) => (
                        <tr key={t.id}>
                          <td className="font-medium">{t.name}</td>
                          <td>{t.address}</td>
                          <td>FC{t.functionCode}</td>
                          <td>{t.dataType}</td>
                          <td>
                            {actions(t.name, `tags/${t.id}`, () =>
                              open({
                                title: "Ubah register",
                                path: `tags/${t.id}`,
                                method: "PATCH",
                                fields: tagFields(t),
                              }),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  Tambahkan register untuk mulai memantau nilai mesin.
                </p>
              )}
            </article>
          ))}
        </>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>
                    {tab === "pengguna"
                      ? "Username / Role"
                      : tab === "role"
                        ? "Permission"
                        : "Kode / Kategori"}
                  </th>
                  <th>
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tab === "pengguna" &&
                  users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.name}</td>
                      <td>
                        @{u.username}{" "}
                        <span className="badge ml-2">{u.role}</span>
                      </td>
                      <td>
                        <button
                          className="btn-secondary mb-2 whitespace-nowrap"
                          onClick={() => setAccessUser(u)}
                        >
                          Akses mesin
                        </button>
                        {actions(u.name, `users/${u.id}`, () =>
                          open({
                            title: "Ubah pengguna",
                            path: `users/${u.id}`,
                            method: "PATCH",
                            fields: userFields(u),
                          }),
                        )}
                      </td>
                    </tr>
                  ))}
                {tab === "role" &&
                  roles.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">
                        {r.name}
                        <span className="mt-1 block text-xs text-slate-400">
                          {r.code}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {r.permissions.length
                            ? r.permissions.map((p) => (
                                <span key={p.id} className="badge">
                                  {p.code}
                                </span>
                              ))
                            : "Tanpa permission"}
                        </div>
                      </td>
                      <td>
                        {r.isSystem ? (
                          <span className="badge">Bawaan sistem</span>
                        ) : (
                          actions(r.name, `access/role-groups/${r.id}`, () =>
                            open(
                              {
                                title: "Ubah role group",
                                path: `access/role-groups/${r.id}`,
                                method: "PATCH",
                                fields: roleFields(r),
                              },
                              r.permissions.map((p) => p.id),
                            ),
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                {tab === "permission" &&
                  permissions.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td>
                        {p.code}
                        <span className="mt-1 block text-xs text-slate-400">
                          {p.category}
                        </span>
                      </td>
                      <td>
                        {actions(p.name, `access/permissions/${p.id}`, () =>
                          open({
                            title: "Ubah permission",
                            path: `access/permissions/${p.id}`,
                            method: "PATCH",
                            fields: permissionFields(p),
                          }),
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!(tab === "pengguna" ? users : tab === "role" ? roles : permissions)
            .length && (
            <p className="empty">
              Belum ada data. Gunakan tombol Tambah untuk membuat data pertama.
            </p>
          )}
        </div>
      )}
      <Modal
        open={Boolean(editor)}
        title={editor?.title || "Ubah data"}
        onClose={() => {
          if (!pending) setEditor(null);
        }}
      >
        {editor && (
          <form
            key={editor.path + editor.method}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const body: Record<string, unknown> = { ...editor.defaults };
              editor.fields.forEach((field) => {
                const value = form.get(field.name);
                body[field.name] =
                  field.name === "enabled"
                    ? value === "true"
                    : field.type === "number"
                      ? Number(value)
                      : value;
              });
              if (tab === "pengguna" && body.roleGroupId === "")
                body.roleGroupId = null;
              if (tab === "role") body.permissionIds = selectedPermissions;
              void mutate(editor.path, editor.method, body);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {editor.fields.map((field) => (
                <label className="field" key={field.name}>
                  {field.label}
                  {field.options ? (
                    <select
                      name={field.name}
                      defaultValue={field.value}
                      className="input"
                    >
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option === "true"
                            ? "Aktif"
                            : option === "false"
                              ? "Nonaktif"
                              : (field.optionLabels?.[option] ?? option)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      name={field.name}
                      type={field.type || "text"}
                      defaultValue={field.value}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      minLength={
                        field.type === "password"
                          ? 6
                          : field.name === "username"
                            ? 3
                            : undefined
                      }
                      autoComplete={
                        field.type === "password" ? "new-password" : "off"
                      }
                      required={!field.optional}
                    />
                  )}
                </label>
              ))}
            </div>
            {tab === "role" && (
              <fieldset className="mt-5 border-t border-slate-200 pt-4">
                <legend className="text-sm font-medium">Permission</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {permissions.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-start gap-2 text-xs text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(p.id)}
                        onChange={(e) =>
                          setSelectedPermissions(
                            e.target.checked
                              ? [...selectedPermissions, p.id]
                              : selectedPermissions.filter((id) => id !== p.id),
                          )
                        }
                      />
                      {p.name} ({p.code})
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {error && (
              <p role="alert" className="mt-4 text-sm text-rose-600">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={() => setEditor(null)}
              >
                Batal
              </button>
              <button className="btn" disabled={pending}>
                {pending && <Loader2 size={16} className="animate-spin" />}
                Simpan
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={Boolean(removal)}
        title="Hapus data?"
        onClose={() => {
          if (!pending) setRemoval(null);
        }}
      >
        <p className="text-sm leading-relaxed text-slate-600">
          Hapus <strong>{removal?.name}</strong>? Data terkait dapat ikut
          terhapus. Tindakan ini tidak dapat dibatalkan.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="btn-secondary"
            disabled={pending}
            onClick={() => setRemoval(null)}
          >
            Batal
          </button>
          <button
            className="btn bg-rose-600 hover:bg-rose-700"
            disabled={pending}
            onClick={() => removal && void mutate(removal.path, "DELETE")}
          >
            {pending && <Loader2 size={16} className="animate-spin" />}Hapus
            data
          </button>
        </div>
      </Modal>
    </div>
  );
}
