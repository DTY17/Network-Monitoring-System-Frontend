import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import sendHTTP from "../util/axios";

import {
  Terminal,
} from "@xterm/xterm";

import {
  FitAddon,
} from "@xterm/addon-fit";

import "@xterm/xterm/css/xterm.css";

// ==========================================================
// SYSLOG INTERFACE
// ==========================================================

interface ISyslogMessage {
  _id?: string;

  priority?: number;
  timestamp?: string;
  facility?: string | number;
  severity?: number;

  msg_tag?: string;
  msg_text?: string;
  raw?: string;

  // Example:
  // 192.168.75.139:2222
  ipAddress?: string;

  status?: string;

  // Status tracking
  statusUpdatedBy?: string;
  statusUpdatedAt?: string;

  // Approval tracking
  approvedBy?: string;
  approvedAt?: string;

  // Assignment tracking
  assignedTo?: string;
  assignedBy?: string;
  assignedDate?: string;

  // Fixed tracking
  fixedBy?: string;
  fixedAt?: string;
}

// ==========================================================
// STATUS
// ==========================================================

type Status =
  | "pending"
  | "assigned"
  | "fixed"
  | "complete"
  | "not_complete";

// ==========================================================
// STATUS CONFIG
// ==========================================================

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    className: string;
  }
> = {
  pending: {
    label: "Pending",
    className:
      "border-[#454C68] bg-[#1A1F31] text-[#9BA3BD]",
  },

  assigned: {
    label: "Assigned",
    className:
      "border-[#514A72] bg-[#24203A] text-[#B8AEFF]",
  },

  fixed: {
    label: "Fixed · awaiting approval",
    className:
      "border-[#66542C] bg-[#2A2417] text-[#E5C56A]",
  },

  complete: {
    label: "Complete",
    className:
      "border-[#285B4A] bg-[#10251F] text-[#69D3A7]",
  },

  not_complete: {
    label: "Not Complete",
    className:
      "border-[#63353B] bg-[#28171B] text-[#F0838F]",
  },
};

// ==========================================================
// SEVERITY CONFIG
// ==========================================================

const SEVERITY_CONFIG: Record<
  number,
  {
    label: string;
    className: string;
  }
> = {
  0: {
    label: "Emergency",
    className:
      "border-[#71363D] bg-[#2A1519] text-[#FF7C88]",
  },

  1: {
    label: "Alert",
    className:
      "border-[#71363D] bg-[#2A1519] text-[#FF7C88]",
  },

  2: {
    label: "Critical",
    className:
      "border-[#71363D] bg-[#2A1519] text-[#FF7C88]",
  },

  3: {
    label: "Error",
    className:
      "border-[#71462F] bg-[#2A1C17] text-[#FF9D72]",
  },

  4: {
    label: "Warning",
    className:
      "border-[#66542C] bg-[#2A2417] text-[#E5C56A]",
  },

  5: {
    label: "Notice",
    className:
      "border-[#394F70] bg-[#182131] text-[#83A9DD]",
  },

  6: {
    label: "Informational",
    className:
      "border-[#344B60] bg-[#17232D] text-[#78B7D8]",
  },

  7: {
    label: "Debug",
    className:
      "border-[#343A4D] bg-[#181C28] text-[#7E879F]",
  },
};

// ==========================================================
// NORMALIZE STATUS
// ==========================================================

function normalizeStatus(
  status?: string
): Status {
  if (
    status === "pending" ||
    status === "assigned" ||
    status === "fixed" ||
    status === "complete" ||
    status === "not_complete"
  ) {
    return status;
  }

  return "pending";
}

// ==========================================================
// FORMAT DATE
// ==========================================================

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

// ==========================================================
// GET SEVERITY
// ==========================================================

function getSeverityConfig(
  severity?: number
) {
  if (
    typeof severity === "number" &&
    SEVERITY_CONFIG[severity]
  ) {
    return SEVERITY_CONFIG[severity];
  }

  return {
    label: "Unknown",
    className:
      "border-[#343A4D] bg-[#181C28] text-[#7E879F]",
  };
}

// ==========================================================
// PARSE SSH ADDRESS
// ==========================================================

function parseSSHAddress(address?: string) {
  if (!address) {
    return {
      host: "",
      port: 22,
    };
  }

  const value = address.trim();

  const lastColon = value.lastIndexOf(":");

  if (lastColon > -1) {
    const host = value
      .substring(0, lastColon)
      .trim();

    const portString = value
      .substring(lastColon + 1)
      .trim();

    const port = Number(portString);

    if (
      host &&
      Number.isInteger(port) &&
      port > 0 &&
      port <= 65535
    ) {
      return {
        host,
        port,
      };
    }
  }

  return {
    host: value,
    port: 22,
  };
}

// ==========================================================
// SSH TERMINAL PROPS
// ==========================================================

interface SSHTerminalProps {
  notificationId: string;

  onConnected?: () => void;

  onDisconnected?: () => void;

  onError?: (
    message: string
  ) => void;
}

// ==========================================================
// SSH TERMINAL COMPONENT
// ==========================================================

