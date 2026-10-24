import { useEffect, useMemo, useState } from "react";
import sendHTTP from "../util/axios";
import { getCurrentUserName } from "../util/auth";

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

  assignedTo?: string;
  assignedBy?: string;
  assignedDate?: string;

  fixedBy?: string;
  fixedAt?: string;

  approvedBy?: string;
  approvedAt?: string;

  statusUpdatedBy?: string;
  statusUpdatedAt?: string;

  createdAt?: string;
  updatedAt?: string;
}

interface DashboardSectionProps {
  title: string;
  description: string;
  logs: ISyslogMessage[];
  loading: boolean;
  emptyText: string;
}

// ============================================================
// COLORS
// ============================================================

const COLORS = {
  bg: "#0D1117",

  panel: "#111827",
  panel2: "#141A2B",

  border: "#263047",
  borderSoft: "#20283B",

  white: "#FFFFFF",

  text: "#E7EAF3",
  textSoft: "#B8C0D4",

  muted: "#8E97AD",
  muted2: "#69738D",

  primary: "#7C80FF",

  green: "#35D0B0",
  orange: "#F5B84B",
  red: "#FF6675",
  blue: "#65A9FF",
};

// ============================================================
// STATUS META
// ============================================================

const statusMeta: Record<
  string,
  {
    label: string;
    color: string;
    background: string;
  }
> = {
  pending: {
    label: "Pending",
    color: COLORS.muted,
    background: "rgba(142, 151, 173, 0.12)",
  },

  assigned: {
    label: "Assigned",
    color: COLORS.blue,
    background: "rgba(101, 169, 255, 0.12)",
  },

  fixed: {
    label: "Awaiting Approval",
    color: COLORS.orange,
    background: "rgba(245, 184, 75, 0.12)",
  },

  complete: {
    label: "Complete",
    color: COLORS.green,
    background: "rgba(53, 208, 176, 0.12)",
  },

  not_complete: {
    label: "Not Complete",
    color: COLORS.red,
    background: "rgba(255, 102, 117, 0.12)",
  },
};

// ============================================================
// AUTH HELPERS
// ============================================================

function roleIsAdmin(): boolean {
  return (
    String(localStorage.getItem("role") || "").toUpperCase() === "ADMIN"
  );
}

function getUserId(): string {
  return String(localStorage.getItem("userId") || "");
}

// ============================================================
// API HELPERS
// ============================================================

