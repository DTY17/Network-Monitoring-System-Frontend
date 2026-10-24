import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import sendHTTP from "../util/axios";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { getSession, isAdmin } from "../util/auth";

// ============================================================
// TYPES
// ============================================================

export interface ISyslogMessage {
  _id?: string;

  priority?: number;
  timestamp?: string;
  facility?: string | number;
  severity?: number;

  msg_tag?: string;
  msg_text?: string;
  raw?: string;

  ipAddress?: string;

  status?: string;

  statusUpdatedBy?: string;
  statusUpdatedAt?: string;

  assignedTo?: string;
  assignedBy?: string;
  assignedDate?: string;

  fixedBy?: string;
  fixedAt?: string;

  approvedBy?: string;
  approvedAt?: string;

  createdAt?: string;
  updatedAt?: string;

  [key: string]: any;
}

interface IUser {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  state?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ApiResponse<T> {
  message?: string;
  data?: T;
  pagination?: Pagination;
}

interface Session {
  userId?: string;
  userName?: string;
  role?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE = 10;

/*
 * IMPORTANT:
 * "fixed" is intentionally NOT included here.
 *
 * Admin Syslog page should only show:
 * pending
 * assigned
 * not_complete
 *
 * Fixed logs are handled by the Approve page.
 */
const STATUS_OPTIONS = ["all", "pending", "assigned", "not_complete"];
const SEVERITY_OPTIONS = ["all", "0", "1", "2", "3", "4", "5", "6", "7"];

// ============================================================
// HELPERS
// ============================================================

function formatDate(value?: string) {
  if (!value) return "—";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  } catch {
    return value;
  }
}

function getSeverityLabel(severity?: number) {
  switch (severity) {
    case 0:
      return "Emergency";

    case 1:
      return "Alert";

    case 2:
      return "Critical";

    case 3:
      return "Error";

    case 4:
      return "Warning";

    case 5:
      return "Notice";

    case 6:
      return "Informational";

    case 7:
      return "Debug";

    default:
      return "Unknown";
  }
}

function getSeverityClass(severity?: number) {
  switch (severity) {
    case 0:
    case 1:
    case 2:
      return "severity-critical";

    case 3:
      return "severity-error";

    case 4:
      return "severity-warning";

    case 5:
      return "severity-notice";

    case 6:
      return "severity-info";

    case 7:
      return "severity-debug";

    default:
      return "severity-unknown";
  }
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "pending":
      return "Pending";

    case "assigned":
      return "Assigned";

    case "fixed":
      return "Fixed · Awaiting Approval";

    case "complete":
      return "Complete";

    case "not_complete":
      return "Not Complete";

    default:
      return status || "Unknown";
  }
}

function getStatusClass(status?: string) {
  switch (status) {
    case "pending":
      return "status-pending";

    case "assigned":
      return "status-assigned";

    case "fixed":
      return "status-fixed";

    case "complete":
      return "status-complete";

    case "not_complete":
      return "status-not-complete";

    default:
      return "status-unknown";
  }
}

// ============================================================
// COMPONENT
// ============================================================