function SSHTerminal({
  notificationId,
  onConnected,
  onDisconnected,
  onError,
}: SSHTerminalProps) {
  const terminalContainerRef =
    useRef<HTMLDivElement | null>(null);

  const terminalRef =
    useRef<Terminal | null>(null);

  const fitAddonRef =
    useRef<FitAddon | null>(null);

  const socketRef =
    useRef<WebSocket | null>(null);

  /*
   * Store callbacks in refs.
   *
   * This is another layer of protection against the
   * WebSocket effect being recreated because the parent
   * changes callback references.
   */
  const onConnectedRef =
    useRef(onConnected);

  const onDisconnectedRef =
    useRef(onDisconnected);

  const onErrorRef =
    useRef(onError);

  useEffect(() => {
    onConnectedRef.current =
      onConnected;
  }, [onConnected]);

  useEffect(() => {
    onDisconnectedRef.current =
      onDisconnected;
  }, [onDisconnected]);

  useEffect(() => {
    onErrorRef.current =
      onError;
  }, [onError]);

  const [connectionStatus, setConnectionStatus] =
    useState<
      | "connecting"
      | "connected"
      | "disconnected"
      | "error"
    >("connecting");

  // ========================================================
  // CREATE TERMINAL + WEBSOCKET
  // ========================================================

  useEffect(() => {
    const container =
      terminalContainerRef.current;

    if (!container) {
      return;
    }

    let destroyed = false;

    let initialFitTimer:
      number | null = null;

    let connectedFitTimer:
      number | null = null;

    // ======================================================
    // TERMINAL
    // ======================================================

    const terminal =
      new Terminal({
        cursorBlink: true,

        cursorStyle: "block",

        fontFamily:
          '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace',

        fontSize: 13,

        lineHeight: 1.2,

        theme: {
          background:
            "#090D14",

          foreground:
            "#C6CBDE",

          cursor:
            "#8B8EF7",

          cursorAccent:
            "#090D14",

          black:
            "#0D1117",

          red:
            "#F0838F",

          green:
            "#69D3A7",

          yellow:
            "#E5C56A",

          blue:
            "#83A9DD",

          magenta:
            "#B8AEFF",

          cyan:
            "#78B7D8",

          white:
            "#C6CBDE",

          brightBlack:
            "#59627B",

          brightRed:
            "#FF7C88",

          brightGreen:
            "#7BE0B5",

          brightYellow:
            "#F0D37C",

          brightBlue:
            "#9BBBEA",

          brightMagenta:
            "#C8C1FF",

          brightCyan:
            "#8ACAE7",

          brightWhite:
            "#FFFFFF",
        },

        scrollback: 5000,

        allowTransparency: false,
      });

    // ======================================================
    // FIT ADDON
    // ======================================================

    const fitAddon =
      new FitAddon();

    terminal.loadAddon(
      fitAddon
    );

    // ======================================================
    // OPEN TERMINAL
    // ======================================================

    terminal.open(container);

    terminalRef.current =
      terminal;

    fitAddonRef.current =
      fitAddon;

    // ======================================================
    // FIT TERMINAL
    // ======================================================

    const fitTerminal = () => {
      if (destroyed) {
        return;
      }

      try {
        fitAddon.fit();

        const socket =
          socketRef.current;

        if (
          socket &&
          socket.readyState ===
            WebSocket.OPEN
        ) {
          socket.send(
            JSON.stringify({
              type: "resize",
              cols: terminal.cols,
              rows: terminal.rows,
            })
          );
        }
      } catch (error) {
        console.error(
          "Terminal fit error:",
          error
        );
      }
    };

    // ======================================================
    // INITIAL FIT
    // ======================================================

    initialFitTimer =
      window.setTimeout(
        fitTerminal,
        100
      );

    // ======================================================
    // WEBSOCKET URL
    // ======================================================

    const protocol =
      window.location.protocol ===
      "https:"
        ? "wss:"
        : "ws:";

    const hostname =
      window.location.hostname ||
      "localhost";

    const websocketURL =
      `${protocol}//${hostname}:3000/api/v1/notification/ssh-terminal/${notificationId}`;

    console.log(
      "========================================"
    );

    console.log(
      "Opening SSH WebSocket:"
    );

    console.log(
      websocketURL
    );

    console.log(
      "Notification ID:",
      notificationId
    );

    console.log(
      "========================================"
    );

    // ======================================================
    // CREATE WEBSOCKET
    // ======================================================

    const socket =
      new WebSocket(
        websocketURL
      );

    socketRef.current =
      socket;

    // ======================================================
    // WEBSOCKET OPEN
    // ======================================================

    socket.onopen = () => {
      if (destroyed) {
        return;
      }

      console.log(
        "✅ SSH WebSocket connected"
      );

      terminal.write(
        "\x1b[90mConnecting to router...\x1b[0m\r\n"
      );
    };

    // ======================================================
    // WEBSOCKET MESSAGE
    // ======================================================

    socket.onmessage = (
      event
    ) => {
      if (destroyed) {
        return;
      }

      try {
        const message =
          JSON.parse(
            event.data
          );

        console.log(
          "SSH WebSocket message:",
          message
        );

        // ================================================
        // SSH CONNECTED
        // ================================================

        if (
          message.type ===
          "connected"
        ) {
          setConnectionStatus(
            "connected"
          );

          terminal.write(
            "\r\n\x1b[32m✓ SSH connection successful\x1b[0m\r\n"
          );

          if (
            message.data
              ?.hostname
          ) {
            terminal.write(
              `\x1b[90mDevice: ${message.data.hostname}\x1b[0m\r\n`
            );
          }

          if (
            message.data
              ?.ipAddress
          ) {
            terminal.write(
              `\x1b[90mEndpoint: ${message.data.ipAddress}:${message.data.port ?? 22}\x1b[0m\r\n`
            );
          }

          terminal.write(
            "\r\n"
          );

          onConnectedRef.current?.();

          connectedFitTimer =
            window.setTimeout(
              fitTerminal,
              100
            );

          return;
        }

        // ================================================
        // ROUTER OUTPUT
        // ================================================

        if (
          message.type ===
          "output"
        ) {
          if (
            typeof message.data ===
            "string"
          ) {
            terminal.write(
              message.data
            );
          }

          return;
        }

        // ================================================
        // ERROR
        // ================================================

        if (
          message.type ===
          "error"
        ) {
          const errorMessage =
            message.message ||
            "SSH connection failed.";

          setConnectionStatus(
            "error"
          );

          terminal.write(
            `\r\n\x1b[31m✖ ${errorMessage}\x1b[0m\r\n`
          );

          onErrorRef.current?.(
            errorMessage
          );

          return;
        }

        // ================================================
        // CLOSED
        // ================================================

        if (
          message.type ===
          "close"
        ) {
          setConnectionStatus(
            "disconnected"
          );

          terminal.write(
            "\r\n\x1b[90mSSH connection closed.\x1b[0m\r\n"
          );

          onDisconnectedRef.current?.();

          return;
        }
      } catch (error) {
        console.error(
          "WebSocket message parse error:",
          error
        );

        terminal.write(
          "\r\n\x1b[31m✖ Invalid WebSocket message.\x1b[0m\r\n"
        );
      }
    };

    // ======================================================
    // WEBSOCKET ERROR
    // ======================================================

    socket.onerror = (
      error
    ) => {
      if (destroyed) {
        return;
      }

      console.error(
        "SSH WebSocket error:",
        error
      );

      setConnectionStatus(
        "error"
      );

      terminal.write(
        "\r\n\x1b[31m✖ WebSocket connection error\x1b[0m\r\n"
      );

      onErrorRef.current?.(
        "WebSocket connection error"
      );
    };

    // ======================================================
    // WEBSOCKET CLOSE
    // ======================================================

    socket.onclose = (
      event
    ) => {
      if (destroyed) {
        return;
      }

      console.log(
        "🔒 SSH WebSocket closed",
        {
          code: event.code,
          reason: event.reason,
        }
      );

      setConnectionStatus(
        "disconnected"
      );

      onDisconnectedRef.current?.();
    };

    // ======================================================
    // TERMINAL KEYBOARD INPUT
    // ======================================================

    const dataDisposable =
      terminal.onData(
        (data) => {
          if (destroyed) {
            return;
          }

          const currentSocket =
            socketRef.current;

          if (
            currentSocket &&
            currentSocket.readyState ===
              WebSocket.OPEN
          ) {
            try {
              currentSocket.send(
                JSON.stringify({
                  type: "input",
                  data,
                })
              );
            } catch (error) {
              console.error(
                "Failed to send terminal input:",
                error
              );
            }
          }
        }
      );

    // ======================================================
    // WINDOW RESIZE
    // ======================================================

    const handleResize =
      () => {
        fitTerminal();
      };

    window.addEventListener(
      "resize",
      handleResize
    );

    // ======================================================
    // CLEANUP
    // ======================================================

    return () => {
      console.log(
        "🧹 Cleaning SSH terminal"
      );

      destroyed = true;

      if (
        initialFitTimer !==
        null
      ) {
        window.clearTimeout(
          initialFitTimer
        );
      }

      if (
        connectedFitTimer !==
        null
      ) {
        window.clearTimeout(
          connectedFitTimer
        );
      }

      window.removeEventListener(
        "resize",
        handleResize
      );

      dataDisposable.dispose();

      try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
      } catch {}

      try {
        if (
          socket.readyState ===
            WebSocket.OPEN ||
          socket.readyState ===
            WebSocket.CONNECTING
        ) {
          socket.close(
            1000,
            "Terminal closed"
          );
        }
      } catch {}

      if (
        socketRef.current ===
        socket
      ) {
        socketRef.current =
          null;
      }

      terminal.dispose();

      terminalRef.current =
        null;

      fitAddonRef.current =
        null;
    };
  }, [notificationId]);

  // ========================================================
  // TERMINAL STATUS
  // ========================================================

  const statusText =
    connectionStatus ===
    "connecting"
      ? "Connecting"
      : connectionStatus ===
        "connected"
      ? "Connected"
      : connectionStatus ===
        "error"
      ? "Connection Error"
      : "Disconnected";

  const statusClass =
    connectionStatus ===
    "connected"
      ? "bg-[#10251F] text-[#69D3A7] border-[#285B4A]"
      : connectionStatus ===
        "error"
      ? "bg-[#28171B] text-[#F0838F] border-[#63353B]"
      : "bg-[#1A1F31] text-[#9BA3BD] border-[#454C68]";

  // ========================================================
  // UI
  // ========================================================

  return (
    <div
      className="
        overflow-hidden
        rounded-xl
        border
        border-[#292F43]
        bg-[#090D14]
        shadow-[0_0_30px_rgba(0,0,0,0.35)]
      "
    >
      {/* ==================================================
          TERMINAL HEADER
      ================================================== */}

      <div
        className="
          flex
          items-center
          justify-between
          border-b
          border-[#202638]
          bg-[#111728]
          px-4
          py-3
        "
      >
        <div className="flex items-center gap-3">

          <div className="flex items-center gap-1.5">

            <span className="h-2.5 w-2.5 rounded-full bg-[#F0838F]" />

            <span className="h-2.5 w-2.5 rounded-full bg-[#E5C56A]" />

            <span className="h-2.5 w-2.5 rounded-full bg-[#69D3A7]" />

          </div>

          <span className="font-mono text-[11px] text-[#858DA5]">
            SSH Terminal
          </span>

        </div>

        <span
          className={`
            rounded-full
            border
            px-2.5
            py-1
            text-[10px]
            ${statusClass}
          `}
        >
          {statusText}
        </span>

      </div>

      {/* ==================================================
          TERMINAL
      ================================================== */}

      <div
        ref={
          terminalContainerRef
        }
        className="
          h-[420px]
          w-full
          bg-[#090D14]
          p-3
        "
      />

      {/* ==================================================
          TERMINAL FOOTER
      ================================================== */}

      <div
        className="
          border-t
          border-[#202638]
          bg-[#0D111B]
          px-4
          py-2
          font-mono
          text-[10px]
          text-[#505A73]
        "
      >
        Type Cisco IOS commands directly into the terminal.
      </div>

    </div>
  );
}

// ==========================================================
// APPROVE COMPONENT
// ==========================================================

export default function Approve() {
  const [items, setItems] =
    useState<ISyslogMessage[]>([]);

  const [selected, setSelected] =
    useState<ISyslogMessage | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [approving, setApproving] =
    useState(false);

  // ========================================================
  // SSH TERMINAL
  // ========================================================

  const [
    sshTerminalOpen,
    setSshTerminalOpen,
  ] = useState(false);

  const [
    sshConnected,
    setSshConnected,
  ] = useState(false);

  const [
    sshError,
    setSshError,
  ] = useState("");

  // ========================================================
  // LOAD NOTIFICATIONS
  // ========================================================

  const loadPending =
    async () => {
      try {
        setLoading(true);

        const response =
          await sendHTTP<{
            message: string;
            data: ISyslogMessage[];
          }>(
            "/api/v1/notification",
            "get"
          );

        const data =
          response?.data || [];

        const fixedItems =
          data.filter(
            (item) =>
              normalizeStatus(
                item.status
              ) === "fixed"
          );

        setItems(
          fixedItems
        );
      } catch (error) {
        console.error(
          "Error loading approval notifications:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

  // ========================================================
  // INITIAL LOAD
  // ========================================================

  useEffect(() => {
    loadPending();
  }, []);

  // ========================================================
  // STABLE SSH CALLBACKS
  // ========================================================
  //
  // IMPORTANT:
  //
  // These callbacks are memoized.
  //
  // This prevents SSHTerminal's WebSocket effect
  // from restarting every time SSH connection state
  // changes.
  //
  // ========================================================

  const handleSSHConnected =
    useCallback(() => {
      console.log(
        "Frontend: SSH connected"
      );

      setSshConnected(true);

      setSshError("");
    }, []);

  const handleSSHDisconnected =
    useCallback(() => {
      console.log(
        "Frontend: SSH disconnected"
      );

      setSshConnected(false);
    }, []);

  const handleSSHError =
    useCallback(
      (message: string) => {
        console.error(
          "Frontend: SSH error:",
          message
        );

        setSshConnected(false);

        setSshError(
          message
        );
      },
      []
    );

  // ========================================================
  // APPROVE
  // ========================================================

  const approveNotification =
    async (
      item:
        | ISyslogMessage
        | null
    ) => {
      if (!item?._id) {
        return;
      }

      const adminId =
        localStorage.getItem(
          "userId"
        );

      if (!adminId) {
        alert(
          "Admin user ID not found."
        );

        return;
      }

      try {
        setApproving(true);

        await sendHTTP(
          `/api/v1/notification/status/${item._id}`,
          "post",
          {
            status:
              "complete",

            statusUpdatedBy:
              adminId,
          }
        );

        // Remove from list
        setItems(
          (previous) =>
            previous.filter(
              (
                notification
              ) =>
                notification._id !==
                item._id
            )
        );

        // Close terminal
        setSshTerminalOpen(
          false
        );

        setSshConnected(
          false
        );

        setSshError("");

        // Close modal
        setSelected(null);

      } catch (error: any) {
        console.error(
          "Error approving notification:",
          error
        );

        alert(
          error?.response?.data
            ?.message ||
            "Failed to approve notification."
        );
      } finally {
        setApproving(
          false
        );
      }
    };

  // ========================================================
  // OPEN SSH TERMINAL
  // ========================================================

  const openSSHTerminal =
    () => {
      if (!selected?._id) {
        return;
      }

      if (!selected.ipAddress) {
        setSshError(
          "No IP address is associated with this syslog."
        );

        return;
      }

      const {
        host,
        port,
      } =
        parseSSHAddress(
          selected.ipAddress
        );

      if (!host) {
        setSshError(
          "Invalid SSH address."
        );

        return;
      }

      console.log(
        "========================================"
      );

      console.log(
        "Opening SSH terminal"
      );

      console.log(
        "Host:",
        host
      );

      console.log(
        "Port:",
        port
      );

      console.log(
        "Notification:",
        selected._id
      );

      console.log(
        "========================================"
      );

      setSshError("");

      setSshConnected(
        false
      );

      setSshTerminalOpen(
        true
      );
    };

  // ========================================================
  // CLOSE SSH TERMINAL
  // ========================================================

  const closeSSHTerminal =
    () => {
      console.log(
        "Closing SSH terminal"
      );

      setSshTerminalOpen(
        false
      );

      setSshConnected(
        false
      );

      setSshError("");
    };

  // ========================================================
  // CLOSE MODAL
  // ========================================================

  const closeModal =
    () => {
      if (approving) {
        return;
      }

      setSshTerminalOpen(
        false
      );

      setSshConnected(
        false
      );

      setSshError("");

      setSelected(null);
    };

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="min-h-screen bg-[#0D1117] p-6 text-[#C6CBDE]">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="mb-6 flex items-center justify-between">

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              border
              border-[#303653]
              bg-[#141A2B]
              text-[#8B8EF7]
              shadow-[0_0_20px_rgba(108,111,240,0.08)]
            "
          >
            ✓
          </div>

          <div>

            <h1 className="text-xl font-semibold text-white">
              Approve Notifications
            </h1>

            <p className="mt-1 text-xs text-[#6E7690]">
              Review fixed syslog notifications
              before approval.
            </p>

          </div>

        </div>

        {/* REFRESH */}

        <button
          onClick={
            loadPending
          }
          disabled={
            loading
          }
          className="
            inline-flex
            items-center
            gap-2
            rounded-lg
            border
            border-[#2A3042]
            bg-[#141A2B]
            px-4
            py-2
            text-xs
            font-medium
            text-[#9BA3BD]
            transition
            hover:border-[#454C68]
            hover:bg-[#181F32]
            hover:text-white
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
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

          Refresh
        </button>

      </div>

      {/* ====================================================
          TABLE CARD
      ==================================================== */}

      <div
        className="
          overflow-hidden
          rounded-xl
          border
          border-[#202638]
          bg-[#111728]
          shadow-[0_12px_40px_rgba(0,0,0,0.22)]
        "
      >

        {/* CARD HEADER */}

        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-[#202638]
            px-5
            py-4
          "
        >

          <div>

            <h2 className="text-sm font-semibold text-[#D8DBE8]">
              Fixed Notifications
            </h2>

            <p className="mt-1 text-[11px] text-[#59627B]">
              Notifications waiting for
              administrator approval.
            </p>

          </div>

          <div
            className="
              rounded-full
              border
              border-[#303653]
              bg-[#171D30]
              px-3
              py-1
              font-mono
              text-[11px]
              text-[#8589F2]
            "
          >
            {items.length} pending
          </div>

        </div>

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading ? (

          <div className="flex min-h-[300px] items-center justify-center">

            <div className="flex items-center gap-3 text-sm text-[#6E7690]">

              <span
                className="
                  h-5
                  w-5
                  animate-spin
                  rounded-full
                  border-2
                  border-[#303653]
                  border-t-[#6C6FF0]
                "
              />

              Loading notifications...

            </div>

          </div>

        ) : items.length === 0 ? (

          /* EMPTY */

          <div className="flex min-h-[300px] flex-col items-center justify-center">

            <div
              className="
                mb-4
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                border
                border-[#283047]
                bg-[#171D2D]
                text-xl
                text-[#5E6680]
              "
            >
              ✓
            </div>

            <p className="text-sm text-[#8A91A8]">
              No notifications waiting for approval.
            </p>

            <p className="mt-1 text-xs text-[#4F5870]">
              Fixed notifications will appear here.
            </p>

          </div>

        ) : (

          /* TABLE */

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1050px]">

              <thead>

                <tr
                  className="
                    border-b
                    border-[#202638]
                    bg-[#0F1422]
                    text-left
                  "
                >

                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                    Status
                  </th>

                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                    Timestamp
                  </th>

                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                    Severity
                  </th>

                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                    Facility
                  </th>

                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                    Tag
                  </th>

                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                    Message
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody>

                {items.map(
                  (item) => {

                    const status =
                      normalizeStatus(
                        item.status
                      );

                    const statusConfig =
                      STATUS_CONFIG[
                        status
                      ];

                    const severityConfig =
                      getSeverityConfig(
                        item.severity
                      );

                    return (

                      <tr
                        key={
                          item._id
                        }
                        className="
                          border-b
                          border-[#1D2333]
                          transition
                          hover:bg-[#151B2B]
                        "
                      >

                        {/* STATUS */}

                        <td className="px-5 py-4">

                          <span
                            className={`
                              inline-flex
                              rounded-full
                              border
                              px-2.5
                              py-1
                              text-[10px]
                              font-medium
                              ${statusConfig.className}
                            `}
                          >
                            {
                              statusConfig.label
                            }
                          </span>

                        </td>

                        {/* TIMESTAMP */}

                        <td className="px-5 py-4">

                          <span
                            className="
                              whitespace-nowrap
                              font-mono
                              text-[11px]
                              text-[#858DA5]
                            "
                          >
                            {formatDate(
                              item.timestamp
                            )}
                          </span>

                        </td>

                        {/* SEVERITY */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-2">

                            <span
                              className={`
                                inline-flex
                                min-w-[26px]
                                items-center
                                justify-center
                                rounded-md
                                border
                                px-1.5
                                py-1
                                font-mono
                                text-[10px]
                                ${severityConfig.className}
                              `}
                            >
                              {item.severity ??
                                "—"}
                            </span>

                            <span className="text-[10px] text-[#626B83]">
                              {
                                severityConfig.label
                              }
                            </span>

                          </div>

                        </td>

                        {/* FACILITY */}

                        <td className="px-5 py-4">

                          <span className="font-mono text-xs text-[#8790A9]">
                            {item.facility ??
                              "—"}
                          </span>

                        </td>

                        {/* TAG */}

                        <td className="px-5 py-4">

                          <span
                            className="
                              rounded-md
                              border
                              border-[#292F43]
                              bg-[#171D2C]
                              px-2
                              py-1
                              font-mono
                              text-[10px]
                              text-[#858CF1]
                            "
                          >
                            {item.msg_tag ||
                              "—"}
                          </span>

                        </td>

                        {/* MESSAGE */}

                        <td className="max-w-[350px] px-5 py-4">

                          <p
                            className="
                              truncate
                              text-xs
                              text-[#AEB5C8]
                            "
                            title={
                              item.msg_text
                            }
                          >
                            {item.msg_text ||
                              "No message"}
                          </p>

                          {item.ipAddress && (

                            <p className="mt-1 font-mono text-[10px] text-[#505A73]">
                              {
                                item.ipAddress
                              }
                            </p>

                          )}

                        </td>

                        {/* ACTION */}

                        <td className="px-5 py-4">

                          <div className="flex justify-end gap-2">

                            {/* VIEW */}

                            <button
                              onClick={() => {

                                setSelected(
                                  item
                                );

                                setSshTerminalOpen(
                                  false
                                );

                                setSshConnected(
                                  false
                                );

                                setSshError(
                                  ""
                                );
                              }}
                              className="
                                rounded-lg
                                border
                                border-[#303650]
                                bg-[#171D2C]
                                px-3
                                py-1.5
                                text-[11px]
                                font-medium
                                text-[#AAB1C5]
                                transition
                                hover:border-[#5559B9]
                                hover:bg-[#1D2440]
                                hover:text-white
                              "
                            >
                              View
                            </button>

                            {/* APPROVE */}

                            <button
                              onClick={() =>
                                approveNotification(
                                  item
                                )
                              }
                              disabled={
                                approving
                              }
                              className="
                                rounded-lg
                                border
                                border-[#4D51A7]
                                bg-[#282B68]
                                px-3
                                py-1.5
                                text-[11px]
                                font-medium
                                text-[#BFC1FF]
                                transition
                                hover:bg-[#343886]
                                hover:text-white
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                              "
                            >
                              Approve
                            </button>

                          </div>

                        </td>

                      </tr>

                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

      {/* ====================================================
          DETAILS MODAL
      ==================================================== */}

      {selected && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/70
            p-5
            backdrop-blur-sm
          "
          onClick={
            closeModal
          }
        >

          <div
            className="
              max-h-[94vh]
              w-full
              max-w-5xl
              overflow-y-auto
              rounded-2xl
              border
              border-[#292F44]
              bg-[#111728]
              shadow-[0_25px_80px_rgba(0,0,0,0.5)]
            "
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            {/* ==================================================
                MODAL HEADER
            ================================================== */}

            <div
              className="
                flex
                items-start
                justify-between
                border-b
                border-[#252B3D]
                px-6
                py-5
              "
            >

              <div className="flex items-center gap-3">

                <div
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-[#3B3F73]
                    bg-[#1B1E40]
                    text-[#898CF5]
                  "
                >
                  !
                </div>

                <div>

                  <h2 className="text-base font-semibold text-white">
                    Notification Details
                  </h2>

                  <p className="mt-1 text-[10px] text-[#59627B]">
                    Review the notification and
                    connect to the source router.
                  </p>

                </div>

              </div>

              <button
                onClick={
                  closeModal
                }
                disabled={
                  approving
                }
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-lg
                  text-lg
                  text-[#5E6780]
                  transition
                  hover:bg-[#1C2233]
                  hover:text-white
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                ×
              </button>

            </div>

            {/* ==================================================
                MODAL CONTENT
            ================================================== */}

            <div className="space-y-5 px-6 py-5">

              {/* ==================================================
                  STATUS / DEVICE
              ================================================== */}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                {/* STATUS */}

                <div
                  className="
                    rounded-xl
                    border
                    border-[#252C40]
                    bg-[#141A2A]
                    p-4
                  "
                >

                  <p className="mb-2 text-[10px] uppercase tracking-wider text-[#59627B]">
                    Current Status
                  </p>

                  <span
                    className={`
                      inline-flex
                      rounded-full
                      border
                      px-3
                      py-1.5
                      text-xs
                      font-medium
                      ${
                        STATUS_CONFIG[
                          normalizeStatus(
                            selected.status
                          )
                        ].className
                      }
                    `}
                  >
                    {
                      STATUS_CONFIG[
                        normalizeStatus(
                          selected.status
                        )
                      ].label
                    }
                  </span>

                </div>

                {/* DEVICE */}

                <div
                  className="
                    rounded-xl
                    border
                    border-[#252C40]
                    bg-[#141A2A]
                    p-4
                  "
                >

                  <p className="mb-2 text-[10px] uppercase tracking-wider text-[#59627B]">
                    Source Device
                  </p>

                  {selected.ipAddress ? (

                    (() => {

                      const {
                        host,
                        port,
                      } =
                        parseSSHAddress(
                          selected.ipAddress
                        );

                      return (

                        <div>

                          <p className="font-mono text-sm text-[#C6CBDE]">
                            {host}
                          </p>

                          <p className="mt-1 font-mono text-[10px] text-[#59627B]">
                            SSH · Port {port}
                          </p>

                        </div>

                      );

                    })()

                  ) : (

                    <p className="text-xs text-[#F0838F]">
                      IP address unavailable
                    </p>

                  )}

                </div>

              </div>

              {/* ==================================================
                  INFORMATION GRID
              ================================================== */}

              <div
                className="
                  overflow-hidden
                  rounded-xl
                  border
                  border-[#252C40]
                  bg-[#141A2A]
                "
              >

                <div
                  className="
                    grid
                    grid-cols-2
                    divide-x
                    divide-y
                    divide-[#252C40]
                    sm:grid-cols-4
                  "
                >

                  {/* TIMESTAMP */}

                  <div className="p-4">

                    <p className="text-[9px] uppercase tracking-wider text-[#59627B]">
                      Original Timestamp
                    </p>

                    <p className="mt-2 text-xs text-[#AAB1C5]">
                      {formatDate(
                        selected.timestamp
                      )}
                    </p>

                  </div>

                  {/* FIXED */}

                  <div className="p-4">

                    <p className="text-[9px] uppercase tracking-wider text-[#59627B]">
                      Fixed At
                    </p>

                    <p className="mt-2 text-xs text-[#AAB1C5]">
                      {formatDate(
                        selected.fixedAt ||
                          selected.statusUpdatedAt
                      )}
                    </p>

                  </div>

                  {/* PRIORITY */}

                  <div className="p-4">

                    <p className="text-[9px] uppercase tracking-wider text-[#59627B]">
                      Priority
                    </p>

                    <p className="mt-2 font-mono text-xs text-[#AAB1C5]">
                      {selected.priority ??
                        "—"}
                    </p>

                  </div>

                  {/* SEVERITY */}

                  <div className="p-4">

                    <p className="text-[9px] uppercase tracking-wider text-[#59627B]">
                      Severity
                    </p>

                    <div className="mt-2 flex items-center gap-2">

                      <span
                        className={`
                          rounded-md
                          border
                          px-2
                          py-1
                          font-mono
                          text-[10px]
                          ${
                            getSeverityConfig(
                              selected.severity
                            ).className
                          }
                        `}
                      >
                        {selected.severity ??
                          "—"}
                      </span>

                      <span className="text-[10px] text-[#626B83]">
                        {
                          getSeverityConfig(
                            selected.severity
                          ).label
                        }
                      </span>

                    </div>

                  </div>

                </div>

              </div>

              {/* ==================================================
                  SYSLOG INFORMATION
              ================================================== */}

              <div>

                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                  Syslog Information
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                  {/* FACILITY */}

                  <div
                    className="
                      rounded-lg
                      border
                      border-[#252C40]
                      bg-[#0F1422]
                      p-3
                    "
                  >

                    <p className="text-[9px] uppercase text-[#505A73]">
                      Facility
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#9BA3BD]">
                      {selected.facility ??
                        "—"}
                    </p>

                  </div>

                  {/* TAG */}

                  <div
                    className="
                      rounded-lg
                      border
                      border-[#252C40]
                      bg-[#0F1422]
                      p-3
                    "
                  >

                    <p className="text-[9px] uppercase text-[#505A73]">
                      Message Tag
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#9BA3BD]">
                      {selected.msg_tag ||
                        "—"}
                    </p>

                  </div>

                  {/* SSH ENDPOINT */}

                  <div
                    className="
                      rounded-lg
                      border
                      border-[#252C40]
                      bg-[#0F1422]
                      p-3
                    "
                  >

                    <p className="text-[9px] uppercase text-[#505A73]">
                      SSH Endpoint
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#858CF1]">
                      {selected.ipAddress ||
                        "—"}
                    </p>

                  </div>

                </div>

              </div>

              {/* ==================================================
                  MESSAGE
              ================================================== */}

              <div>

                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                  Message
                </p>

                <div
                  className="
                    rounded-xl
                    border
                    border-[#292F43]
                    bg-[#0D111B]
                    px-4
                    py-3
                  "
                >

                  <p className="text-sm leading-6 text-[#C1C7D8]">
                    {selected.msg_text ||
                      "No message available."}
                  </p>

                </div>

              </div>

              {/* ==================================================
                  RAW SYSLOG
              ================================================== */}

              <div>

                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                  Raw Syslog
                </p>

                <pre
                  className="
                    max-h-40
                    overflow-auto
                    rounded-xl
                    border
                    border-[#292F43]
                    bg-[#0B0F17]
                    p-4
                    font-mono
                    text-[11px]
                    leading-5
                    text-[#7F8AA5]
                  "
                >
                  {selected.raw ||
                    "No raw syslog data available."}
                </pre>

              </div>

              {/* ==================================================
                  SSH TERMINAL
              ================================================== */}

              {sshTerminalOpen && (
                <div>

                  <div className="mb-2 flex items-center justify-between">

                    <div>

                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#59627B]">
                        Interactive SSH Terminal
                      </p>

                      <p className="mt-1 text-[10px] text-[#505A73]">
                        Commands are executed on the source router.
                      </p>

                    </div>

                    <button
                      onClick={
                        closeSSHTerminal
                      }
                      className="
                        rounded-lg
                        border
                        border-[#353C56]
                        bg-[#171D30]
                        px-3
                        py-1.5
                        text-[10px]
                        text-[#9BA3BD]
                        transition
                        hover:border-[#5559B9]
                        hover:text-white
                      "
                    >
                      Close Terminal
                    </button>

                  </div>

                  {sshError && (

                    <div
                      className="
                        mb-3
                        rounded-lg
                        border
                        border-[#63353B]
                        bg-[#28171B]
                        px-4
                        py-3
                        text-xs
                        text-[#F0838F]
                      "
                    >
                      {sshError}
                    </div>

                  )}

                  <SSHTerminal
                    notificationId={
                      selected._id!
                    }

                    onConnected={
                      handleSSHConnected
                    }

                    onDisconnected={
                      handleSSHDisconnected
                    }

                    onError={
                      handleSSHError
                    }
                  />

                </div>
              )}

            </div>

            {/* ==================================================
                FOOTER
            ================================================== */}

            <div
              className="
                flex
                flex-col
                gap-3
                border-t
                border-[#252B3D]
                px-6
                py-4
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >

              {/* ==================================================
                  SSH
              ================================================== */}

              <div className="flex items-center gap-3">

                {!sshTerminalOpen ? (

                  <button
                    onClick={
                      openSSHTerminal
                    }
                    disabled={
                      approving ||
                      !selected.ipAddress
                    }
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      border
                      border-[#353C56]
                      bg-[#171D30]
                      px-4
                      py-2
                      text-xs
                      font-medium
                      text-[#C6CBDE]
                      transition
                      hover:border-[#6C6FF0]
                      hover:bg-[#1D2440]
                      hover:text-white
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >

                    <span className="text-base text-[#8589F2]">
                      ⌁
                    </span>

                    SSH Connect

                  </button>

                ) : (

                  <div
                    className={`
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      border
                      px-4
                      py-2
                      text-xs
                      font-medium
                      ${
                        sshConnected
                          ? "border-[#285B4A] bg-[#10251F] text-[#69D3A7]"
                          : "border-[#454C68] bg-[#1A1F31] text-[#9BA3BD]"
                      }
                    `}
                  >

                    <span
                      className={`
                        h-2
                        w-2
                        rounded-full
                        ${
                          sshConnected
                            ? "bg-[#69D3A7]"
                            : "bg-[#9BA3BD]"
                        }
                      `}
                    />

                    {sshConnected
                      ? "SSH Connected"
                      : "SSH Terminal Open"}

                  </div>

                )}

                {selected.ipAddress && (

                  <span
                    className="
                      hidden
                      font-mono
                      text-[10px]
                      text-[#505A73]
                      sm:inline
                    "
                  >
                    {
                      selected.ipAddress
                    }
                  </span>

                )}

              </div>

              {/* ==================================================
                  ACTIONS
              ================================================== */}

              <div className="flex items-center gap-3">

                {/* CLOSE */}

                <button
                  onClick={
                    closeModal
                  }
                  disabled={
                    approving
                  }
                  className="
                    rounded-lg
                    border
                    border-[#2A3042]
                    bg-[#141A2B]
                    px-4
                    py-2
                    text-xs
                    font-medium
                    text-[#9BA3BD]
                    transition
                    hover:border-[#454C68]
                    hover:text-white
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Close
                </button>

                {/* APPROVE */}

                <button
                  onClick={() =>
                    approveNotification(
                      selected
                    )
                  }
                  disabled={
                    approving
                  }
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    border-[#575BC5]
                    bg-[#34388A]
                    px-5
                    py-2
                    text-xs
                    font-medium
                    text-white
                    shadow-[0_0_20px_rgba(108,111,240,0.12)]
                    transition
                    hover:bg-[#4146A0]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >

                  {approving && (

                    <span
                      className="
                        h-3.5
                        w-3.5
                        animate-spin
                        rounded-full
                        border-2
                        border-white/30
                        border-t-white
                      "
                    />

                  )}

                  {approving
                    ? "Approving..."
                    : "Approve Notification"}

                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}