import { useEffect, useMemo, useState } from "react";
import sendHTTP from "../util/axios";
import { isAdmin } from "../util/auth";

interface IUser {
  _id?: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  state: string;
  createdAt: Date;
}

const statusColor: Record<string, string> = {
  Active: "#2FD4B0",
  Pending: "#F5A623",
  Inactive: "#6E7690",
};

const roleColor: Record<string, string> = {
  Admin: "#6C6FF0",
  Member: "#6E7690",
};

const emptyDraft: IUser = {
  name: "",
  email: "",
  role: "Member",
  state: "Active",
  createdAt: new Date(),
};

export default function User() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IUser | null>(null);
  const [draft, setDraft] = useState<IUser>(emptyDraft);

  const [saving, setSaving] = useState(false);

  const admin = isAdmin();

  /* ========================================================= */
  /* LOAD USERS */
  /* ========================================================= */

  const loadUsers = async () => {
    setLoading(true);

    try {
      const res: any = await sendHTTP(
        "/api/v1/user/get",
        "get"
      );

      setUsers(
        Array.isArray(res?.data)
          ? res.data
          : []
      );
    } catch (e) {
      console.error("Failed to load users", e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  /* ========================================================= */
  /* FILTER */
  /* ========================================================= */

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return users;

    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.role?.toLowerCase().includes(query) ||
        u.state?.toLowerCase().includes(query)
    );
  }, [users, search]);

  /* ========================================================= */
  /* STATISTICS */
  /* ========================================================= */

  const adminCount = users.filter(
    (u) => u.role === "Admin"
  ).length;

  const memberCount = users.filter(
    (u) => u.role === "Member"
  ).length;

  const activeCount = users.filter(
    (u) => u.state === "Active"
  ).length;

  const pendingCount = users.filter(
    (u) => u.state === "Pending"
  ).length;

  /* ========================================================= */
  /* MODAL */
  /* ========================================================= */

  const openCreate = () => {
    setEditing(null);
    setDraft({
      ...emptyDraft,
      createdAt: new Date(),
    });
    setModalOpen(true);
  };

  const openEdit = (u: IUser) => {
    setEditing(u);

    setDraft({
      ...u,
      password: "",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditing(null);
    setDraft({
      ...emptyDraft,
      createdAt: new Date(),
    });
  };

  /* ========================================================= */
  /* SAVE */
  /* ========================================================= */

  const saveUser = async () => {
    if (!draft.name.trim()) {
      alert("Name is required.");
      return;
    }

    if (!draft.email.trim()) {
      alert("Email is required.");
      return;
    }

    if (!editing && !draft.password?.trim()) {
      alert("Temporary password is required.");
      return;
    }

    setSaving(true);

    try {
      if (editing?._id) {
        await sendHTTP(
          `/api/v1/user/update/${editing._id}`,
          "post",
          draft
        );
      } else {
        await sendHTTP(
          "/api/v1/user/create",
          "post",
          draft
        );
      }

      setModalOpen(false);
      setEditing(null);

      await loadUsers();
    } catch (e) {
      console.error("Failed to save user", e);
      alert("Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  /* ========================================================= */
  /* DELETE */
  /* ========================================================= */

  const deleteUser = async (u: IUser) => {
    if (!u._id) return;

    if (
      !window.confirm(
        `Remove ${u.name}? This can't be undone.`
      )
    ) {
      return;
    }

    try {
      await sendHTTP(
        `/api/v1/user/delete/${u._id}`,
        "post"
      );

      await loadUsers();
    } catch (e) {
      console.error("Failed to delete user", e);
      alert("Failed to remove user.");
    }
  };

  /* ========================================================= */
  /* RENDER */
  /* ========================================================= */

  return (
    <div className="w-full h-full overflow-y-auto bg-[#0D1117] px-4 py-5 md:px-6 md:py-6 text-white">

      {/* ===================================================== */}
      {/* HEADER */}
      {/* ===================================================== */}

      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>

          {/* Badge */}

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#343B66] bg-[#141A2B] px-3 py-1.5">

            <span className="h-2 w-2 rounded-full bg-[#6C6FF0] shadow-[0_0_12px_#6C6FF0]" />

            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9DA1FF]">
              User management
            </span>

          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Users
          </h1>

          <p className="mt-2 text-[13px] text-[#6E7690]">
            Manage accounts, roles, and access status.
            {" "}
            {admin
              ? "Create, update, or remove users."
              : "View organization members."}
          </p>

        </div>

        <div className="flex items-center gap-2">

          {/* Refresh */}

          <button
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#343B66] bg-[#141A2B] px-4 py-2.5 text-[12px] font-semibold text-[#C6CBDE] transition hover:border-[#6C6FF0] hover:bg-[#1A2035] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            >
              ↻
            </span>

            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

          {/* Create */}

          {admin && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6C6FF0] px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_8px_25px_rgba(108,111,240,0.16)] transition hover:bg-[#7C7FFA] hover:shadow-[0_10px_30px_rgba(108,111,240,0.24)]"
            >
              <span className="text-base leading-none">
                +
              </span>

              Invite user
            </button>
          )}

        </div>

      </div>

      {/* ===================================================== */}
      {/* STAT CARDS */}
      {/* ===================================================== */}

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">

        <StatCard
          label="Total users"
          value={users.length}
          icon="◈"
          accent="#6C6FF0"
        />

        <StatCard
          label="Active"
          value={activeCount}
          icon="●"
          accent="#2FD4B0"
        />

        <StatCard
          label="Pending"
          value={pendingCount}
          icon="◷"
          accent="#F5A623"
        />

        <StatCard
          label="Administrators"
          value={adminCount}
          icon="◆"
          accent="#9DA1FF"
        />

      </div>

      {/* ===================================================== */}
      {/* SEARCH / TOOLBAR */}
      {/* ===================================================== */}

      <div className="mb-4 rounded-2xl border border-[#232A44] bg-[#141A2B] p-3">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div className="relative w-full sm:max-w-md">

            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E7690]"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              />

              <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
              />
            </svg>

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search users, roles, or status..."
              className="w-full rounded-xl border border-[#232A44] bg-[#0D1117] py-2.5 pl-9 pr-3 text-[12px] text-[#E7E9F3] placeholder-[#454C68] outline-none transition focus:border-[#6C6FF0] focus:ring-1 focus:ring-[#6C6FF0]/20"
            />

          </div>

          <div className="flex items-center gap-2 px-1">

            <span className="h-1.5 w-1.5 rounded-full bg-[#2FD4B0] shadow-[0_0_8px_#2FD4B0]" />

            <span className="text-[10px] text-[#6E7690]">
              {filtered.length} of {users.length} users
            </span>

          </div>

        </div>

      </div>

      {/* ===================================================== */}
      {/* USER TABLE */}
      {/* ===================================================== */}

      <div className="overflow-hidden rounded-2xl border border-[#232A44] bg-[#141A2B] shadow-[0_15px_45px_rgba(0,0,0,0.18)]">

        {/* TABLE HEADER */}

        <div className="flex items-center justify-between border-b border-[#232A44] bg-[#111728] px-4 py-3 md:px-5">

          <div>

            <p className="text-[11px] font-semibold text-[#C6CBDE]">
              User directory
            </p>

            <p className="mt-0.5 text-[10px] text-[#454C68]">
              {filtered.length} user
              {filtered.length !== 1
                ? "s"
                : ""}{" "}
              displayed
            </p>

          </div>

          <div className="hidden items-center gap-2 sm:flex">

            <span className="rounded-md border border-[#232A44] bg-[#0D1117] px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-[#454C68]">
              {memberCount} members
            </span>

            <span className="rounded-md border border-[#343B66] bg-[#6C6FF0]/5 px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-[#6C6FF0]">
              {adminCount} admins
            </span>

          </div>

        </div>

        {/* ================================================= */}
        {/* DESKTOP TABLE */}
        {/* ================================================= */}

        <div className="hidden overflow-x-auto md:block">

          <table className="w-full">

            <thead>

              <tr className="border-b border-[#232A44]">

                {[
                  "User",
                  "Role",
                  "Status",
                  "Joined",
                  admin ? "Actions" : "",
                ].map((h, index) => (
                  <th
                    key={`${h}-${index}`}
                    className="px-5 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-[#454C68]"
                  >
                    {h}
                  </th>
                ))}

              </tr>

            </thead>

            <tbody>

              {filtered.map((u, i) => {

                const roleAccent =
                  roleColor[u.role] ??
                  roleColor.Member;

                const stateAccent =
                  statusColor[u.state] ??
                  statusColor.Active;

                return (
                  <tr
                    key={u._id ?? i}
                    className={`group transition-colors hover:bg-[#171D30] ${
                      i !==
                      filtered.length - 1
                        ? "border-b border-[#1D2338]"
                        : ""
                    }`}
                  >

                    {/* USER */}

                    <td className="px-5 py-4">

                      <div className="flex items-center gap-3">

                        <Avatar
                          name={u.name}
                          accent={roleAccent}
                        />

                        <div className="min-w-0">

                          <p className="truncate text-[12.5px] font-semibold text-[#E7E9F3]">

                            {u.name
                              ? u.name
                                  .charAt(0)
                                  .toUpperCase() +
                                u.name.slice(1)
                              : "Unknown user"}

                          </p>

                          <p className="mt-0.5 truncate font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#6E7690]">
                            {u.email}
                          </p>

                        </div>

                      </div>

                    </td>

                    {/* ROLE */}

                    <td className="px-5 py-4">

                      <Badge
                        label={u.role}
                        color={roleAccent}
                      />

                    </td>

                    {/* STATUS */}

                    <td className="px-5 py-4">

                      <div className="flex items-center gap-2">

                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              stateAccent,
                            boxShadow: `0 0 8px ${stateAccent}`,
                          }}
                        />

                        <Badge
                          label={u.state}
                          color={stateAccent}
                        />

                      </div>

                    </td>

                    {/* JOINED */}

                    <td className="px-5 py-4">

                      <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#6E7690]">
                        {u.createdAt
                          ? new Date(
                              u.createdAt
                            ).toLocaleDateString()
                          : "—"}
                      </span>

                    </td>

                    {/* ACTIONS */}

                    <td className="px-5 py-4">

                      {admin ? (
                        <div className="flex items-center gap-2">

                          <button
                            onClick={() =>
                              openEdit(u)
                            }
                            className="rounded-lg border border-[#333B5C] bg-[#111728] px-2.5 py-1.5 text-[10px] font-semibold text-[#8890AC] transition hover:border-[#6C6FF0] hover:bg-[#6C6FF0]/10 hover:text-[#AEB2FF]"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              deleteUser(u)
                            }
                            className="rounded-lg border border-[#4A2A32] bg-[#FF5C6C]/5 px-2.5 py-1.5 text-[10px] font-semibold text-[#FF5C6C] transition hover:bg-[#FF5C6C]/10"
                          >
                            Remove
                          </button>

                        </div>
                      ) : (
                        <span className="text-[11px] text-[#333B5C]">
                          —
                        </span>
                      )}

                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>

        </div>

        {/* ================================================= */}
        {/* MOBILE CARDS */}
        {/* ================================================= */}

        <div className="md:hidden">

          {!loading &&
            filtered.map((u, i) => {

              const roleAccent =
                roleColor[u.role] ??
                roleColor.Member;

              const stateAccent =
                statusColor[u.state] ??
                statusColor.Active;

              return (
                <div
                  key={u._id ?? i}
                  className={`p-4 ${
                    i !==
                    filtered.length - 1
                      ? "border-b border-[#1D2338]"
                      : ""
                  }`}
                >

                  <div className="flex items-start gap-3">

                    <Avatar
                      name={u.name}
                      accent={roleAccent}
                    />

                    <div className="min-w-0 flex-1">

                      <div className="flex items-start justify-between gap-2">

                        <div className="min-w-0">

                          <p className="truncate text-[12.5px] font-semibold text-[#E7E9F3]">
                            {u.name || "Unknown user"}
                          </p>

                          <p className="mt-0.5 truncate font-['IBM_Plex_Mono',monospace] text-[10px] text-[#6E7690]">
                            {u.email}
                          </p>

                        </div>

                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              stateAccent,
                            boxShadow: `0 0 8px ${stateAccent}`,
                          }}
                        />

                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">

                        <Badge
                          label={u.role}
                          color={roleAccent}
                        />

                        <Badge
                          label={u.state}
                          color={stateAccent}
                        />

                        <span className="font-['IBM_Plex_Mono',monospace] text-[9px] text-[#454C68]">
                          Joined{" "}
                          {u.createdAt
                            ? new Date(
                                u.createdAt
                              ).toLocaleDateString()
                            : "—"}
                        </span>

                      </div>

                      {admin && (
                        <div className="mt-3 flex gap-2">

                          <button
                            onClick={() =>
                              openEdit(u)
                            }
                            className="rounded-lg border border-[#333B5C] px-3 py-1.5 text-[10px] font-semibold text-[#8890AC]"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              deleteUser(u)
                            }
                            className="rounded-lg border border-[#4A2A32] px-3 py-1.5 text-[10px] font-semibold text-[#FF5C6C]"
                          >
                            Remove
                          </button>

                        </div>
                      )}

                    </div>

                  </div>

                </div>
              );
            })}

        </div>

        {/* ================================================= */}
        {/* EMPTY */}
        {/* ================================================= */}

        {!loading &&
          filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#343B66] bg-[#6C6FF0]/10 text-xl text-[#9DA1FF]">
                ◌
              </div>

              <p className="text-[13px] font-semibold text-[#C6CBDE]">
                No users found
              </p>

              <p className="mt-1 max-w-sm text-[11px] text-[#454C68]">
                Try changing your search or invite a new user.
              </p>

              {admin && search && (
                <button
                  onClick={() =>
                    setSearch("")
                  }
                  className="mt-4 rounded-lg border border-[#333B5C] px-3 py-1.5 text-[10px] font-semibold text-[#8890AC] transition hover:border-[#6C6FF0] hover:text-[#AEB2FF]"
                >
                  Clear search
                </button>
              )}

            </div>
          )}

        {/* ================================================= */}
        {/* LOADING */}
        {/* ================================================= */}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">

            <div className="mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[#232A44] border-t-[#6C6FF0]" />

            <p className="text-[12px] text-[#6E7690]">
              Loading users...
            </p>

          </div>
        )}

      </div>

      {/* ===================================================== */}
      {/* MODAL */}
      {/* ===================================================== */}

      {modalOpen && admin && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >

          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#343B66] bg-[#141A2B] shadow-[0_30px_100px_rgba(0,0,0,0.55)]"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="flex items-start justify-between border-b border-[#232A44] bg-[#111728] p-5">

              <div>

                <div className="mb-2 flex items-center gap-2">

                  <span className="h-2 w-2 rounded-full bg-[#6C6FF0] shadow-[0_0_10px_#6C6FF0]" />

                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#6E7690]">
                    {editing
                      ? "Account settings"
                      : "New account"}
                  </span>

                </div>

                <h2 className="text-[16px] font-semibold text-white">
                  {editing
                    ? "Edit user"
                    : "Invite user"}
                </h2>

                <p className="mt-1 text-[10px] text-[#454C68]">
                  {editing
                    ? "Update account details and access."
                    : "Create a new user account."}
                </p>

              </div>

              <button
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#252B45] bg-[#141A2B] text-lg text-[#6E7690] transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              >
                ×
              </button>

            </div>

            {/* MODAL CONTENT */}

            <div className="space-y-4 p-5">

              <Field label="Name">

                <input
                  className="w-full rounded-xl border border-[#232A44] bg-[#0D1117] px-3 py-2.5 text-[12px] text-[#E7E9F3] outline-none transition placeholder:text-[#454C68] focus:border-[#6C6FF0] focus:ring-1 focus:ring-[#6C6FF0]/20"
                  placeholder="Enter full name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      name: e.target.value,
                    })
                  }
                />

              </Field>

              <Field label="Email">

                <input
                  type="email"
                  className="w-full rounded-xl border border-[#232A44] bg-[#0D1117] px-3 py-2.5 font-['IBM_Plex_Mono',monospace] text-[11px] text-[#E7E9F3] outline-none transition placeholder:text-[#454C68] focus:border-[#6C6FF0] focus:ring-1 focus:ring-[#6C6FF0]/20"
                  placeholder="user@example.com"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      email: e.target.value,
                    })
                  }
                />

              </Field>

              {!editing && (
                <Field label="Temporary password">

                  <input
                    type="password"
                    className="w-full rounded-xl border border-[#232A44] bg-[#0D1117] px-3 py-2.5 text-[12px] text-[#E7E9F3] outline-none transition placeholder:text-[#454C68] focus:border-[#6C6FF0] focus:ring-1 focus:ring-[#6C6FF0]/20"
                    placeholder="Enter temporary password"
                    value={draft.password ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        password:
                          e.target.value,
                      })
                    }
                  />

                </Field>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <Field label="Role">

                  <Select
                    value={draft.role}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        role: value,
                      })
                    }
                    options={[
                      {
                        value: "Admin",
                        label: "Admin",
                      },
                      {
                        value: "Member",
                        label: "Member",
                      },
                    ]}
                  />

                </Field>

                <Field label="Status">

                  <Select
                    value={draft.state}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        state: value,
                      })
                    }
                    options={[
                      {
                        value: "Active",
                        label: "Active",
                      },
                      {
                        value: "Pending",
                        label: "Pending",
                      },
                      {
                        value: "Inactive",
                        label: "Inactive",
                      },
                    ]}
                  />

                </Field>

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="flex justify-end gap-2 border-t border-[#232A44] bg-[#111728] p-5">

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-[#333B5C] bg-[#141A2B] px-4 py-2.5 text-[11px] font-semibold text-[#8890AC] transition hover:border-[#4A5378] hover:text-[#C6CBDE] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={saveUser}
                disabled={saving}
                className="rounded-xl bg-[#6C6FF0] px-4 py-2.5 text-[11px] font-semibold text-white shadow-[0_8px_25px_rgba(108,111,240,0.12)] transition hover:bg-[#7C7FFA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Create user"}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

