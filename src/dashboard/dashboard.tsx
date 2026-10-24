import { NavLink, Routes, Route, Navigate, useLocation } from "react-router-dom";

import Home from "../components/home";
import Approve from "../components/approve";
import User from "../components/user";
import History from "../components/History";
import Syslog from "../components/syslog";

import {
  getCurrentUserName,
  getRole,
} from "../util/auth";

export default function Dashboard() {
  const role = getRole();
  const admin = role?.toUpperCase() === "ADMIN";
  const location = useLocation();

  /*
  ============================================================
  NAVIGATION ORDER

  ADMIN
  1. Home
  2. Syslog
  3. Approve
  4. History
  5. Users

  USER
  1. Home
  2. Syslog
  3. History
  ============================================================
  */

  const NAV_ITEMS = [
    {
      to: "/dashboard/home",
      label: "Home",
      description: "Dashboard overview",
      icon: IconHome,
    },

    {
      to: "/dashboard/syslog",
      label: "Syslog",
      description: "Monitor events",
      icon: IconSignal,
    },

    ...(admin
      ? [
          {
            to: "/dashboard/approve",
            label: "Approve",
            description: "Review requests",
            icon: IconCheck,
          },
        ]
      : []),

    {
      to: "/dashboard/history",
      label: "History",
      description: "Audit records",
      icon: IconClock,
    },

    ...(admin
      ? [
          {
            to: "/dashboard/user",
            label: "Users",
            description: "Manage accounts",
            icon: IconUser,
          },
        ]
      : []),
  ];

  const currentPage = NAV_ITEMS.find((item) =>
    location.pathname.startsWith(item.to)
  );

  const userName = getCurrentUserName() || "User";

  return (
    <div className="flex h-screen overflow-hidden bg-[#080B14] text-slate-200 font-['Sora',sans-serif]">

      {/* =========================================================
          SIDEBAR
      ========================================================= */}
      <aside
        className="
          relative w-[265px] shrink-0
          flex flex-col
          border-r border-white/[0.08]
          bg-[#0B0F1A]
          overflow-hidden
        "
      >

        {/* Background glow */}
        <div
          className="
            absolute -top-32 -left-32
            w-72 h-72
            bg-indigo-600/10
            rounded-full
            blur-3xl
            pointer-events-none
          "
        />

        <div
          className="
            absolute bottom-0 -right-32
            w-72 h-72
            bg-purple-600/10
            rounded-full
            blur-3xl
            pointer-events-none
          "
        />


        {/* =====================================================
            BRAND
        ===================================================== */}
        <div className="relative px-5 pt-6 pb-5">

          <div className="flex items-center gap-3">

            {/* Logo */}
            <div
              className="
                relative
                w-11 h-11
                shrink-0
                rounded-2xl
                bg-gradient-to-br
                from-indigo-500
                to-violet-600
                flex items-center justify-center
                shadow-lg
                shadow-indigo-500/20
              "
            >

              <div
                className="
                  absolute inset-[1px]
                  rounded-2xl
                  bg-gradient-to-br
                  from-white/10
                  to-transparent
                "
              />

              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative"
              >
                <path d="M4 12a8 8 0 1 0 16 0" />
                <path d="M4 12a8 8 0 0 1 16 0" />
                <path d="M12 8v4l2.5 2.5" />
              </svg>

            </div>


            {/* Brand text */}
            <div className="min-w-0">

              <h1 className="text-[15px] font-bold tracking-tight text-white">
                AS Manager
              </h1>

              <div className="flex items-center gap-1.5 mt-0.5">

                <span
                  className="
                    w-1.5 h-1.5
                    rounded-full
                    bg-emerald-400
                    shadow-sm
                    shadow-emerald-400/50
                  "
                />

                <span
                  className="
                    text-[10px]
                    text-slate-400
                    font-['IBM_Plex_Mono',monospace]
                    tracking-wide
                  "
                >
                  SYSLOG MONITOR
                </span>

              </div>

            </div>

          </div>

        </div>


        {/* =====================================================
            SEPARATOR
        ===================================================== */}
        <div className="mx-5 h-px bg-white/[0.09]" />


        {/* =====================================================
            NAVIGATION
        ===================================================== */}
        <div className="relative px-3 pt-6">

          <div className="px-3 mb-3">

            <p
              className="
                text-[10px]
                font-semibold
                tracking-[0.16em]
                uppercase
                text-slate-400
              "
            >
              Workspace
            </p>

          </div>


          <nav className="flex flex-col gap-1">

            {NAV_ITEMS.map((item) => (

              <NavLink
                key={item.to}
                to={item.to}
                className="group relative"
              >

                {({ isActive }) => (

                  <div
                    className={`
                      relative
                      flex items-center gap-3
                      px-3 py-3
                      rounded-xl
                      transition-all duration-200

                      ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-500/[0.20] to-violet-500/[0.10] border border-indigo-400/[0.18]"
                          : "border border-transparent hover:bg-white/[0.045] hover:border-white/[0.08]"
                      }
                    `}
                  >

                    {/* Active glow */}
                    {isActive && (
                      <div
                        className="
                          absolute
                          left-0
                          top-2.5
                          bottom-2.5
                          w-[3px]
                          rounded-r-full
                          bg-gradient-to-b
                          from-indigo-400
                          to-violet-500
                          shadow-lg
                          shadow-indigo-500/40
                        "
                      />
                    )}


                    {/* Icon */}
                    <div
                      className={`
                        w-9 h-9
                        rounded-lg
                        flex items-center justify-center
                        shrink-0
                        transition-all duration-200

                        ${
                          isActive
                            ? "bg-indigo-500/20 text-indigo-200"
                            : "bg-white/[0.04] text-slate-400 group-hover:text-slate-200"
                        }
                      `}
                    >
                      <item.icon active={isActive} />
                    </div>


                    {/* Text */}
                    <div className="min-w-0 flex-1">

                      <p
                        className={`
                          text-[12.5px]
                          font-semibold
                          transition-colors

                          ${
                            isActive
                              ? "text-white"
                              : "text-slate-300 group-hover:text-white"
                          }
                        `}
                      >
                        {item.label}
                      </p>


                      <p
                        className="
                          text-[10px]
                          text-slate-500
                          group-hover:text-slate-400
                          mt-0.5
                          truncate
                          transition-colors
                        "
                      >
                        {item.description}
                      </p>

                    </div>


                    {/* Active arrow */}
                    {isActive && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-indigo-300"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    )}

                  </div>

                )}

              </NavLink>

            ))}

          </nav>

        </div>


        {/* =====================================================
            SYSTEM STATUS
        ===================================================== */}
        <div className="relative mt-auto px-4 pb-4"></div>


        {/* =====================================================
            USER PROFILE
        ===================================================== */}
        <div className="relative px-4 pb-5">

          <div
            className="
              rounded-2xl
              border border-white/[0.09]
              bg-gradient-to-br
              from-white/[0.055]
              to-white/[0.02]
              p-3
              flex items-center gap-3
            "
          >

            {/* Avatar */}
            <div
              className="
                relative
                w-10 h-10
                shrink-0
                rounded-xl
                bg-gradient-to-br
                from-indigo-500/30
                to-violet-500/20
                border
                border-indigo-400/15
                flex items-center justify-center
                text-[12px]
                font-bold
                text-indigo-100
              "
            >

              {userName
                .slice(0, 2)
                .toUpperCase()}

              <span
                className="
                  absolute
                  right-[-1px]
                  bottom-[-1px]
                  w-2.5 h-2.5
                  rounded-full
                  bg-emerald-400
                  border-2
                  border-[#10141f]
                "
              />

            </div>


            {/* User */}
            <div className="min-w-0 flex-1">

              <p
                className="
                  text-[12px]
                  font-semibold
                  text-slate-100
                  truncate
                "
              >
                {userName}
              </p>

              <p
                className="
                  text-[9.5px]
                  text-slate-400
                  mt-0.5
                  uppercase
                  tracking-wider
                  font-['IBM_Plex_Mono',monospace]
                "
              >
                {role || "USER"}
              </p>

            </div>


            {/* More */}
            <button
              type="button"
              className="
                w-7 h-7
                rounded-lg
                flex items-center justify-center
                text-slate-500
                hover:text-slate-200
                hover:bg-white/[0.06]
                transition
              "
            >

              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="5" cy="12" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
              </svg>

            </button>

          </div>

        </div>

      </aside>


      {/* =========================================================
          MAIN APPLICATION
      ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">


        {/* =====================================================
            TOP BAR
        ===================================================== */}
        <header
          className="
            relative
            h-[72px]
            shrink-0
            px-7
            flex items-center
            justify-between
            border-b border-white/[0.08]
            bg-[#0A0E18]/90
            backdrop-blur-xl
          "
        >

          {/* Subtle top glow */}
          <div
            className="
              absolute
              inset-x-0
              top-0
              h-px
              bg-gradient-to-r
              from-transparent
              via-indigo-500/40
              to-transparent
            "
          />


          {/* Page information */}
          <div className="flex items-center gap-4">

            <div>

              <div className="flex items-center gap-2">

                <h2
                  className="
                    text-[17px]
                    font-bold
                    tracking-tight
                    text-white
                  "
                >
                  {currentPage?.label || "Dashboard"}
                </h2>


                <span
                  className="
                    px-2
                    py-0.5
                    rounded-md
                    bg-indigo-500/10
                    border border-indigo-400/[0.15]
                    text-[9px]
                    uppercase
                    tracking-wider
                    text-indigo-300
                  "
                >
                  {admin ? "Admin" : "User"}
                </span>

              </div>


              <p className="text-[10.5px] text-slate-400 mt-1">
                {getPageDescription(currentPage?.label, admin)}
              </p>

            </div>

          </div>


          {/* Right side */}
          <div className="flex items-center gap-3">

            {/* Live status */}
            <div
              className="
                hidden sm:flex
                items-center gap-2
                px-3 py-2
                rounded-xl
                border border-white/[0.08]
                bg-white/[0.035]
              "
            >

              <span className="relative flex w-2 h-2">

                <span
                  className="
                    absolute
                    inline-flex
                    w-full h-full
                    rounded-full
                    bg-emerald-400
                    opacity-40
                    animate-ping
                  "
                />

                <span
                  className="
                    relative
                    inline-flex
                    w-2 h-2
                    rounded-full
                    bg-emerald-400
                  "
                />

              </span>


              <span className="text-[10px] text-slate-300 font-medium">
                Live
              </span>

            </div>


            {/* Notification */}
            <button
              type="button"
              className="
                relative
                w-9 h-9
                rounded-xl
                border border-white/[0.08]
                bg-white/[0.035]
                flex items-center justify-center
                text-slate-400
                hover:text-white
                hover:bg-white/[0.06]
                transition
              "
            >

              <IconBell />

              <span
                className="
                  absolute
                  top-2
                  right-2
                  w-1.5 h-1.5
                  rounded-full
                  bg-indigo-400
                "
              />

            </button>

          </div>

        </header>


        {/* =====================================================
            CONTENT
        ===================================================== */}
        <main
          className="
            relative
            flex-1
            overflow-auto
            bg-[#080B14]
          "
        >

          {/* Background effects */}
          <div
            className="
              pointer-events-none
              fixed
              inset-0
              overflow-hidden
            "
          >

            <div
              className="
                absolute
                top-[-200px]
                right-[-150px]
                w-[500px]
                h-[500px]
                rounded-full
                bg-indigo-600/[0.035]
                blur-[120px]
              "
            />

            <div
              className="
                absolute
                bottom-[-200px]
                left-[20%]
                w-[500px]
                h-[500px]
                rounded-full
                bg-violet-600/[0.025]
                blur-[120px]
              "
            />

          </div>


          {/* Actual page */}
          <div className="relative min-h-full">

            <Routes>

              {/* =================================================
                  HOME
              ================================================= */}
              <Route
                path="home"
                element={<Home />}
              />


              {/* =================================================
                  SYSLOG
              ================================================= */}
              <Route
                path="syslog"
                element={<Syslog />}
              />


              {/* =================================================
                  APPROVE
              ================================================= */}
              <Route
                path="approve"
                element={
                  admin
                    ? <Approve />
                    : <RestrictedPanel />
                }
              />


              {/* =================================================
                  HISTORY
              ================================================= */}
              <Route
                path="history"
                element={<History />}
              />


              {/* =================================================
                  USERS - ADMIN ONLY
              ================================================= */}
              <Route
                path="user"
                element={
                  admin
                    ? <User />
                    : <RestrictedPanel />
                }
              />


              {/* =================================================
                  DEFAULT
              ================================================= */}
              <Route
                path=""
                element={
                  <Navigate
                    to="home"
                    replace
                  />
                }
              />

            </Routes>

          </div>

        </main>

      </div>

    </div>
  );
}


/* =============================================================
   PAGE DESCRIPTION
============================================================= */

function getPageDescription(
  page: string | undefined,
  admin: boolean
) {
  switch (page) {

    case "Home":
      return "System overview and monitoring summary";

    case "Syslog":
      return "Monitor, inspect and manage incoming events";

    case "Approve":
      return "Review and manage pending notifications";

    case "History":
      return admin
        ? "Complete system notification audit history"
        : "Your notification activity history";

    case "Users":
      return "Manage system users and access permissions";

    default:
      return "System monitoring dashboard";
  }
}


/* =============================================================
   RESTRICTED PANEL
============================================================= */

function RestrictedPanel() {
  return (
    <div className="min-h-full flex items-center justify-center px-6">

      <div
        className="
          relative
          w-full
          max-w-md
          rounded-3xl
          border border-white/[0.08]
          bg-[#101522]
          p-8
          text-center
          shadow-2xl
        "
      >

        {/* Glow */}
        <div
          className="
            absolute
            inset-x-20
            -top-10
            h-20
            bg-indigo-500/10
            blur-3xl
            rounded-full
          "
        />


        {/* Icon */}
        <div
          className="
            relative
            mx-auto
            w-16 h-16
            rounded-2xl
            bg-indigo-500/10
            border border-indigo-400/15
            flex items-center justify-center
            mb-5
          "
        >

          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-indigo-300"
          >

            <rect
              x="4"
              y="10"
              width="16"
              height="10"
              rx="2"
            />

            <path d="M8 10V7a4 4 0 0 1 8 0v3" />

          </svg>

        </div>


        <h3 className="text-[17px] font-bold text-white">
          Admin access required
        </h3>


        <p
          className="
            text-[12px]
            leading-6
            text-slate-400
            mt-2
            max-w-sm
            mx-auto
          "
        >
          This section is restricted to administrator
          accounts. Contact an administrator if you need access.
        </p>


        <div className="mt-6 flex items-center justify-center gap-2">

          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />

          <span
            className="
              text-[10px]
              text-slate-400
              uppercase
              tracking-widest
            "
          >
            Restricted area
          </span>

        </div>

      </div>

    </div>
  );
}


/* =============================================================
   HOME ICON
============================================================= */

function IconHome({
  active,
}: {
  active: boolean;
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#C7D2FE" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  );
}


/* =============================================================
   CHECK ICON
============================================================= */

function IconCheck({
  active,
}: {
  active: boolean;
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#C7D2FE" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.3 2.3L15.7 9.5" />
    </svg>
  );
}


/* =============================================================
   SIGNAL ICON
============================================================= */

function IconSignal({
  active,
}: {
  active: boolean;
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#C7D2FE" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M7.5 12.5a4 4 0 0 1 9 0" />

      <circle
        cx="12"
        cy="19"
        r="1.4"
        fill={active ? "#C7D2FE" : "currentColor"}
        stroke="none"
      />
    </svg>
  );
}


/* =============================================================
   USER ICON
============================================================= */

function IconUser({
  active,
}: {
  active: boolean;
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#C7D2FE" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}


/* =============================================================
   CLOCK ICON
============================================================= */

function IconClock({
  active,
}: {
  active: boolean;
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#C7D2FE" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}


/* =============================================================
   BELL ICON
============================================================= */

function IconBell() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}