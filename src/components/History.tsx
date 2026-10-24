import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

import sendHTTP from "../util/axios";
import { getSession, isAdmin } from "../util/auth";

// ============================================================
// TYPES
// ============================================================

interface IHistory {
  _id: string;

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

  approvedBy?: string;
  approvedAt?: string;

  assignedTo?: string;
  assignedBy?: string;
  assignedDate?: string;

  fixedBy?: string;
  fixedAt?: string;
}

// ============================================================
// STATUS CONFIG
// ============================================================

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  pending: {
    label: "Pending",
    color: "#9CA3AF",
    bg: "rgba(156, 163, 175, 0.10)",
    border: "rgba(156, 163, 175, 0.25)",
  },

  assigned: {
    label: "Assigned",
    color: "#60A5FA",
    bg: "rgba(96, 165, 250, 0.10)",
    border: "rgba(96, 165, 250, 0.25)",
  },

  fixed: {
    label: "Fixed · awaiting approval",
    color: "#F59E0B",
    bg: "rgba(245, 158, 11, 0.10)",
    border: "rgba(245, 158, 11, 0.25)",
  },

  complete: {
    label: "Complete",
    color: "#2DD4BF",
    bg: "rgba(45, 212, 191, 0.10)",
    border: "rgba(45, 212, 191, 0.25)",
  },

  not_complete: {
    label: "Not Complete",
    color: "#EF4444",
    bg: "rgba(239, 68, 68, 0.10)",
    border: "rgba(239, 68, 68, 0.25)",
  },
};

// ============================================================
// SEVERITY CONFIG
// ============================================================

const SEVERITY_CONFIG: Record<
  number,
  {
    label: string;
    color: string;
    bg: string;
  }
> = {
  0: {
    label: "Emergency",
    color: "#EF4444",
    bg: "rgba(239, 68, 68, 0.12)",
  },

  1: {
    label: "Alert",
    color: "#F97316",
    bg: "rgba(249, 115, 22, 0.12)",
  },

  2: {
    label: "Critical",
    color: "#F97316",
    bg: "rgba(249, 115, 22, 0.12)",
  },

  3: {
    label: "Error",
    color: "#FB923C",
    bg: "rgba(251, 146, 60, 0.12)",
  },

  4: {
    label: "Warning",
    color: "#F59E0B",
    bg: "rgba(245, 158, 11, 0.12)",
  },

  5: {
    label: "Notice",
    color: "#60A5FA",
    bg: "rgba(96, 165, 250, 0.12)",
  },

  6: {
    label: "Informational",
    color: "#2DD4BF",
    bg: "rgba(45, 212, 191, 0.12)",
  },

  7: {
    label: "Debug",
    color: "#6B7280",
    bg: "rgba(107, 114, 128, 0.12)",
  },
};

// ============================================================
// HELPERS
// ============================================================

function normalizeStatus(status?: string) {
  if (!status) {
    return "pending";
  }

  if (STATUS_CONFIG[status]) {
    return status;
  }

  return "pending";
}

function formatDate(date?: string) {
  if (!date) {
    return "N/A";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleString();
}

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ status }: { status?: string }) {
  const normalized = normalizeStatus(status);

  const config =
    STATUS_CONFIG[normalized] || STATUS_CONFIG.pending;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: "5px 9px",
        borderRadius: "7px",
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        fontSize: "11px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: config.color,
          boxShadow: `0 0 7px ${config.color}`,
        }}
      />

      {config.label}
    </span>
  );
}

// ============================================================
// SEVERITY BADGE
// ============================================================

function SeverityBadge({ severity }: { severity?: number }) {
  const level =
    typeof severity === "number" ? severity : 7;

  const config =
    SEVERITY_CONFIG[level] || SEVERITY_CONFIG[7];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px",
        borderRadius: "6px",
        background: config.bg,
        color: config.color,
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.3px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          fontFamily: "IBM Plex Mono, monospace",
        }}
      >
        {level}
      </span>

      <span>{config.label}</span>
    </span>
  );
}

