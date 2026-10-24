import { useState } from "react";
import sendHTTP from "../util/axios";
import { useNavigate } from "react-router-dom";
import { setSession } from "../util/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();

    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);

      console.log("Login request:", {
        email: email.trim(),
        password: "***",
      });

      const res: any = await sendHTTP(
        "/api/v1/user/login",
        "post",
        {
          email: email.trim(),
          password,
        },
      );

      console.log("Login response:", res);

      if (res?.message === "Login Successfully") {
        setSession({
          role: res?.data?.role,
          userId: res?.data?._id,
          name: res?.data?.name,
        });

        navigate("/dashboard/home");
        return;
      }

      setError(
        res?.message || "Incorrect email or password.",
      );
    } catch (err: any) {
      console.error("Login failed:", err);

      const status = err?.response?.status;
      const backendMessage =
        err?.response?.data?.message;

      console.error("Login status:", status);
      console.error(
        "Backend response:",
        err?.response?.data,
      );

      if (status === 400) {
        setError(
          backendMessage ||
            "Bad request. Please check the login data sent to the server.",
        );
      } else if (status === 401) {
        setError(
          backendMessage ||
            "Incorrect email or password.",
        );
      } else if (status === 404) {
        setError(
          "Login endpoint was not found.",
        );
      } else if (status === 500) {
        setError(
          "Server error. Please check the backend.",
        );
      } else {
        setError(
          backendMessage ||
            "Unable to login. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="
        relative
        min-h-screen
        overflow-hidden
        flex items-center justify-center
        bg-[#080B14]
        text-white
        font-['Sora',sans-serif]
        px-6 py-10
      "
    >

      {/* =====================================================
          BACKGROUND GLOW
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -top-48
          -left-40
          w-[600px]
          h-[600px]
          rounded-full
          bg-indigo-600/[0.10]
          blur-[130px]
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-48
          -right-40
          w-[600px]
          h-[600px]
          rounded-full
          bg-violet-600/[0.09]
          blur-[130px]
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          top-[30%]
          right-[20%]
          w-[300px]
          h-[300px]
          rounded-full
          bg-indigo-500/[0.035]
          blur-[100px]
        "
      />


      {/* =====================================================
          LOGIN CONTAINER
      ===================================================== */}

      <div className="relative w-full max-w-[430px]">

        {/* =================================================
            BRAND
        ================================================= */}

        <div className="text-center mb-8">

          {/* Logo */}
          <div
            className="
              relative
              mx-auto
              w-[62px]
              h-[62px]
              rounded-[20px]
              bg-gradient-to-br
              from-indigo-500
              to-violet-600
              flex items-center justify-center
              shadow-2xl
              shadow-indigo-500/25
              mb-5
            "
          >

            {/* Inner highlight */}
            <div
              className="
                absolute
                inset-[1px]
                rounded-[19px]
                bg-gradient-to-br
                from-white/[0.16]
                to-transparent
              "
            />

            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="relative"
            >
              <path d="M4 12a8 8 0 1 0 16 0" />
              <path d="M4 12a8 8 0 0 1 16 0" />
              <path d="M12 8v4l2.5 2.5" />
            </svg>

          </div>


          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-2">

            <h1
              className="
                text-[22px]
                font-bold
                tracking-tight
                text-white
              "
            >
              AS Manager
            </h1>

            <span
              className="
                px-2
                py-0.5
                rounded-md
                bg-indigo-500/10
                border border-indigo-400/10
                text-[8px]
                font-semibold
                uppercase
                tracking-[0.15em]
                text-indigo-300
              "
            >
              SYSLOG
            </span>

          </div>


          <p className="text-[12px] text-slate-500">
            Sign in to access your monitoring dashboard
          </p>

        </div>


        {/* =================================================
            LOGIN CARD
        ================================================= */}

        <div
          className="
            relative
            rounded-[24px]
            border border-white/[0.08]
            bg-gradient-to-br
            from-white/[0.055]
            to-white/[0.02]
            backdrop-blur-2xl
            p-7
            shadow-2xl
            shadow-black/30
          "
        >

          {/* Top highlight */}
          <div
            className="
              absolute
              top-0
              left-10
              right-10
              h-px
              bg-gradient-to-r
              from-transparent
              via-indigo-400/40
              to-transparent
            "
          />


          {/* =================================================
              CARD HEADER
          ================================================= */}

          <div className="mb-6">

            <h2 className="text-[17px] font-bold text-white">
              Welcome back
            </h2>

            <p className="text-[11px] text-slate-600 mt-1">
              Enter your credentials to continue
            </p>

          </div>


          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div
              className="
                flex
                items-start
                gap-3
                rounded-xl
                border
                border-red-400/[0.12]
                bg-red-500/[0.06]
                px-3.5
                py-3
                mb-5
              "
            >

              <div
                className="
                  w-7
                  h-7
                  shrink-0
                  rounded-lg
                  bg-red-400/10
                  flex
                  items-center
                  justify-center
                  text-red-300
                "
              >
                <IconAlert />
              </div>

              <div>
                <p className="text-[11px] font-semibold text-red-300">
                  Sign in failed
                </p>

                <p className="text-[10.5px] text-red-300/60 mt-0.5 leading-5">
                  {error}
                </p>
              </div>

            </div>
          )}


          {/* =================================================
              EMAIL
          ================================================= */}

          <div className="mb-5">

            <label
              htmlFor="email"
              className="
                block
                text-[10px]
                font-semibold
                uppercase
                tracking-[0.12em]
                text-slate-500
                mb-2
              "
            >
              Email address
            </label>

            <div className="relative group">

              <div
                className="
                  absolute
                  left-3.5
                  top-1/2
                  -translate-y-1/2
                  text-slate-600
                  group-focus-within:text-indigo-400
                  transition-colors
                "
              >
                <IconMail />
              </div>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
                className="
                  w-full
                  h-[48px]
                  bg-[#080B14]/70
                  border
                  border-white/[0.07]
                  rounded-xl
                  pl-11
                  pr-4
                  text-[12px]
                  text-slate-200
                  placeholder-slate-700
                  outline-none
                  transition-all
                  duration-200
                  font-['IBM_Plex_Mono',monospace]

                  focus:border-indigo-400/40
                  focus:bg-indigo-500/[0.025]
                  focus:ring-4
                  focus:ring-indigo-500/[0.06]

                  disabled:opacity-50
                "
              />

            </div>

          </div>


          {/* =================================================
              PASSWORD
          ================================================= */}

          <div className="mb-6">

            <div className="flex items-center justify-between mb-2">

              <label
                htmlFor="password"
                className="
                  block
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.12em]
                  text-slate-500
                "
              >
                Password
              </label>

              <span
                className="
                  text-[9px]
                  text-slate-700
                  uppercase
                  tracking-wider
                "
              >
                Secure
              </span>

            </div>


            <div className="relative group">

              {/* Lock */}
              <div
                className="
                  absolute
                  left-3.5
                  top-1/2
                  -translate-y-1/2
                  text-slate-600
                  group-focus-within:text-indigo-400
                  transition-colors
                "
              >
                <IconLock />
              </div>


              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                className="
                  w-full
                  h-[48px]
                  bg-[#080B14]/70
                  border
                  border-white/[0.07]
                  rounded-xl
                  pl-11
                  pr-12
                  text-[12px]
                  text-slate-200
                  placeholder-slate-700
                  outline-none
                  transition-all
                  duration-200
                  font-['IBM_Plex_Mono',monospace]

                  focus:border-indigo-400/40
                  focus:bg-indigo-500/[0.025]
                  focus:ring-4
                  focus:ring-indigo-500/[0.06]

                  disabled:opacity-50
                "
              />


              {/* Password toggle */}
              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                disabled={loading}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  w-8
                  h-8
                  rounded-lg
                  flex
                  items-center
                  justify-center
                  text-slate-600
                  hover:text-slate-300
                  hover:bg-white/[0.05]
                  transition-all
                  disabled:opacity-50
                "
              >
                {showPassword ? (
                  <IconEyeOff />
                ) : (
                  <IconEye />
                )}
              </button>

            </div>

          </div>


          {/* =================================================
              LOGIN BUTTON
          ================================================= */}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="
              group
              relative
              w-full
              h-[49px]
              overflow-hidden
              rounded-xl

              bg-gradient-to-r
              from-indigo-500
              to-violet-600

              text-white
              text-[12.5px]
              font-bold

              shadow-lg
              shadow-indigo-500/20

              transition-all
              duration-200

              hover:from-indigo-400
              hover:to-violet-500
              hover:shadow-xl
              hover:shadow-indigo-500/25
              hover:-translate-y-[1px]

              active:translate-y-0

              disabled:opacity-50
              disabled:cursor-not-allowed
              disabled:hover:translate-y-0
            "
          >

            {/* Button shine */}
            <span
              className="
                absolute
                inset-0
                bg-gradient-to-r
                from-transparent
                via-white/[0.12]
                to-transparent
                -translate-x-full
                group-hover:translate-x-full
                transition-transform
                duration-700
              "
            />

            <span className="relative flex items-center justify-center gap-2">

              {loading ? (
                <>
                  <span
                    className="
                      w-4
                      h-4
                      border-2
                      border-white/30
                      border-t-white
                      rounded-full
                      animate-spin
                    "
                  />

                  <span>
                    Signing in...
                  </span>
                </>
              ) : (
                <>
                  <span>
                    Sign in to dashboard
                  </span>

                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="
                      transition-transform
                      duration-200
                      group-hover:translate-x-1
                    "
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </>
              )}

            </span>

          </button>


          {/* =================================================
              SECURITY MESSAGE
          ================================================= */}

          <div className="mt-5 flex items-center justify-center gap-2">

            <IconShield />

            <p className="text-[9px] text-slate-700">
              Protected system • Authorized users only
            </p>

          </div>

        </div>


        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="mt-6 text-center">

          <div className="flex items-center justify-center gap-2">

            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />

            <span
              className="
                text-[9px]
                uppercase
                tracking-[0.16em]
                text-slate-700
              "
            >
              System operational
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}


/* =============================================================
   MAIL ICON
============================================================= */

function IconMail() {
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
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />

      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}


/* =============================================================
   LOCK ICON
============================================================= */

function IconLock() {
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
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
      />

      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}


/* =============================================================
   EYE ICON
============================================================= */

function IconEye() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}


/* =============================================================
   EYE OFF ICON
============================================================= */

function IconEyeOff() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-3.1 4.2" />
      <path d="M6.6 6.6C3.4 8.7 1 12 1 12s4 8 11 8c1.5 0 2.9-.3 4.1-.8" />
    </svg>
  );
}


/* =============================================================
   ALERT ICON
============================================================= */

function IconAlert() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}


/* =============================================================
   SHIELD ICON
============================================================= */

function IconShield() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-700"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}