export default function Syslog() {
  // ==========================================================
  // SESSION
  // ==========================================================

  const session = getSession() as Session | null;

  const admin = isAdmin();

  const currentUserId = session?.userId || "";

  // ==========================================================
  // DATA STATE
  // ==========================================================

  const [messages, setMessages] = useState<ISyslogMessage[]>([]);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ==========================================================
  // FILTERS
  // ==========================================================

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [severityFilter, setSeverityFilter] = useState("all");

  const [facilityFilter, setFacilityFilter] = useState("");

  const [tagFilter, setTagFilter] = useState("");

  // ==========================================================
  // DETAILS MODAL
  // ==========================================================

  const [selectedMessage, setSelectedMessage] = useState<ISyslogMessage | null>(
    null,
  );

  // ==========================================================
  // ASSIGNMENT
  // ==========================================================

  const [assignMessage, setAssignMessage] = useState<ISyslogMessage | null>(
    null,
  );

  const [assignedUserId, setAssignedUserId] = useState("");
  const [users, setUsers] = useState<IUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  // ==========================================================
  // SSH
  // ==========================================================

  const [sshMessage, setSshMessage] = useState<ISyslogMessage | null>(null);
  const [sshLoading, setSshLoading] = useState(false);
  const [sshConnected, setSshConnected] = useState(false);
  const [sshError, setSshError] = useState("");
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  // ==========================================================
  // BUILD BACKEND QUERY
  // ==========================================================

  const buildQuery = useCallback(
    (requestedPage: number) => {
      const params = new URLSearchParams();
      params.set("page", String(requestedPage));
      params.set("limit", String(PAGE_SIZE));

      /*
       * Admin:
       * only active logs.
       *
       * Member:
       * assigned endpoint already restricts by user.
       */
      if (admin) {
        params.set("incomplete", "true");
      }

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      if (severityFilter !== "all") {
        params.set("severity", severityFilter);
      }

      if (facilityFilter.trim()) {
        params.set("facility", facilityFilter.trim());
      }

      if (tagFilter.trim()) {
        params.set("tag", tagFilter.trim());
      }

      return params.toString();
    },
    [admin, search, statusFilter, severityFilter, facilityFilter, tagFilter],
  );

  // ==========================================================
  // LOAD USERS
  // ==========================================================

  const loadUsers = useCallback(async () => {
    if (!admin) return;

    try {
      setUsersLoading(true);
      setUsersError("");

      const response = await sendHTTP<ApiResponse<IUser[]> | IUser[]>(
        "/api/v1/user/get",
        "get",
      );

      let userList: IUser[] = [];

      if (Array.isArray(response)) {
        userList = response;
      } else {
        userList = response?.data || [];
      }

      setUsers(userList);
    } catch (err: any) {
      console.error("Failed to load users:", err);

      setUsersError(
        err?.response?.data?.message || err?.message || "Failed to load users.",
      );
    } finally {
      setUsersLoading(false);
    }
  }, [admin]);

  // ==========================================================
  // LOAD MESSAGES
  // ==========================================================

  const loadMessages = useCallback(
    async (requestedPage = 1) => {
      if (!admin && !currentUserId) {
        setMessages([]);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const query = buildQuery(requestedPage);
        let url = "";

        if (admin) {
          url = `/api/v1/notification?${query}`;
        } else {
          url = `/api/v1/notification/assigned/${currentUserId}?${query}`;
        }

        const response = await sendHTTP<ApiResponse<ISyslogMessage[]>>(
          url,
          "get",
        );

        let data = response?.data || [];

        /*
         * SAFETY FILTER
         *
         * Admin Syslog must NEVER show:
         * - fixed
         * - complete
         *
         * Fixed notifications belong to Approve page.
         */
        if (admin) {
          data = data.filter(
            (item) => item.status !== "fixed" && item.status !== "complete",
          );
        }

        /*
         * Member:
         * only show their own assigned notifications.
         */
        if (!admin) {
          data = data.filter(
            (item) => !item.assignedTo || item.assignedTo === currentUserId,
          );

          /*
           * Complete logs should not be shown to the user.
           * Fixed is intentionally kept because it is awaiting
           * admin approval.
           */
          data = data.filter((item) => item.status !== "complete");
        }

        setMessages(data);

        if (response?.pagination) {
          setPagination(response.pagination);
        } else {
          setPagination({
            page: requestedPage,
            limit: PAGE_SIZE,
            total: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / PAGE_SIZE)),
            hasNextPage: false,
            hasPreviousPage: requestedPage > 1,
          });
        }
      } catch (err: any) {
        console.error("Failed to load syslog messages:", err);

        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load syslog messages.",
        );

        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [admin, currentUserId, buildQuery],
  );

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadMessages(1);
  }, [loadMessages]);

  // ==========================================================
  // LOAD USERS
  // ==========================================================

  useEffect(() => {
    if (admin) {
      loadUsers();
    }
  }, [admin, loadUsers]);

  // ==========================================================
  // RESET PAGE WHEN FILTERS CHANGE
  // ==========================================================

  useEffect(() => {
    /*
     * loadMessages already changes when filters change
     * because buildQuery is part of its dependency chain.
     */
  }, [search, statusFilter, severityFilter, facilityFilter, tagFilter]);

  // ==========================================================
  // FILTERED DISPLAY DATA
  // ==========================================================

  const displayedMessages = useMemo(() => {
    let result = [...messages];

    /*
     * Admin safety:
     * never display fixed/complete even if backend accidentally
     * returns them.
     */
    if (admin) {
      result = result.filter(
        (message) =>
          message.status !== "fixed" && message.status !== "complete",
      );
    }

    /*
     * Member safety:
     * never display complete.
     */
    if (!admin) {
      result = result.filter((message) => message.status !== "complete");
    }

    return result;
  }, [messages, admin]);

  // ==========================================================
  // UPDATE STATUS
  // ==========================================================

  const updateStatus = useCallback(
    async (message: ISyslogMessage, status: string) => {
      if (!message._id) return;

      if (!currentUserId) {
        setError("Unable to identify the current user.");
        return;
      }

      const oldMessages = [...messages];

      try {
        setActionLoading(message._id);

        /*
         * Optimistic update
         */
        setMessages((previous) =>
          previous.map((item) =>
            item._id === message._id
              ? {
                  ...item,
                  status,
                  statusUpdatedBy: currentUserId,
                  statusUpdatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );

        await sendHTTP(`/api/v1/notification/status/${message._id}`, "post", {
          status,
          statusUpdatedBy: currentUserId,
        });

        await loadMessages(pagination.page);
      } catch (err: any) {
        console.error("Status update failed:", err);
        setMessages(oldMessages);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to update notification status.",
        );
      } finally {
        setActionLoading(null);
      }
    },
    [currentUserId, messages, loadMessages, pagination.page],
  );

  // ==========================================================
  // ASSIGN TASK
  // ==========================================================

  const assignTask = useCallback(async () => {
    if (!assignMessage?._id) return;

    if (!assignedUserId) {
      setUsersError("Please select a user.");
      return;
    }

    if (!currentUserId) {
      setUsersError("Unable to identify admin user.");
      return;
    }

    try {
      setActionLoading(assignMessage._id);
      setUsersError("");

      await sendHTTP(
        `/api/v1/notification/assign/${assignMessage._id}`,
        "post",
        {
          assignedTo: assignedUserId,
          assignedBy: currentUserId,
        },
      );

      setAssignMessage(null);
      setAssignedUserId("");

      await loadMessages(pagination.page);
    } catch (err: any) {
      console.error("Assignment failed:", err);

      setUsersError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to assign notification.",
      );
    } finally {
      setActionLoading(null);
    }
  }, [
    assignMessage,
    assignedUserId,
    currentUserId,
    loadMessages,
    pagination.page,
  ]);

  // ==========================================================
  // OPEN ASSIGN MODAL
  // ==========================================================

  const openAssignModal = useCallback((message: ISyslogMessage) => {
    setAssignMessage(message);
    setAssignedUserId(message.assignedTo || "");
    setUsersError("");
  }, []);

  // ==========================================================
  // OPEN SSH TERMINAL
  // ==========================================================

  const openSSH = useCallback((message: ISyslogMessage) => {
    setSshMessage(message);
    setSshLoading(true);
    setSshConnected(false);
    setSshError("");
  }, []);

  // ==========================================================
  // CLOSE SSH
  // ==========================================================

  const closeSSH = useCallback(() => {
    try {
      websocketRef.current?.close();
    } catch {
      // ignore
    }
    websocketRef.current = null;
    try {
      terminalInstanceRef.current?.dispose();
    } catch {
      // ignore
    }

    terminalInstanceRef.current = null;
    fitAddonRef.current = null;
    setSshMessage(null);
    setSshLoading(false);
    setSshConnected(false);
    setSshError("");
  }, []);

  // ==========================================================
  // SSH TERMINAL EFFECT
  // ==========================================================

  useEffect(() => {
    if (!sshMessage?._id) {
      return;
    }

    if (!terminalRef.current) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',
      fontSize: 13,
      theme: {
        background: "#0D1117",
        foreground: "#C6CBDE",
        cursor: "#8A8FF7",
        cursorAccent: "#0D1117",
        selectionBackground: "#292F4A",
        black: "#0D1117",
        brightBlack: "#454C68",
      },
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    try {
      requestAnimationFrame(() => {
        fitAddon.fit();
        terminal.focus();
      });
      // fitAddon.fit();
    } catch {
      // ignore
    }

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "localhost";
    const wsUrl =
      `${protocol}//${host}` +
      `:3000/api/v1/notification/ssh-terminal/${sshMessage._id}`;

    const websocket = new WebSocket(wsUrl);
    websocketRef.current = websocket;
    websocket.onopen = () => {
      setSshLoading(false);
      setSshConnected(true);
      terminal.writeln("\x1b[38;5;111mConnected to SSH terminal.\x1b[0m");
    };

    // websocket.onmessage = (event) => {
    //   if (typeof event.data === "string") {
    //     terminal.write(event.data);
    //   }
    // };

    websocket.onmessage = (event: MessageEvent) => {
      console.log("SSH message received:", event.data);

      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "connected":
            console.log("SSH connected:", message.data);

            terminal.writeln(`Connected to ${message.data.hostname}`);
            break;

          case "output":
            // Write only the SSH terminal output, not the JSON.
            terminal.write(message.data);
            break;

          case "error":
            terminal.writeln(`\r\nSSH Error: ${message.data}`);
            console.error("SSH error:", message.data);
            break;

          case "close": {
            const closeMessage = message.message ?? "SSH connection closed";

            console.warn("SSH closed:", closeMessage);
            terminal.writeln(`\r\n\x1b[33m${closeMessage}\x1b[0m`);
            break;
          }
          default:
            console.warn("Unknown SSH message:", message);
        }
      } catch (error) {
        console.error("Invalid SSH WebSocket JSON:", error);
        console.error("Received data:", event.data);
      }
    };

    websocket.onerror = () => {
      setSshLoading(false);
      setSshConnected(false);
      setSshError("Unable to connect to the SSH terminal.");
      terminal.writeln("\r\n\x1b[31mSSH connection error.\x1b[0m");
    };

    websocket.onclose = () => {
      setSshLoading(false);
      setSshConnected(false);
      terminal.writeln("\r\n\x1b[33mSSH connection closed.\x1b[0m");
    };

    const handleTerminalData = (data: string) => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(data);
      }
    };

    terminal.onData(handleTerminalData);

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      try {
        websocket.close();
      } catch {
        // ignore
      }

      try {
        terminal.dispose();
      } catch {
        // ignore
      }

      if (websocketRef.current === websocket) {
        websocketRef.current = null;
      }

      if (terminalInstanceRef.current === terminal) {
        terminalInstanceRef.current = null;
      }

      fitAddonRef.current = null;
    };
  }, [sshMessage]);

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const goToPage = useCallback(
    (page: number) => {
      if (page < 1) return;
      if (pagination.totalPages && page > pagination.totalPages) {
        return;
      }
      loadMessages(page);
    },
    [loadMessages, pagination.totalPages],
  );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="syslog-page">
      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="page-header">
        <div>
          <div className="eyebrow">
            {admin ? "ADMINISTRATION" : "MY ASSIGNED LOGS"}
          </div>

          <h1>{admin ? "Active Syslog" : "My Syslog"}</h1>

          <p>
            {admin
              ? "Active notifications requiring attention."
              : "Incomplete notifications assigned to you."}
          </p>
        </div>

        <button
          className="refresh-btn"
          onClick={() => loadMessages(pagination.page)}
          disabled={loading}
        >
          <span className={loading ? "refresh-icon spinning" : "refresh-icon"}>
            ↻
          </span>
          Refresh
        </button>
      </div>

      {/* ================================================== */}
      {/* ERROR */}
      {/* ================================================== */}

      {error && (
        <div className="error-banner">
          <span className="error-icon">!</span>

          <span>{error}</span>

          <button onClick={() => setError("")} className="error-close">
            ×
          </button>
        </div>
      )}

      {/* ================================================== */}
      {/* FILTERS */}
      {/* ================================================== */}

      <div className="filters-card">
        <div className="filters-header">
          <div>
            <span className="filter-title">Filters</span>

            <span className="filter-subtitle">
              Search and narrow notifications
            </span>
          </div>

          <button
            className="clear-filters"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setSeverityFilter("all");
              setFacilityFilter("");
              setTagFilter("");
            }}
          >
            Clear filters
          </button>
        </div>

        <div className="filters-grid">
          {/* SEARCH */}

          <div className="filter-field search-field">
            <label>Search</label>

            <div className="input-wrapper">
              <span className="input-icon">⌕</span>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search messages..."
              />
            </div>
          </div>

          {/* STATUS */}

          <div className="filter-field">
            <label>Status</label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          {/* SEVERITY */}

          <div className="filter-field">
            <label>Severity</label>

            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
            >
              {SEVERITY_OPTIONS.map((severity) => (
                <option key={severity} value={severity}>
                  {severity === "all"
                    ? "All severities"
                    : `${severity} · ${getSeverityLabel(Number(severity))}`}
                </option>
              ))}
            </select>
          </div>

          {/* FACILITY */}

          <div className="filter-field">
            <label>Facility</label>

            <input
              type="text"
              value={facilityFilter}
              onChange={(event) => setFacilityFilter(event.target.value)}
              placeholder="e.g. local0"
            />
          </div>

          {/* TAG */}

          <div className="filter-field">
            <label>Tag</label>

            <input
              type="text"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="e.g. SYS"
            />
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* TABLE CARD */}
      {/* ================================================== */}

      <div className="table-card">
        <div className="table-header">
          <div>
            <h2>{admin ? "All Active Logs" : "Assigned Logs"}</h2>

            <span className="record-count">{pagination.total} records</span>
          </div>

          <div className="live-indicator">
            <span className="live-dot" />
            Monitoring
          </div>
        </div>

        {/* ================================================= */}
        {/* LOADING */}
        {/* ================================================= */}

        {loading ? (
          <div className="loading-state">
            <div className="spinner" />

            <span>Loading notifications...</span>
          </div>
        ) : displayedMessages.length === 0 ? (
          /* =============================================== */
          /* EMPTY */
          /* =============================================== */

          <div className="empty-state">
            <div className="empty-icon">✓</div>

            <h3>No active logs found</h3>

            <p>
              {admin
                ? "There are currently no active logs requiring attention."
                : "There are no incomplete notifications assigned to you."}
            </p>
          </div>
        ) : (
          /* =============================================== */
          /* TABLE */
          /* =============================================== */

          <div className="table-wrapper">
            <table className="syslog-table">
              <thead>
                <tr>
                  {/* Facility removed */}

                  <th>TIME</th>

                  <th>SEVERITY</th>

                  {/* Tag removed */}

                  <th>MESSAGE</th>

                  <th>STATUS</th>

                  {admin && <th>ASSIGNED TO</th>}

                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {displayedMessages.map((message) => {
                  const isActionLoading = actionLoading === message._id;

                  return (
                    <tr
                      key={
                        message._id ||
                        `${message.timestamp}-${message.msg_text}`
                      }
                    >
                      {/* ================================= */}
                      {/* TIME */}
                      {/* ================================= */}

                      <td className="time-cell">
                        {formatDate(message.timestamp || message.createdAt)}
                      </td>

                      {/* ================================= */}
                      {/* SEVERITY */}
                      {/* ================================= */}

                      <td>
                        <div
                          className={`severity-badge ${getSeverityClass(
                            message.severity,
                          )}`}
                        >
                          <span className="severity-number">
                            {message.severity ?? "?"}
                          </span>

                          <span>{getSeverityLabel(message.severity)}</span>
                        </div>
                      </td>

                      {/* ================================= */}
                      {/* MESSAGE */}
                      {/* ================================= */}

                      <td className="message-cell">
                        <div className="message-content">
                          <span
                            className="message-text"
                            title={message.msg_text || ""}
                          >
                            {message.msg_text || "No message"}
                          </span>

                          {message.msg_tag && (
                            <span className="message-tag-small">
                              {message.msg_tag}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ================================= */}
                      {/* STATUS */}
                      {/* ================================= */}

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            message.status,
                          )}`}
                        >
                          <span className="status-dot" />

                          {getStatusLabel(message.status)}
                        </span>
                      </td>

                      {/* ================================= */}
                      {/* ASSIGNED TO */}
                      {/* ================================= */}

                      {admin && (
                        <td className="assigned-cell">
                          {message.assignedTo ? (
                            <span className="assigned-user">
                              {users.find(
                                (user) => user._id === message.assignedTo,
                              )?.name ||
                                users.find(
                                  (user) => user._id === message.assignedTo,
                                )?.email ||
                                message.assignedTo}
                            </span>
                          ) : (
                            <span className="unassigned">Unassigned</span>
                          )}
                        </td>
                      )}

                      {/* ================================= */}
                      {/* ACTIONS */}
                      {/* ================================= */}

                      <td>
                        <div className="actions">
                          {/* DETAILS */}

                          <button
                            className="action-btn details-btn"
                            onClick={() => setSelectedMessage(message)}
                          >
                            Details
                          </button>

                          {/* SSH */}

                          {message.ipAddress && (
                            <button
                              className="action-btn ssh-btn"
                              onClick={() => openSSH(message)}
                            >
                              SSH
                            </button>
                          )}

                          {/* ================================= */}
                          {/* ADMIN ASSIGN */}
                          {/* ================================= */}

                          {admin &&
                            message.status !== "complete" &&
                            message.status !== "fixed" && (
                              <button
                                className="action-btn assign-btn"
                                onClick={() => openAssignModal(message)}
                                disabled={isActionLoading}
                              >
                                {message.assignedTo ? "Reassign" : "Assign"}
                              </button>
                            )}

                          {/* ================================= */}
                          {/* MEMBER MARK FIXED */}
                          {/* ================================= */}

                          {!admin && message.status === "assigned" && (
                            <button
                              className="action-btn fixed-btn"
                              onClick={() => updateStatus(message, "fixed")}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? "Updating..." : "Mark Fixed"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ================================================= */}
        {/* PAGINATION */}
        {/* ================================================= */}

        {!loading && displayedMessages.length > 0 && (
          <div className="pagination">
            <div className="pagination-info">
              Page <strong>{pagination.page}</strong> of{" "}
              <strong>{pagination.totalPages}</strong>
            </div>

            <div className="pagination-buttons">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={!pagination.hasPreviousPage || pagination.page <= 1}
              >
                ← Previous
              </button>

              <span className="page-number">{pagination.page}</span>

              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={!pagination.hasNextPage}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* DETAILS MODAL */}
      {/* ================================================== */}

      {selectedMessage && (
        <div className="modal-overlay" onClick={() => setSelectedMessage(null)}>
          <div
            className="modal details-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">SYSLOG EVENT</span>

                <h2>Notification Details</h2>
              </div>

              <button
                className="modal-close"
                onClick={() => setSelectedMessage(null)}
              >
                ×
              </button>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <span>Timestamp</span>

                <strong>{formatDate(selectedMessage.timestamp)}</strong>
              </div>

              <div className="detail-item">
                <span>Severity</span>

                <strong>
                  {selectedMessage.severity} ·{" "}
                  {getSeverityLabel(selectedMessage.severity)}
                </strong>
              </div>

              <div className="detail-item">
                <span>Facility</span>

                <strong>{selectedMessage.facility || "—"}</strong>
              </div>

              <div className="detail-item">
                <span>Tag</span>

                <strong>{selectedMessage.msg_tag || "—"}</strong>
              </div>

              <div className="detail-item">
                <span>Device IP</span>

                <strong>{selectedMessage.ipAddress || "—"}</strong>
              </div>

              <div className="detail-item">
                <span>Status</span>

                <strong>{getStatusLabel(selectedMessage.status)}</strong>
              </div>

              <div className="detail-item">
                <span>Assigned To</span>

                <strong>{selectedMessage.assignedTo || "Unassigned"}</strong>
              </div>

              <div className="detail-item">
                <span>Assigned Date</span>

                <strong>{formatDate(selectedMessage.assignedDate)}</strong>
              </div>

              <div className="detail-item">
                <span>Fixed By</span>

                <strong>{selectedMessage.fixedBy || "—"}</strong>
              </div>

              <div className="detail-item">
                <span>Fixed At</span>

                <strong>{formatDate(selectedMessage.fixedAt)}</strong>
              </div>
            </div>

            <div className="message-detail">
              <span>Message</span>

              <div>{selectedMessage.msg_text || "No message"}</div>
            </div>

            <div className="raw-detail">
              <span>Raw Syslog</span>

              <pre>{selectedMessage.raw || "No raw syslog data"}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* ASSIGN MODAL */}
      {/* ================================================== */}

      {assignMessage && (
        <div className="modal-overlay" onClick={() => setAssignMessage(null)}>
          <div
            className="modal assign-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">ADMIN ACTION</span>

                <h2>
                  {assignMessage.assignedTo
                    ? "Reassign Notification"
                    : "Assign Notification"}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() => setAssignMessage(null)}
              >
                ×
              </button>
            </div>

            <div className="assign-summary">
              <span>Notification</span>

              <p>{assignMessage.msg_text || "No message"}</p>
            </div>

            <div className="filter-field">
              <label>Select User</label>

              {usersLoading ? (
                <div className="select-loading">Loading users...</div>
              ) : (
                <select
                  value={assignedUserId}
                  onChange={(event) => setAssignedUserId(event.target.value)}
                >
                  <option value="">Select a user</option>

                  {users
                    .filter((user) => user._id !== currentUserId)
                    .map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.name || user.email || user._id}
                      </option>
                    ))}
                </select>
              )}
            </div>

            {usersError && <div className="modal-error">{usersError}</div>}

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setAssignMessage(null)}
              >
                Cancel
              </button>

              <button
                className="primary-btn"
                onClick={assignTask}
                disabled={
                  !assignedUserId ||
                  actionLoading === assignMessage._id ||
                  usersLoading
                }
              >
                {actionLoading === assignMessage._id
                  ? "Saving..."
                  : assignMessage.assignedTo
                    ? "Reassign"
                    : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* SSH MODAL */}
      {/* ================================================== */}

      {sshMessage && (
        <div className="modal-overlay">
          <div className="modal ssh-modal">
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">REMOTE ACCESS</span>

                <h2>SSH Terminal</h2>

                <p className="ssh-target">
                  {sshMessage.ipAddress || "Unknown device"}
                </p>
              </div>

              <div className="ssh-header-right">
                <span
                  className={
                    sshConnected
                      ? "connection-status connected"
                      : "connection-status"
                  }
                >
                  <span />
                  {sshConnected
                    ? "Connected"
                    : sshLoading
                      ? "Connecting"
                      : "Disconnected"}
                </span>

                <button className="modal-close" onClick={closeSSH}>
                  ×
                </button>
              </div>
            </div>

            {sshError && <div className="modal-error">{sshError}</div>}

            <div ref={terminalRef} className="terminal-container" />

            <div className="ssh-footer">
              <span>Interactive SSH session</span>

              <button className="cancel-btn" onClick={closeSSH}>
                Close Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* STYLES */}
      {/* ================================================== */}

      <style>{`
        * {
          box-sizing: border-box;
        }

        .syslog-page {
          min-height: 100vh;
          padding: 28px;
          background:
            radial-gradient(
              circle at top right,
              rgba(108, 111, 240, 0.07),
              transparent 30%
            ),
            #0D1117;
          color: #C6CBDE;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        /* ================================================
           HEADER
        ================================================ */

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 24px;
        }

        .eyebrow,
        .modal-eyebrow {
          display: block;
          margin-bottom: 7px;
          color: #6C6FF0;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .page-header h1 {
          margin: 0;
          color: #F2F4FA;
          font-size: 27px;
          font-weight: 700;
          letter-spacing: -0.03em;
        }

        .page-header p {
          margin: 7px 0 0;
          color: #6E7690;
          font-size: 13px;
        }

        .refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 38px;
          padding: 0 15px;
          border: 1px solid #292F45;
          border-radius: 9px;
          background: #141A2B;
          color: #C6CBDE;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .refresh-btn:hover:not(:disabled) {
          border-color: #6C6FF0;
          color: #F0F1FF;
          background: #181E31;
        }

        .refresh-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .refresh-icon {
          font-size: 18px;
          line-height: 1;
        }

        .spinning {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        /* ================================================
           ERROR
        ================================================ */

        .error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          padding: 11px 14px;
          border: 1px solid rgba(248, 113, 113, 0.25);
          border-radius: 9px;
          background: rgba(127, 29, 29, 0.18);
          color: #FCA5A5;
          font-size: 12px;
        }

        .error-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 19px;
          height: 19px;
          border-radius: 50%;
          background: rgba(248, 113, 113, 0.15);
          font-weight: 800;
        }

        .error-close {
          margin-left: auto;
          border: 0;
          background: transparent;
          color: #FCA5A5;
          font-size: 18px;
          cursor: pointer;
        }

        /* ================================================
           FILTERS
        ================================================ */

        .filters-card {
          margin-bottom: 18px;
          padding: 18px;
          border: 1px solid #20263A;
          border-radius: 12px;
          background: #111728;
          box-shadow:
            0 12px 30px rgba(0, 0, 0, 0.14);
        }

        .filters-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .filter-title {
          display: block;
          color: #E6E9F3;
          font-size: 13px;
          font-weight: 700;
        }

        .filter-subtitle {
          display: block;
          margin-top: 3px;
          color: #59627C;
          font-size: 11px;
        }

        .clear-filters {
          border: 0;
          background: transparent;
          color: #858BFF;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .clear-filters:hover {
          color: #A4A7FF;
        }

        .filters-grid {
          display: grid;
          grid-template-columns:
            minmax(210px, 1.7fr)
            minmax(150px, 1fr)
            minmax(160px, 1fr)
            minmax(140px, 1fr)
            minmax(140px, 1fr);
          gap: 11px;
        }

        .filter-field {
          min-width: 0;
        }

        .filter-field label {
          display: block;
          margin-bottom: 6px;
          color: #6E7690;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .filter-field input,
        .filter-field select {
          width: 100%;
          height: 37px;
          padding: 0 11px;
          outline: none;
          border: 1px solid #292F45;
          border-radius: 8px;
          background: #0D1117;
          color: #C6CBDE;
          font-size: 12px;
          transition: 0.18s ease;
        }

        .filter-field select {
          cursor: pointer;
        }

        .filter-field input::placeholder {
          color: #454C68;
        }

        .filter-field input:focus,
        .filter-field select:focus {
          border-color: #6C6FF0;
          box-shadow:
            0 0 0 3px rgba(108, 111, 240, 0.08);
        }

        .input-wrapper {
          position: relative;
        }

        .input-wrapper input {
          padding-left: 32px;
        }

        .input-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #59627C;
          font-size: 17px;
          pointer-events: none;
        }

        /* ================================================
           TABLE
        ================================================ */

        .table-card {
          overflow: hidden;
          border: 1px solid #20263A;
          border-radius: 12px;
          background: #111728;
          box-shadow:
            0 14px 35px rgba(0, 0, 0, 0.16);
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 17px 18px;
          border-bottom: 1px solid #20263A;
        }

        .table-header h2 {
          display: inline-block;
          margin: 0;
          color: #E9EBF5;
          font-size: 14px;
          font-weight: 700;
        }

        .record-count {
          margin-left: 9px;
          color: #59627C;
          font-size: 11px;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #69728C;
          font-size: 10px;
          font-weight: 600;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #6EE7B7;
          box-shadow:
            0 0 8px rgba(110, 231, 183, 0.65);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .syslog-table {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
        }

        .syslog-table th {
          padding: 11px 15px;
          border-bottom: 1px solid #20263A;
          background: #0F1421;
          color: #59627C;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-align: left;
          white-space: nowrap;
        }

        .syslog-table td {
          padding: 13px 15px;
          border-bottom: 1px solid rgba(32, 38, 58, 0.72);
          vertical-align: middle;
          font-size: 12px;
        }

        .syslog-table tbody tr {
          transition: background 0.15s ease;
        }

        .syslog-table tbody tr:hover {
          background: rgba(108, 111, 240, 0.035);
        }

        .syslog-table tbody tr:last-child td {
          border-bottom: 0;
        }

        /* ================================================
           TIME
        ================================================ */

        .time-cell {
          min-width: 170px;
          color: #E8EBF5 !important;
          font-family:
            "IBM Plex Mono",
            "Cascadia Mono",
            Consolas,
            monospace;
          font-size: 11px !important;
          font-weight: 500;
          white-space: nowrap;
        }

        /* ================================================
           MESSAGE
        ================================================ */

        .message-cell {
          max-width: 420px;
          min-width: 280px;
        }

        .message-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .message-text {
          overflow: hidden;
          color: #C9CEE0;
          line-height: 1.45;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .message-tag-small {
          width: fit-content;
          padding: 2px 5px;
          border: 1px solid #292F45;
          border-radius: 4px;
          color: #59627C;
          font-family:
            "IBM Plex Mono",
            monospace;
          font-size: 9px;
        }

        /* ================================================
           SEVERITY
        ================================================ */

        .severity-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 7px;
          border: 1px solid transparent;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .severity-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 17px;
          height: 17px;
          border-radius: 4px;
          font-size: 9px;
        }

        .severity-critical {
          border-color: rgba(248, 113, 113, 0.18);
          background: rgba(248, 113, 113, 0.07);
          color: #FCA5A5;
        }

        .severity-critical .severity-number {
          background: rgba(248, 113, 113, 0.16);
        }

        .severity-error {
          border-color: rgba(251, 146, 60, 0.18);
          background: rgba(251, 146, 60, 0.07);
          color: #FDBA74;
        }

        .severity-error .severity-number {
          background: rgba(251, 146, 60, 0.16);
        }

        .severity-warning {
          border-color: rgba(250, 204, 21, 0.18);
          background: rgba(250, 204, 21, 0.06);
          color: #FDE68A;
        }

        .severity-warning .severity-number {
          background: rgba(250, 204, 21, 0.13);
        }

        .severity-notice {
          border-color: rgba(96, 165, 250, 0.18);
          background: rgba(96, 165, 250, 0.06);
          color: #93C5FD;
        }

        .severity-notice .severity-number {
          background: rgba(96, 165, 250, 0.13);
        }

        .severity-info {
          border-color: rgba(110, 231, 183, 0.18);
          background: rgba(110, 231, 183, 0.05);
          color: #86EFAC;
        }

        .severity-info .severity-number {
          background: rgba(110, 231, 183, 0.12);
        }

        .severity-debug,
        .severity-unknown {
          border-color: rgba(148, 163, 184, 0.16);
          background: rgba(148, 163, 184, 0.05);
          color: #AAB2C5;
        }

        .severity-debug .severity-number,
        .severity-unknown .severity-number {
          background: rgba(148, 163, 184, 0.1);
        }

        /* ================================================
           STATUS
        ================================================ */

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .status-pending {
          background: rgba(148, 163, 184, 0.08);
          color: #AAB2C5;
        }

        .status-assigned {
          background: rgba(108, 111, 240, 0.1);
          color: #9B9FFF;
        }

        .status-fixed {
          background: rgba(251, 191, 36, 0.09);
          color: #FCD34D;
        }

        .status-complete {
          background: rgba(52, 211, 153, 0.08);
          color: #6EE7B7;
        }

        .status-not-complete {
          background: rgba(248, 113, 113, 0.08);
          color: #FCA5A5;
        }

        .status-unknown {
          background: rgba(148, 163, 184, 0.08);
          color: #AAB2C5;
        }

        /* ================================================
           ASSIGNED
        ================================================ */

        .assigned-cell {
          max-width: 150px;
        }

        .assigned-user {
          display: block;
          overflow: hidden;
          color: #B8BED1;
          font-size: 11px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .unassigned {
          color: #505971;
          font-size: 11px;
          font-style: italic;
        }

        /* ================================================
           ACTIONS
        ================================================ */

        .actions {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }

        .action-btn {
          height: 29px;
          padding: 0 9px;
          border: 1px solid #292F45;
          border-radius: 6px;
          background: #141A2B;
          color: #9DA5BB;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.15s ease;
          white-space: nowrap;
        }

        .action-btn:hover:not(:disabled) {
          border-color: #454C68;
          color: #E5E7F0;
          background: #181E31;
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .details-btn:hover:not(:disabled) {
          border-color: #6C6FF0;
          color: #A5A8FF;
        }

        .ssh-btn:hover:not(:disabled) {
          border-color: #4B9EFF;
          color: #79B8FF;
        }

        .assign-btn:hover:not(:disabled) {
          border-color: #8B8FF7;
          color: #A9ACFF;
        }

        .fixed-btn:hover:not(:disabled) {
          border-color: #34D399;
          color: #6EE7B7;
        }

        /* ================================================
           LOADING / EMPTY
        ================================================ */

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 280px;
          padding: 35px;
        }

        .loading-state {
          gap: 12px;
          color: #69728C;
          font-size: 12px;
        }

        .spinner {
          width: 25px;
          height: 25px;
          border: 2px solid #292F45;
          border-top-color: #6C6FF0;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          margin-bottom: 13px;
          border: 1px solid rgba(110, 231, 183, 0.2);
          border-radius: 50%;
          background: rgba(110, 231, 183, 0.06);
          color: #6EE7B7;
          font-size: 17px;
        }

        .empty-state h3 {
          margin: 0;
          color: #D9DDEA;
          font-size: 14px;
        }

        .empty-state p {
          max-width: 420px;
          margin: 7px 0 0;
          color: #59627C;
          font-size: 11px;
          text-align: center;
        }

        /* ================================================
           PAGINATION
        ================================================ */

        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 13px 17px;
          border-top: 1px solid #20263A;
        }

        .pagination-info {
          color: #59627C;
          font-size: 11px;
        }

        .pagination-info strong {
          color: #AEB5C8;
        }

        .pagination-buttons {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pagination-buttons button,
        .page-number {
          height: 30px;
          padding: 0 10px;
          border: 1px solid #292F45;
          border-radius: 6px;
          background: #141A2B;
          color: #9DA5BB;
          font-size: 10px;
          font-weight: 600;
        }

        .pagination-buttons button {
          cursor: pointer;
        }

        .pagination-buttons button:hover:not(:disabled) {
          border-color: #6C6FF0;
          color: #A5A8FF;
        }

        .pagination-buttons button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .page-number {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          background: rgba(108, 111, 240, 0.1);
          border-color: rgba(108, 111, 240, 0.25);
          color: #A5A8FF;
        }

        /* ================================================
           MODAL
        ================================================ */

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(3, 6, 12, 0.78);
          backdrop-filter: blur(5px);
        }

        .modal {
          width: min(700px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          border: 1px solid #292F45;
          border-radius: 13px;
          background: #111728;
          box-shadow:
            0 25px 70px rgba(0, 0, 0, 0.5);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 19px;
          border-bottom: 1px solid #20263A;
        }

        .modal-header h2 {
          margin: 0;
          color: #EFF1F8;
          font-size: 17px;
        }

        .modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: 1px solid #292F45;
          border-radius: 7px;
          background: #141A2B;
          color: #7C849B;
          font-size: 19px;
          cursor: pointer;
        }

        .modal-close:hover {
          border-color: #454C68;
          color: #D7DBE8;
        }

        /* ================================================
           DETAILS
        ================================================ */

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1px;
          margin: 17px;
          overflow: hidden;
          border: 1px solid #20263A;
          border-radius: 8px;
          background: #20263A;
        }

        .detail-item {
          min-width: 0;
          padding: 11px;
          background: #0F1421;
        }

        .detail-item span {
          display: block;
          margin-bottom: 5px;
          color: #59627C;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .detail-item strong {
          display: block;
          overflow: hidden;
          color: #C9CEE0;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .message-detail,
        .raw-detail {
          margin: 0 17px 17px;
        }

        .message-detail > span,
        .raw-detail > span {
          display: block;
          margin-bottom: 7px;
          color: #59627C;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .message-detail > div {
          padding: 12px;
          border: 1px solid #20263A;
          border-radius: 8px;
          background: #0D1117;
          color: #C9CEE0;
          font-size: 12px;
          line-height: 1.5;
        }

        .raw-detail pre {
          max-height: 220px;
          overflow: auto;
          margin: 0;
          padding: 13px;
          border: 1px solid #20263A;
          border-radius: 8px;
          background: #0D1117;
          color: #9EA7BD;
          font-family:
            "IBM Plex Mono",
            "Cascadia Mono",
            Consolas,
            monospace;
          font-size: 10px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }

        /* ================================================
           ASSIGN
        ================================================ */

        .assign-modal {
          width: min(500px, 100%);
        }

        .assign-summary {
          margin: 17px;
          padding: 12px;
          border: 1px solid #20263A;
          border-radius: 8px;
          background: #0F1421;
        }

        .assign-summary span {
          display: block;
          margin-bottom: 6px;
          color: #59627C;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .assign-summary p {
          margin: 0;
          overflow: hidden;
          color: #C9CEE0;
          font-size: 12px;
          line-height: 1.5;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .assign-modal > .filter-field {
          margin: 17px;
        }

        .select-loading {
          display: flex;
          align-items: center;
          height: 37px;
          padding: 0 11px;
          border: 1px solid #292F45;
          border-radius: 8px;
          background: #0D1117;
          color: #59627C;
          font-size: 11px;
        }

        .modal-error {
          margin: 0 17px 15px;
          padding: 10px;
          border: 1px solid rgba(248, 113, 113, 0.2);
          border-radius: 7px;
          background: rgba(248, 113, 113, 0.06);
          color: #FCA5A5;
          font-size: 11px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
          padding: 15px 17px;
          border-top: 1px solid #20263A;
        }

        .cancel-btn,
        .primary-btn {
          height: 35px;
          padding: 0 13px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .cancel-btn {
          border: 1px solid #292F45;
          background: #141A2B;
          color: #9DA5BB;
        }

        .cancel-btn:hover {
          border-color: #454C68;
          color: #E0E3ED;
        }

        .primary-btn {
          border: 1px solid #6C6FF0;
          background: #6C6FF0;
          color: #FFFFFF;
        }

        .primary-btn:hover:not(:disabled) {
          background: #7A7EF3;
        }

        .primary-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* ================================================
           SSH
        ================================================ */

        .ssh-modal {
          width: min(1000px, 100%);
        }

        .ssh-target {
          margin: 5px 0 0;
          color: #59627C;
          font-family:
            "IBM Plex Mono",
            monospace;
          font-size: 10px;
        }

        .ssh-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .connection-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #69728C;
          font-size: 10px;
          font-weight: 700;
        }

        .connection-status > span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #59627C;
        }

        .connection-status.connected {
          color: #6EE7B7;
        }

        .connection-status.connected > span {
          background: #6EE7B7;
          box-shadow:
            0 0 7px rgba(110, 231, 183, 0.55);
        }

        .terminal-container {
          height: 500px;
          margin: 17px;
          padding: 8px;
          overflow: hidden;
          border: 1px solid #20263A;
          border-radius: 8px;
          background: #0D1117;
        }

        .ssh-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 13px 17px;
          border-top: 1px solid #20263A;
        }

        .ssh-footer > span {
          color: #59627C;
          font-size: 10px;
        }

        /* ================================================
           RESPONSIVE
        ================================================ */

        @media (max-width: 1100px) {
          .filters-grid {
            grid-template-columns:
              repeat(3, minmax(150px, 1fr));
          }

          .search-field {
            grid-column: span 2;
          }
        }

        @media (max-width: 760px) {
          .syslog-page {
            padding: 17px;
          }

          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .filters-grid {
            grid-template-columns: 1fr;
          }

          .search-field {
            grid-column: auto;
          }

          .filters-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .pagination {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .terminal-container {
            height: 400px;
          }
        }

        @media (max-width: 500px) {
          .syslog-page {
            padding: 12px;
          }

          .page-header h1 {
            font-size: 23px;
          }

          .table-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
          }

          .modal-overlay {
            padding: 10px;
          }

          .modal {
            max-height: calc(100vh - 20px);
          }
        }
      `}</style>
    </div>
  );
}