// ============================================================
// INFO ITEM
// ============================================================

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | number;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: "10px",
          color: "#6E7690",
          textTransform: "uppercase",
          letterSpacing: "0.7px",
          fontWeight: 600,
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: "12px",
          color: "#C6CBDE",
          fontFamily: mono
            ? "IBM Plex Mono, monospace"
            : "inherit",
          wordBreak: "break-word",
        }}
      >
        {value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
          ? value
          : "N/A"}
      </span>
    </div>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div
      style={{
        background: "#141A2B",
        border: "1px solid #252C42",
        borderRadius: "12px",
        padding: "16px 18px",
        boxShadow: "0 8px 25px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "#6E7690",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          fontWeight: 600,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          fontSize: "25px",
          fontWeight: 700,
          color: "#C6CBDE",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "4px",
          fontSize: "10px",
          color: "#454C68",
        }}
      >
        {description}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function History() {
  // ==========================================================
  // HISTORY STATE
  // ==========================================================

  const [history, setHistory] = useState<IHistory[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [selected, setSelected] =
    useState<IHistory | null>(null);

  const [showDetails, setShowDetails] =
    useState(false);

  // ==========================================================
  // FILTER
  // ==========================================================

  const [search, setSearch] = useState("");

  // ==========================================================
  // SSH STATE
  // ==========================================================

  const [showSSH, setShowSSH] = useState(false);

  const [sshStatus, setSSHStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");

  const [sshError, setSSHError] = useState("");

  const [sshInfo, setSSHInfo] = useState<{
    hostname?: string;
    ipAddress?: string;
    sshHost?: string;
    sshPort?: number;
    username?: string;
  } | null>(null);

  // ==========================================================
  // REFS
  // ==========================================================

  const terminalContainerRef =
    useRef<HTMLDivElement | null>(null);

  const terminalRef =
    useRef<Terminal | null>(null);

  const socketRef =
    useRef<WebSocket | null>(null);

  // ==========================================================
  // LOAD HISTORY
  // ==========================================================

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const session = getSession();

        let url =
          "/api/v1/notification/history/all";

        if (!isAdmin()) {
          url =
            `/api/v1/notification/history/user/${session.userId}`;
        }

        const response = await sendHTTP<{
          message: string;
          data: IHistory[];
        }>(url, "get");

        const backendData =
          Array.isArray(response.data)
            ? response.data
            : [];

        console.log(
          "================================",
        );

        console.log(
          "📜 HISTORY DATA FROM BACKEND",
        );

        console.log(
          "================================",
        );

        console.log(backendData);

        // ======================================================
        // ONLY COMPLETE LOGS
        // ======================================================

        const completeLogs = backendData.filter(
          (item) =>
            normalizeStatus(item.status) ===
            "complete",
        );

        setHistory(completeLogs);
      } catch (err) {
        console.error(
          "Failed to load history:",
          err,
        );

        setError(
          "Failed to load notification history.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  // ==========================================================
  // FILTERED HISTORY
  // ==========================================================

  const filteredHistory = history.filter(
    (item) => {
      const searchValue =
        search.trim().toLowerCase();

      if (searchValue === "") {
        return true;
      }

      return (
        String(item.msg_text || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(item.msg_tag || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(item.facility || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(item.ipAddress || "")
          .toLowerCase()
          .includes(searchValue)
      );
    },
  );

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const totalCount = history.length;

  const completeCount = history.filter(
    (item) =>
      normalizeStatus(item.status) ===
      "complete",
  ).length;

  // ==========================================================
  // OPEN DETAILS
  // ==========================================================

  function openDetails(item: IHistory) {
    console.log(
      "================================",
    );

    console.log(
      "SELECTED HISTORY ITEM",
    );

    console.log(
      "================================",
    );

    console.log("Full item:", item);

    console.log(
      "Device IP:",
      item.ipAddress,
    );

    setSelected(item);
    setShowDetails(true);
  }

  // ==========================================================
  // CLOSE DETAILS
  // ==========================================================

  function closeDetails() {
    setShowDetails(false);
    setSelected(null);
  }

  // ==========================================================
  // CLOSE SSH
  // ==========================================================

  function closeSSH() {
    console.log(
      "🔌 Closing SSH terminal...",
    );

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (error) {
        console.error(
          "WebSocket close error:",
          error,
        );
      }

      socketRef.current = null;
    }

    if (terminalRef.current) {
      try {
        terminalRef.current.dispose();
      } catch (error) {
        console.error(
          "Terminal dispose error:",
          error,
        );
      }

      terminalRef.current = null;
    }

    setSSHStatus("disconnected");

    setSSHError("");

    setSSHInfo(null);

    setShowSSH(false);
  }

  // ==========================================================
  // OPEN SSH TERMINAL
  // ==========================================================

  function openSSH(item: IHistory) {
    console.log(
      "================================",
    );

    console.log(
      "OPENING SSH TERMINAL",
    );

    console.log(
      "================================",
    );

    console.log(
      "Notification ID:",
      item._id,
    );

    console.log(
      "Device IP:",
      item.ipAddress,
    );

    if (!item._id) {
      setSSHError(
        "Notification ID is missing.",
      );

      setSSHStatus("error");

      setShowSSH(true);

      return;
    }

    if (
      !item.ipAddress ||
      item.ipAddress.trim() === ""
    ) {
      console.warn(
        "⚠️ History item has no ipAddress.",
      );

      setSSHError(
        "This notification does not contain a device IP address.",
      );

      setSSHStatus("error");

      setShowSSH(true);

      return;
    }

    setSelected(item);

    setShowDetails(false);

    setShowSSH(true);

    setSSHStatus("connecting");

    setSSHError("");

    setSSHInfo(null);

    setTimeout(() => {
      connectSSH(item._id);
    }, 100);
  }

  // ==========================================================
  // CONNECT SSH
  // ==========================================================

  function connectSSH(
    notificationId: string,
  ) {
    if (!terminalContainerRef.current) {
      console.error(
        "❌ Terminal container not available.",
      );

      setSSHError(
        "Terminal container is not available.",
      );

      setSSHStatus("error");

      return;
    }

    // ========================================================
    // CLEANUP PREVIOUS TERMINAL
    // ========================================================

    if (terminalRef.current) {
      try {
        terminalRef.current.dispose();
      } catch {}
    }

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {}
    }

    terminalContainerRef.current.innerHTML =
      "";

    // ========================================================
    // CREATE TERMINAL
    // ========================================================

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      scrollback: 5000,

      fontFamily:
        "IBM Plex Mono, Consolas, monospace",

      fontSize: 13,

      theme: {
        background: "#0D1117",
        foreground: "#C6CBDE",
        cursor: "#6C6FF0",
        cursorAccent: "#0D1117",

        black: "#0D1117",
        red: "#EF4444",
        green: "#2DD4BF",
        yellow: "#F59E0B",
        blue: "#60A5FA",
        magenta: "#A78BFA",
        cyan: "#22D3EE",
        white: "#C6CBDE",

        brightBlack: "#454C68",
        brightRed: "#F87171",
        brightGreen: "#5EEAD4",
        brightYellow: "#FBBF24",
        brightBlue: "#93C5FD",
        brightMagenta: "#C4B5FD",
        brightCyan: "#67E8F9",
        brightWhite: "#FFFFFF",
      },
    });

    terminal.open(
      terminalContainerRef.current,
    );

    terminalRef.current = terminal;

    terminal.write(
      "\x1b[90mConnecting to Cisco device...\x1b[0m\r\n",
    );

    // ========================================================
    // WEBSOCKET URL
    // ========================================================

    const protocol =
      window.location.protocol === "https:"
        ? "wss:"
        : "ws:";

    const hostname =
      window.location.hostname ||
      "localhost";

    const websocketURL =
      `${protocol}//${hostname}:3000/api/v1/notification/ssh-terminal/${notificationId}`;

    console.log(
      "🔌 WebSocket URL:",
      websocketURL,
    );

    // ========================================================
    // CREATE SOCKET
    // ========================================================

    const socket =
      new WebSocket(websocketURL);

    socketRef.current = socket;

    // ========================================================
    // SOCKET OPEN
    // ========================================================

    socket.onopen = () => {
      console.log(
        "✅ WebSocket connected.",
      );

      sendResize(socket, terminal);
    };

    // ========================================================
    // SOCKET MESSAGE
    // ========================================================

    socket.onmessage = (event) => {
      try {
        const message =
          JSON.parse(event.data);

        console.log(
          "SSH message:",
          message,
        );

        // ====================================================
        // CONNECTED
        // ====================================================

        if (
          message.type ===
          "connected"
        ) {
          setSSHStatus("connected");

          setSSHInfo(message.data);

          terminal.write(
            "\r\n\x1b[32m✓ SSH connected\x1b[0m\r\n\r\n",
          );

          return;
        }

        // ====================================================
        // OUTPUT
        // ====================================================

        if (
          message.type === "output"
        ) {
          if (
            typeof message.data ===
            "string"
          ) {
            terminal.write(
              message.data,
            );
          }

          return;
        }

        // ====================================================
        // ERROR
        // ====================================================

        if (
          message.type === "error"
        ) {
          const errorMessage =
            message.message ||
            "SSH connection error";

          console.error(
            "❌ SSH error:",
            errorMessage,
          );

          setSSHStatus("error");

          setSSHError(
            errorMessage,
          );

          terminal.write(
            `\r\n\x1b[31m✗ ${errorMessage}\x1b[0m\r\n`,
          );

          return;
        }

        // ====================================================
        // CLOSE
        // ====================================================

        if (
          message.type === "close"
        ) {
          console.log(
            "🔌 SSH connection closed.",
          );

          setSSHStatus(
            "disconnected",
          );

          return;
        }
      } catch (error) {
        console.error(
          "❌ Failed to parse SSH message:",
          error,
        );
      }
    };

    // ========================================================
    // SOCKET ERROR
    // ========================================================

    socket.onerror = (event) => {
      console.error(
        "❌ WebSocket error:",
        event,
      );

      setSSHStatus("error");

      setSSHError(
        "Unable to connect to SSH terminal.",
      );

      terminal.write(
        "\r\n\x1b[31m✗ WebSocket connection error\x1b[0m\r\n",
      );
    };

    // ========================================================
    // SOCKET CLOSE
    // ========================================================

    socket.onclose = () => {
      console.log(
        "🔌 WebSocket closed.",
      );

      setSSHStatus(
        "disconnected",
      );
    };

    // ========================================================
    // TERMINAL INPUT
    // ========================================================

    terminal.onData((data) => {
      if (
        socket.readyState ===
        WebSocket.OPEN
      ) {
        socket.send(
          JSON.stringify({
            type: "input",
            data,
          }),
        );
      }
    });

    // ========================================================
    // TERMINAL RESIZE
    // ========================================================

    terminal.onResize(
      ({ cols, rows }) => {
        sendResize(
          socket,
          terminal,
          cols,
          rows,
        );
      },
    );

    // ========================================================
    // INITIAL RESIZE
    // ========================================================

    sendResize(
      socket,
      terminal,
    );
  }

  // ==========================================================
  // SEND RESIZE
  // ==========================================================

  function sendResize(
    socket: WebSocket,
    terminal: Terminal,
    cols?: number,
    rows?: number,
  ) {
    if (
      socket.readyState !==
      WebSocket.OPEN
    ) {
      return;
    }

    const terminalCols =
      cols || terminal.cols;

    const terminalRows =
      rows || terminal.rows;

    if (
      terminalCols <= 0 ||
      terminalRows <= 0
    ) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "resize",
        cols: terminalCols,
        rows: terminalRows,
      }),
    );
  }

  // ==========================================================
  // CLEANUP
  // ==========================================================

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {}
      }

      if (terminalRef.current) {
        try {
          terminalRef.current.dispose();
        } catch {}
      }
    };
  }, []);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0D1117",
        color: "#C6CBDE",
        padding: "25px",
      }}
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "22px",
          gap: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              color: "#C6CBDE",
            }}
          >
            Notification History
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#6E7690",
              fontSize: "12px",
            }}
          >
            Completed syslog notifications
            and device activity
          </p>
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#454C68",
          }}
        >
          {isAdmin()
            ? "Administrator"
            : "Member"}
        </div>
      </div>

      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 15px",
            borderRadius: "9px",
            border:
              "1px solid rgba(239,68,68,0.25)",
            background:
              "rgba(239,68,68,0.08)",
            color: "#EF4444",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      {/* =====================================================
          STATISTICS
      ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <StatCard
          label="Total Completed"
          value={totalCount}
          description="All completed notifications"
        />

        <StatCard
          label="Complete"
          value={completeCount}
          description="Approved and completed"
        />
      </div>

      {/* =====================================================
          SEARCH
      ====================================================== */}

      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search completed messages..."
          style={{
            flex: "1 1 300px",
            minWidth: "220px",
            background: "#141A2B",
            color: "#C6CBDE",
            border:
              "1px solid #252C42",
            borderRadius: "8px",
            padding: "10px 12px",
            outline: "none",
            fontSize: "12px",
          }}
        />
      </div>

      {/* =====================================================
          TABLE
      ====================================================== */}

      <div
        style={{
          background: "#111728",
          border:
            "1px solid #252C42",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.18)",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              color: "#6E7690",
              fontSize: "12px",
            }}
          >
            Loading notification
            history...
          </div>
        ) : filteredHistory.length ===
          0 ? (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              color: "#6E7690",
              fontSize: "12px",
            }}
          >
            No completed notification
            history found.
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                minWidth: "760px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#141A2B",
                    borderBottom:
                      "1px solid #252C42",
                  }}
                >
                  {/* STATUS */}

                  <th
                    style={thStyle}
                  >
                    Status
                  </th>

                  {/* UPDATED */}

                  <th
                    style={thStyle}
                  >
                    Updated
                  </th>

                  {/* UPDATED BY */}

                  {isAdmin() && (
                    <th
                      style={thStyle}
                    >
                      Updated By
                    </th>
                  )}

                  {/* MESSAGE */}

                  <th
                    style={thStyle}
                  >
                    Message
                  </th>

                  {/* ACTION */}

                  <th
                    style={{
                      ...thStyle,
                      textAlign:
                        "right",
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredHistory.map(
                  (item) => (
                    <tr
                      key={item._id}
                      style={{
                        borderBottom:
                          "1px solid #1D2436",
                      }}
                    >
                      {/* STATUS */}

                      <td
                        style={tdStyle}
                      >
                        <StatusBadge
                          status={
                            item.status
                          }
                        />
                      </td>

                      {/* UPDATED */}

                      <td
                        style={{
                          ...tdStyle,
                          fontSize:
                            "11px",
                          color:
                            "#C6CBDE",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {formatDate(
                          item.statusUpdatedAt,
                        )}
                      </td>

                      {/* UPDATED BY */}

                      {isAdmin() && (
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily:
                              "IBM Plex Mono, monospace",
                            fontSize:
                              "11px",
                            color:
                              "#8B8FF7",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {item.statusUpdatedBy ||
                            "N/A"}
                        </td>
                      )}

                      {/* MESSAGE */}

                      <td
                        style={{
                          ...tdStyle,
                          maxWidth:
                            "500px",
                        }}
                      >
                        <div
                          style={{
                            overflow:
                              "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace:
                              "nowrap",
                            color:
                              "#C6CBDE",
                            fontSize:
                              "11px",
                          }}
                          title={
                            item.msg_text ||
                            ""
                          }
                        >
                          {item.msg_text ||
                            "N/A"}
                        </div>
                      </td>

                      {/* ACTION */}

                      <td
                        style={{
                          ...tdStyle,
                          textAlign:
                            "right",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {/* DETAILS */}

                        <button
                          onClick={() =>
                            openDetails(
                              item,
                            )
                          }
                          style={{
                            border:
                              "1px solid #303851",
                            background:
                              "#141A2B",
                            color:
                              "#8B8FF7",
                            padding:
                              "7px 10px",
                            borderRadius:
                              "7px",
                            cursor:
                              "pointer",
                            fontSize:
                              "11px",
                            marginRight:
                              "6px",
                          }}
                        >
                          Details
                        </button>

                        {/* SSH */}

                        <button
                          onClick={() =>
                            openSSH(
                              item,
                            )
                          }
                          disabled={
                            !item.ipAddress
                          }
                          title={
                            item.ipAddress
                              ? "Open SSH terminal"
                              : "No device IP available"
                          }
                          style={{
                            border:
                              "1px solid rgba(108,111,240,0.35)",
                            background:
                              item.ipAddress
                                ? "rgba(108,111,240,0.10)"
                                : "#141A2B",
                            color:
                              item.ipAddress
                                ? "#8B8FF7"
                                : "#454C68",
                            padding:
                              "7px 10px",
                            borderRadius:
                              "7px",
                            cursor:
                              item.ipAddress
                                ? "pointer"
                                : "not-allowed",
                            fontSize:
                              "11px",
                            opacity:
                              item.ipAddress
                                ? 1
                                : 0.6,
                          }}
                        >
                          SSH
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================
          DETAILS MODAL
      ====================================================== */}

      {showDetails &&
        selected && (
          <div
            onClick={
              closeDetails
            }
            style={{
              position:
                "fixed",
              inset: 0,
              background:
                "rgba(0,0,0,0.70)",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding: "20px",
              zIndex: 1000,
            }}
          >
            <div
              onClick={(event) =>
                event.stopPropagation()
              }
              style={{
                width:
                  "min(900px, 100%)",
                maxHeight:
                  "90vh",
                overflowY:
                  "auto",
                background:
                  "#111728",
                border:
                  "1px solid #2A3249",
                borderRadius:
                  "14px",
                boxShadow:
                  "0 25px 80px rgba(0,0,0,0.45)",
              }}
            >
              {/* HEADER */}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  padding:
                    "18px 20px",
                  borderBottom:
                    "1px solid #252C42",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:
                        "16px",
                      fontWeight:
                        700,
                      color:
                        "#C6CBDE",
                    }}
                  >
                    Notification
                    Details
                  </div>

                  <div
                    style={{
                      marginTop:
                        "4px",
                      fontSize:
                        "10px",
                      color:
                        "#454C68",
                      fontFamily:
                        "IBM Plex Mono, monospace",
                    }}
                  >
                    {selected._id}
                  </div>
                </div>

                <button
                  onClick={
                    closeDetails
                  }
                  style={{
                    width:
                      "30px",
                    height:
                      "30px",
                    borderRadius:
                      "7px",
                    border:
                      "1px solid #303851",
                    background:
                      "#141A2B",
                    color:
                      "#6E7690",
                    cursor:
                      "pointer",
                    fontSize:
                      "16px",
                  }}
                >
                  ×
                </button>
              </div>

              {/* CONTENT */}

              <div
                style={{
                  padding:
                    "20px",
                }}
              >
                {/* STATUS */}

                <div
                  style={{
                    marginBottom:
                      "22px",
                  }}
                >
                  <StatusBadge
                    status={
                      selected.status
                    }
                  />
                </div>

                {/* INFORMATION */}

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "18px",
                    padding:
                      "16px",
                    background:
                      "#0D1117",
                    border:
                      "1px solid #252C42",
                    borderRadius:
                      "10px",
                    marginBottom:
                      "18px",
                  }}
                >
                  <InfoItem
                    label="Device IP"
                    value={
                      selected.ipAddress ||
                      "N/A"
                    }
                    mono
                  />

                  <InfoItem
                    label="Severity"
                    value={
                      selected.severity
                    }
                  />

                  <InfoItem
                    label="Facility"
                    value={
                      selected.facility
                    }
                  />

                  <InfoItem
                    label="Message Tag"
                    value={
                      selected.msg_tag
                    }
                    mono
                  />

                  <InfoItem
                    label="Status Updated"
                    value={formatDate(
                      selected.statusUpdatedAt,
                    )}
                  />

                  <InfoItem
                    label="Updated By"
                    value={
                      selected.statusUpdatedBy
                    }
                    mono
                  />

                  <InfoItem
                    label="Approved By"
                    value={
                      selected.approvedBy
                    }
                    mono
                  />

                  <InfoItem
                    label="Approved At"
                    value={formatDate(
                      selected.approvedAt,
                    )}
                  />

                  <InfoItem
                    label="Created"
                    value={formatDate(
                      selected.timestamp,
                    )}
                  />
                </div>

                {/* MESSAGE */}

                <div
                  style={{
                    marginBottom:
                      "18px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "10px",
                      color:
                        "#6E7690",
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.7px",
                      marginBottom:
                        "8px",
                      fontWeight:
                        600,
                    }}
                  >
                    Message
                  </div>

                  <div
                    style={{
                      background:
                        "#0D1117",
                      border:
                        "1px solid #252C42",
                      borderRadius:
                        "9px",
                      padding:
                        "14px",
                      fontFamily:
                        "IBM Plex Mono, monospace",
                      fontSize:
                        "12px",
                      color:
                        "#C6CBDE",
                      whiteSpace:
                        "pre-wrap",
                      wordBreak:
                        "break-word",
                    }}
                  >
                    {selected.msg_text ||
                      "N/A"}
                  </div>
                </div>

                {/* RAW SYSLOG */}

                <div>
                  <div
                    style={{
                      fontSize:
                        "10px",
                      color:
                        "#6E7690",
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.7px",
                      marginBottom:
                        "8px",
                      fontWeight:
                        600,
                    }}
                  >
                    Raw Syslog
                  </div>

                  <pre
                    style={{
                      margin: 0,
                      background:
                        "#0D1117",
                      border:
                        "1px solid #252C42",
                      borderRadius:
                        "9px",
                      padding:
                        "14px",
                      fontFamily:
                        "IBM Plex Mono, monospace",
                      fontSize:
                        "11px",
                      color:
                        "#6E7690",
                      whiteSpace:
                        "pre-wrap",
                      wordBreak:
                        "break-word",
                      maxHeight:
                        "250px",
                      overflowY:
                        "auto",
                    }}
                  >
                    {selected.raw ||
                      "N/A"}
                  </pre>
                </div>
              </div>

              {/* FOOTER */}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: "10px",
                  padding:
                    "15px 20px",
                  borderTop:
                    "1px solid #252C42",
                }}
              >
                <button
                  onClick={() =>
                    openSSH(
                      selected,
                    )
                  }
                  disabled={
                    !selected.ipAddress
                  }
                  style={{
                    border:
                      "1px solid rgba(108,111,240,0.35)",
                    background:
                      selected.ipAddress
                        ? "rgba(108,111,240,0.10)"
                        : "#141A2B",
                    color:
                      selected.ipAddress
                        ? "#8B8FF7"
                        : "#454C68",
                    padding:
                      "9px 14px",
                    borderRadius:
                      "8px",
                    cursor:
                      selected.ipAddress
                        ? "pointer"
                        : "not-allowed",
                    fontSize:
                      "11px",
                    fontWeight:
                      600,
                  }}
                >
                  Open SSH Terminal
                </button>

                <button
                  onClick={
                    closeDetails
                  }
                  style={{
                    border:
                      "1px solid #303851",
                    background:
                      "#141A2B",
                    color:
                      "#C6CBDE",
                    padding:
                      "9px 14px",
                    borderRadius:
                      "8px",
                    cursor:
                      "pointer",
                    fontSize:
                      "11px",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      {/* =====================================================
          SSH TERMINAL MODAL
      ====================================================== */}

      {showSSH && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.78)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: "18px",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width:
                "min(1200px, 100%)",
              height:
                "min(760px, 94vh)",
              display:
                "flex",
              flexDirection:
                "column",
              background:
                "#111728",
              border:
                "1px solid #2A3249",
              borderRadius:
                "14px",
              overflow:
                "hidden",
              boxShadow:
                "0 30px 100px rgba(0,0,0,0.55)",
            }}
          >
            {/* SSH HEADER */}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                padding:
                  "13px 16px",
                borderBottom:
                  "1px solid #252C42",
                background:
                  "#141A2B",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width:
                      "34px",
                    height:
                      "34px",
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    borderRadius:
                      "8px",
                    background:
                      "rgba(108,111,240,0.12)",
                    color:
                      "#8B8FF7",
                    fontFamily:
                      "IBM Plex Mono, monospace",
                    fontSize:
                      "14px",
                  }}
                >
                  &gt;_
                </div>

                <div>
                  <div
                    style={{
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      color:
                        "#C6CBDE",
                    }}
                  >
                    Interactive SSH
                    Terminal
                  </div>

                  <div
                    style={{
                      marginTop:
                        "3px",
                      display:
                        "flex",
                      gap: "8px",
                      alignItems:
                        "center",
                      fontSize:
                        "10px",
                      color:
                        "#6E7690",
                      fontFamily:
                        "IBM Plex Mono, monospace",
                    }}
                  >
                    <span>
                      Device:
                    </span>

                    <span
                      style={{
                        color:
                          "#8B8FF7",
                      }}
                    >
                      {selected?.ipAddress ||
                        "Unknown"}
                    </span>

                    {sshInfo?.sshHost && (
                      <>
                        <span>
                          →
                        </span>

                        <span>
                          {
                            sshInfo.sshHost
                          }
                          :
                          {
                            sshInfo.sshPort
                          }
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* STATUS */}

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    gap: "6px",
                    padding:
                      "5px 9px",
                    borderRadius:
                      "7px",
                    background:
                      sshStatus ===
                      "connected"
                        ? "rgba(45,212,191,0.10)"
                        : sshStatus ===
                            "error"
                          ? "rgba(239,68,68,0.10)"
                          : "rgba(156,163,175,0.10)",
                    color:
                      sshStatus ===
                      "connected"
                        ? "#2DD4BF"
                        : sshStatus ===
                            "error"
                          ? "#EF4444"
                          : "#9CA3AF",
                    border:
                      `1px solid ${
                        sshStatus ===
                        "connected"
                          ? "rgba(45,212,191,0.25)"
                          : sshStatus ===
                              "error"
                            ? "rgba(239,68,68,0.25)"
                            : "rgba(156,163,175,0.25)"
                      }`,
                    fontSize:
                      "10px",
                    fontWeight:
                      600,
                  }}
                >
                  <span
                    style={{
                      width:
                        "6px",
                      height:
                        "6px",
                      borderRadius:
                        "50%",
                      background:
                        sshStatus ===
                        "connected"
                          ? "#2DD4BF"
                          : sshStatus ===
                              "error"
                            ? "#EF4444"
                            : "#9CA3AF",
                    }}
                  />

                  {sshStatus ===
                    "connecting" &&
                    "Connecting..."}

                  {sshStatus ===
                    "connected" &&
                    "Connected"}

                  {sshStatus ===
                    "disconnected" &&
                    "Disconnected"}

                  {sshStatus ===
                    "error" &&
                    "Error"}
                </span>

                <button
                  onClick={
                    closeSSH
                  }
                  style={{
                    width:
                      "30px",
                    height:
                      "30px",
                    borderRadius:
                      "7px",
                    border:
                      "1px solid #303851",
                    background:
                      "#111728",
                    color:
                      "#6E7690",
                    cursor:
                      "pointer",
                    fontSize:
                      "16px",
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* CONNECTION INFO */}

            {sshInfo && (
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "18px",
                  flexWrap:
                    "wrap",
                  padding:
                    "9px 15px",
                  background:
                    "#0D1117",
                  borderBottom:
                    "1px solid #252C42",
                  fontFamily:
                    "IBM Plex Mono, monospace",
                  fontSize:
                    "10px",
                  color:
                    "#6E7690",
                }}
              >
                <span>
                  Host:{" "}
                  <strong
                    style={{
                      color:
                        "#C6CBDE",
                    }}
                  >
                    {sshInfo.hostname ||
                      "N/A"}
                  </strong>
                </span>

                <span>
                  IP:{" "}
                  <strong
                    style={{
                      color:
                        "#8B8FF7",
                    }}
                  >
                    {sshInfo.ipAddress ||
                      selected?.ipAddress ||
                      "N/A"}
                  </strong>
                </span>

                <span>
                  SSH:{" "}
                  <strong
                    style={{
                      color:
                        "#C6CBDE",
                    }}
                  >
                    {sshInfo.sshHost ||
                      "N/A"}
                    :
                    {sshInfo.sshPort ||
                      "N/A"}
                  </strong>
                </span>

                <span>
                  User:{" "}
                  <strong
                    style={{
                      color:
                        "#C6CBDE",
                    }}
                  >
                    {sshInfo.username ||
                      "N/A"}
                  </strong>
                </span>
              </div>
            )}

            {/* SSH ERROR */}

            {sshError && (
              <div
                style={{
                  padding:
                    "10px 15px",
                  background:
                    "rgba(239,68,68,0.08)",
                  borderBottom:
                    "1px solid rgba(239,68,68,0.20)",
                  color:
                    "#EF4444",
                  fontSize:
                    "11px",
                  fontFamily:
                    "IBM Plex Mono, monospace",
                }}
              >
                {sshError}
              </div>
            )}

            {/* TERMINAL */}

            <div
              ref={
                terminalContainerRef
              }
              style={{
                flex: 1,
                minHeight: 0,
                padding: "10px",
                background:
                  "#0D1117",
              }}
            />

            {/* FOOTER */}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                padding:
                  "9px 14px",
                background:
                  "#141A2B",
                borderTop:
                  "1px solid #252C42",
                color:
                  "#454C68",
                fontSize:
                  "10px",
                fontFamily:
                  "IBM Plex Mono, monospace",
              }}
            >
              <span>
                Interactive Cisco IOS
                shell
              </span>

              <span>
                Type commands directly
                in the terminal
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TABLE STYLES
// ============================================================

const thStyle: React.CSSProperties = {
  padding: "12px 13px",
  textAlign: "left",
  color: "#6E7690",
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "0.7px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 13px",
  color: "#C6CBDE",
  verticalAlign: "middle",
};