function responseArray<T>(response: any): T[] {
  /*
   * Supports both:
   *
   * response.data
   *
   * and:
   *
   * response.data.data
   *
   * because your backend returns:
   *
   * {
   *   message: "...",
   *   data: [...],
   *   pagination: {...}
   * }
   */

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function responsePagination(response: any) {
  return (
    response?.data?.pagination ||
    response?.pagination ||
    undefined
  );
}

// ============================================================
// DATE HELPERS
// ============================================================

function getLogDate(log: ISyslogMessage): string {
  return log.timestamp || log.createdAt || "";
}

function formatDate(value?: string): string {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ============================================================
// SYSLOG HELPERS
// ============================================================

function getSyslogMessage(log: ISyslogMessage): string {
  return (
    log.msg_text?.trim() ||
    log.raw?.trim() ||
    log.msg_tag?.trim() ||
    "No syslog message"
  );
}

function getStatusMeta(status?: string) {
  if (status && statusMeta[status]) {
    return statusMeta[status];
  }

  return statusMeta.pending;
}

// ============================================================
// HOME
// ============================================================

export default function Home() {
  const admin = roleIsAdmin();

  const userId = getUserId();

  const userName = getCurrentUserName() || "User";

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [userCount, setUserCount] = useState(0);

  /*
   * Latest 5 incomplete notifications.
   */
  const [latestIncomplete, setLatestIncomplete] = useState<
    ISyslogMessage[]
  >([]);

  /*
   * Member:
   * Logs assigned to the currently logged-in member.
   */
  const [myIncompleteLogs, setMyIncompleteLogs] = useState<
    ISyslogMessage[]
  >([]);

  /*
   * Admin:
   * All assigned logs.
   */
  const [allAssignedLogs, setAllAssignedLogs] = useState<
    ISyslogMessage[]
  >([]);

  /*
   * Admin:
   * Number of unassigned incomplete logs.
   */
  const [unassignedCount, setUnassignedCount] = useState(0);

  /*
   * Admin:
   * Number of fixed logs waiting for approval.
   *
   * Member:
   * Number of their assigned logs currently fixed.
   */
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // ==========================================================
  // LOAD DASHBOARD
  // ==========================================================

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      // ========================================================
      // COMMON:
      // LATEST 5 INCOMPLETE LOGS
      // ========================================================

      const latestResponse: any = await sendHTTP(
        "/api/v1/notification?incomplete=true&page=1&limit=5",
        "get",
      );

      const latestLogs =
        responseArray<ISyslogMessage>(latestResponse);

      setLatestIncomplete(latestLogs.slice(0, 5));

      // ========================================================
      // MEMBER DASHBOARD
      // ========================================================

      if (!admin) {
        if (!userId) {
          setMyIncompleteLogs([]);
          setPendingApprovalCount(0);

          return;
        }

        const assignedResponse: any = await sendHTTP(
          `/api/v1/notification/assigned/${encodeURIComponent(
            userId,
          )}?page=1&limit=100`,
          "get",
        );

        const assignedLogs =
          responseArray<ISyslogMessage>(assignedResponse);

        /*
         * Complete logs are not considered incomplete.
         */
        const incompleteAssigned = assignedLogs
          .filter((log) => log.status !== "complete")
          .sort(
            (a, b) =>
              new Date(getLogDate(b)).getTime() -
              new Date(getLogDate(a)).getTime(),
          );

        setMyIncompleteLogs(incompleteAssigned);

        /*
         * "Pending Approval" means:
         *
         * status === "fixed"
         *
         * because a member fixes the task and the admin
         * subsequently approves/rejects it.
         */
        setPendingApprovalCount(
          assignedLogs.filter(
            (log) => log.status === "fixed",
          ).length,
        );

        return;
      }

      // ========================================================
      // ADMIN DASHBOARD
      // ========================================================

      const [userResponse, assignedResponse]: any[] =
        await Promise.all([
          sendHTTP("/api/v1/user/count", "get"),

          sendHTTP(
            "/api/v1/notification/assigned?page=1&limit=100",
            "get",
          ),
        ]);

      // --------------------------------------------------------
      // USER COUNT
      // --------------------------------------------------------

      setUserCount(
        Number(userResponse?.data?.count ?? 0),
      );

      // --------------------------------------------------------
      // ASSIGNED LOGS
      // --------------------------------------------------------

      const assignedLogs =
        responseArray<ISyslogMessage>(assignedResponse);

      setAllAssignedLogs(assignedLogs);

      // --------------------------------------------------------
      // PENDING APPROVAL
      // --------------------------------------------------------

      setPendingApprovalCount(
        assignedLogs.filter(
          (log) => log.status === "fixed",
        ).length,
      );

      // --------------------------------------------------------
      // UNASSIGNED INCOMPLETE LOGS
      // --------------------------------------------------------
      //
      // TEMPORARY FRONTEND CALCULATION.
      //
      // Your current backend does not yet provide:
      //
      // GET /notification/counts/dashboard
      //
      // Therefore we retrieve up to 100 incomplete logs and
      // calculate the unassigned count here.
      //
      // Backend change recommended below will make this exact
      // for any number of logs.
      // --------------------------------------------------------

      const incompleteResponse: any = await sendHTTP(
        "/api/v1/notification?incomplete=true&page=1&limit=100",
        "get",
      );

      const incompleteLogs =
        responseArray<ISyslogMessage>(
          incompleteResponse,
        );

      const unassigned = incompleteLogs.filter(
        (log) =>
          !log.assignedTo ||
          String(log.assignedTo).trim() === "",
      );

      setUnassignedCount(unassigned.length);
    } catch (error) {
      console.error(
        "Failed to load Home dashboard:",
        error,
      );

      setError(
        "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadDashboard();
  }, []);

  // ==========================================================
  // ADMIN INCOMPLETE ASSIGNED LOGS
  // ==========================================================

  const adminIncompleteAssigned = useMemo(() => {
    return allAssignedLogs
      .filter(
        (log) => log.status !== "complete",
      )
      .sort(
        (a, b) =>
          new Date(getLogDate(b)).getTime() -
          new Date(getLogDate(a)).getTime(),
      );
  }, [allAssignedLogs]);

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div
      style={{
        minHeight: "100vh",

        background: COLORS.bg,

        color: COLORS.text,

        padding: "28px",

        boxSizing: "border-box",

        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1450px",
          margin: "0 auto",
        }}
      >
        {/* ====================================================
            HEADER
        ===================================================== */}

        <header
          style={{
            display: "flex",

            justifyContent: "space-between",

            alignItems: "flex-start",

            gap: "20px",

            flexWrap: "wrap",

            marginBottom: "26px",
          }}
        >
          <div>
            <div
              style={{
                color: COLORS.primary,

                fontSize: "11px",

                fontWeight: 800,

                letterSpacing: "1.4px",

                textTransform: "uppercase",

                marginBottom: "8px",
              }}
            >
              {admin
                ? "Admin Dashboard"
                : "User Dashboard"}
            </div>

            <h1
              style={{
                margin: 0,

                color: COLORS.white,

                fontSize: "28px",

                lineHeight: 1.2,

                fontWeight: 750,

                letterSpacing: "-0.6px",
              }}
            >
              Good morning, {userName}
            </h1>

            <div
              style={{
                marginTop: "9px",

                color: COLORS.textSoft,

                fontSize: "13px",

                fontWeight: 500,
              }}
            >
              {formatToday()}
            </div>
          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            style={{
              border:
                `1px solid ${COLORS.border}`,

              background:
                COLORS.panel2,

              color:
                COLORS.text,

              borderRadius:
                "9px",

              padding:
                "10px 15px",

              cursor:
                loading
                  ? "not-allowed"
                  : "pointer",

              fontSize:
                "12px",

              fontWeight:
                700,

              opacity:
                loading ? 0.6 : 1,
            }}
          >
            ↻ &nbsp; Refresh
          </button>
        </header>

        {/* ====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div
            style={{
              marginBottom: "18px",

              padding:
                "12px 14px",

              borderRadius:
                "9px",

              border:
                "1px solid rgba(255,102,117,.3)",

              background:
                "rgba(255,102,117,.12)",

              color:
                "#FF9AA4",

              fontSize:
                "12px",

              fontWeight:
                600,
            }}
          >
            {error}
          </div>
        )}

        {/* ====================================================
            SUMMARY CARDS
        ===================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",

            gap:
              "13px",

            marginBottom:
              "22px",
          }}
        >
          {admin ? (
            <>
              {/* UNASSIGNED */}

              <StatCard
                title="Unassigned Logs"
                value={unassignedCount}
                accent={COLORS.red}
                icon="○"
              />

              {/* APPROVAL */}

              <StatCard
                title="Pending Approval"
                value={pendingApprovalCount}
                accent={COLORS.orange}
                icon="!"
              />

              {/* USERS */}

              <StatCard
                title="Users"
                value={userCount}
                accent={COLORS.primary}
                icon="◈"
              />
            </>
          ) : (
            <>
              {/* MEMBER APPROVAL */}

              <StatCard
                title="Pending Approval"
                value={pendingApprovalCount}
                accent={COLORS.orange}
                icon="!"
              />

              {/* MEMBER INCOMPLETE */}

              <StatCard
                title="My Incomplete Logs"
                value={myIncompleteLogs.length}
                accent={COLORS.primary}
                icon="⌁"
              />
            </>
          )}
        </div>

        {/* ====================================================
            LATEST 5 INCOMPLETE
        ===================================================== */}

        <DashboardSection
          title="Latest incomplete logs"
          description="The five most recent unresolved system events."
          logs={latestIncomplete}
          loading={loading}
          emptyText="No incomplete logs found."
        />

        {/* ====================================================
            MEMBER:
            MY INCOMPLETE LOGS
        ===================================================== */}

        {!admin && (
          <DashboardSection
            title="My incomplete logs"
            description="Incomplete logs currently assigned to you."
            logs={myIncompleteLogs.slice(0, 5)}
            loading={loading}
            emptyText="No incomplete logs are currently assigned to you."
          />
        )}

        {/* ====================================================
            ADMIN:
            ASSIGNED LOGS
        ===================================================== */}

        {admin && (
          <DashboardSection
            title="Assigned logs awaiting action"
            description="Assigned notifications that are not yet complete."
            logs={adminIncompleteAssigned.slice(0, 5)}
            loading={loading}
            emptyText="No assigned incomplete logs."
          />
        )}
      </div>

      {/* ======================================================
          RESPONSIVE CSS
      ======================================================= */}

      <style>
        {`
          .home-log-card {
            transition:
              background 0.18s ease,
              border-color 0.18s ease,
              transform 0.18s ease;
          }

          .home-log-card:hover {
            border-color: #37425E !important;
            background: #151C2E !important;
            transform: translateY(-1px);
          }

          @media (max-width: 800px) {
            .home-log-card {
              grid-template-columns: 1fr 1fr !important;
            }
          }

          @media (max-width: 500px) {
            .home-log-card {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
}

// ============================================================
// DASHBOARD SECTION
// ============================================================

function DashboardSection({
  title,
  description,
  logs,
  loading,
  emptyText,
}: DashboardSectionProps) {
  return (
    <section
      style={{
        background:
          COLORS.panel,

        border:
          `1px solid ${COLORS.borderSoft}`,

        borderRadius:
          "13px",

        overflow:
          "hidden",

        marginBottom:
          "20px",

        boxShadow:
          "0 10px 35px rgba(0,0,0,.18)",
      }}
    >
      {/* SECTION HEADER */}

      <div
        style={{
          padding:
            "18px 20px",

          borderBottom:
            `1px solid ${COLORS.borderSoft}`,
        }}
      >
        <h2
          style={{
            margin:
              0,

            color:
              COLORS.white,

            fontSize:
              "15px",

            fontWeight:
              750,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin:
              "6px 0 0",

            color:
              COLORS.muted,

            fontSize:
              "11px",

            fontWeight:
              500,
          }}
        >
          {description}
        </p>
      </div>

      {/* LOADING */}

      {loading ? (
        <div
          style={{
            minHeight:
              "140px",

            display:
              "grid",

            placeItems:
              "center",

            color:
              COLORS.muted,

            fontSize:
              "12px",
          }}
        >
          Loading logs...
        </div>
      ) : logs.length === 0 ? (
        /* EMPTY */
        <div
          style={{
            minHeight:
              "140px",

            display:
              "grid",

            placeItems:
              "center",

            color:
              COLORS.muted,

            fontSize:
              "12px",

            padding:
              "20px",

            textAlign:
              "center",
          }}
        >
          {emptyText}
        </div>
      ) : (
        /* LOGS */
        logs.map((log, index) => (
          <LogCard
            key={
              log._id ||
              `${getLogDate(log)}-${index}`
            }
            log={log}
            last={
              index === logs.length - 1
            }
          />
        ))
      )}
    </section>
  );
}

// ============================================================
// LOG CARD
// ============================================================

function LogCard({
  log,
  last,
}: {
  log: ISyslogMessage;
  last: boolean;
}) {
  const meta =
    getStatusMeta(log.status);

  return (
    <div
      className="home-log-card"
      style={{
        display:
          "grid",

        gridTemplateColumns:
          "150px 180px minmax(150px, 1fr) minmax(180px, 1.5fr)",

        gap:
          "16px",

        alignItems:
          "center",

        padding:
          "15px 20px",

        borderBottom:
          last
            ? "none"
            : `1px solid ${COLORS.borderSoft}`,

        background:
          COLORS.panel,
      }}
    >
      {/* ====================================================
          STATUS
      ===================================================== */}

      <LogField label="Status">
        <span
          style={{
            display:
              "inline-flex",

            alignItems:
              "center",

            padding:
              "5px 8px",

            borderRadius:
              "6px",

            background:
              meta.background,

            border:
              `1px solid ${meta.color}45`,

            color:
              meta.color,

            fontSize:
              "10px",

            fontWeight:
              800,

            whiteSpace:
              "nowrap",
          }}
        >
          {meta.label}
        </span>
      </LogField>

      {/* ====================================================
          DATE
      ===================================================== */}

      <LogField label="Date">
        <span
          style={{
            color:
              COLORS.textSoft,

            fontSize:
              "11px",

            fontWeight:
              600,
          }}
        >
          {formatDate(
            getLogDate(log),
          )}
        </span>
      </LogField>

      {/* ====================================================
          IP
      ===================================================== */}

      <LogField label="IP Address">
        <span
          title={
            log.ipAddress ||
            "No IP address"
          }
          style={{
            display:
              "block",

            color:
              log.ipAddress
                ? COLORS.text
                : COLORS.muted2,

            fontSize:
              "11px",

            fontFamily:
              "IBM Plex Mono, Consolas, monospace",

            overflow:
              "hidden",

            textOverflow:
              "ellipsis",

            whiteSpace:
              "nowrap",
          }}
        >
          {log.ipAddress ||
            "No IP"}
        </span>
      </LogField>

      {/* ====================================================
          SYSLOG
      ===================================================== */}

      <LogField label="Syslog">
        <span
          title={
            getSyslogMessage(log)
          }
          style={{
            display:
              "block",

            color:
              COLORS.text,

            fontSize:
              "11px",

            lineHeight:
              1.45,

            fontFamily:
              "IBM Plex Mono, Consolas, monospace",

            overflow:
              "hidden",

            textOverflow:
              "ellipsis",

            whiteSpace:
              "nowrap",
          }}
        >
          {getSyslogMessage(log)}
        </span>
      </LogField>
    </div>
  );
}

// ============================================================
// LOG FIELD
// ============================================================

function LogField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minWidth:
          0,
      }}
    >
      <div
        style={{
          color:
            COLORS.muted2,

          fontSize:
            "9px",

          fontWeight:
            800,

          letterSpacing:
            "0.7px",

          marginBottom:
            "6px",

          textTransform:
            "uppercase",
        }}
      >
        {label}
      </div>

      {children}
    </div>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  title,
  value,
  accent,
  icon,
}: {
  title: string;
  value: number;
  accent: string;
  icon: string;
}) {
  return (
    <div
      style={{
        position:
          "relative",

        overflow:
          "hidden",

        background:
          COLORS.panel,

        border:
          `1px solid ${COLORS.borderSoft}`,

        borderRadius:
          "12px",

        padding:
          "18px",

        minHeight:
          "100px",

        boxSizing:
          "border-box",

        boxShadow:
          "0 8px 25px rgba(0,0,0,.14)",
      }}
    >
      <div
        style={{
          display:
            "flex",

          alignItems:
            "flex-start",

          justifyContent:
            "space-between",

          gap:
            "15px",
        }}
      >
        {/* TEXT */}

        <div>
          <div
            style={{
              color:
                COLORS.textSoft,

              fontSize:
                "11px",

              fontWeight:
                700,

              marginBottom:
                "9px",
            }}
          >
            {title}
          </div>

          <div
            style={{
              color:
                COLORS.white,

              fontSize:
                "25px",

              lineHeight:
                1,

              fontWeight:
                800,
            }}
          >
            {value.toLocaleString()}
          </div>
        </div>

        {/* ICON */}

        <div
          style={{
            width:
              "32px",

            height:
              "32px",

            flexShrink:
              0,

            display:
              "grid",

            placeItems:
              "center",

            borderRadius:
              "8px",

            background:
              `${accent}18`,

            border:
              `1px solid ${accent}35`,

            color:
              accent,

            fontSize:
              "14px",

            fontWeight:
              800,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}