/* ============================================================= */
/* STAT CARD */
/* ============================================================= */

function StatCard({
  label,
  value,
  icon,
  accent = "#6C6FF0",
}: {
  label: string;
  value: number;
  icon: string;
  accent?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#232A44] bg-[#141A2B] p-4 transition hover:border-[#343B66]">

      <div
        className="absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-10 blur-2xl transition group-hover:opacity-20"
        style={{
          backgroundColor: accent,
        }}
      />

      <div className="relative flex items-start justify-between">

        <div>

          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#454C68]">
            {label}
          </p>

          <p className="mt-2 text-xl font-bold text-white">
            {value}
          </p>

        </div>

        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-[12px]"
          style={{
            color: accent,
            borderColor: `${accent}25`,
            backgroundColor: `${accent}0D`,
          }}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}

/* ============================================================= */
/* AVATAR */
/* ============================================================= */

function Avatar({
  name,
  accent,
}: {
  name?: string;
  accent: string;
}) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[11px] font-bold"
      style={{
        color: accent,
        borderColor: `${accent}30`,
        backgroundColor: `${accent}0D`,
      }}
    >
      {name?.charAt(0).toUpperCase() || "?"}
    </div>
  );
}

/* ============================================================= */
/* BADGE */
/* ============================================================= */

function Badge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex rounded-md border px-2 py-1 text-[9px] font-semibold"
      style={{
        color,
        borderColor: `${color}25`,
        backgroundColor: `${color}0D`,
      }}
    >
      {label}
    </span>
  );
}

/* ============================================================= */
/* FIELD */
/* ============================================================= */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>

      <label className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-[#454C68]">
        {label}
      </label>

      {children}

    </div>
  );
}

/* ============================================================= */
/* SELECT */
/* ============================================================= */

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) =>
        onChange(e.target.value)
      }
      className="w-full rounded-xl border border-[#232A44] bg-[#0D1117] px-3 py-2.5 text-[12px] text-[#E7E9F3] outline-none transition focus:border-[#6C6FF0] focus:ring-1 focus:ring-[#6C6FF0]/20"
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}