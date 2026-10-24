// Simple role helper.
// Session information is stored in localStorage at login time.

export type Role = "ADMIN" | "USER";

export interface Session {
  role: Role;
  userId: string | null;
  name: string;
}

// Get current user's role
export function getRole(): Role {
  const r = localStorage.getItem("role");
  return r === "ADMIN" ? "ADMIN" : "USER";
}

// Check whether current user is an admin
export function isAdmin(): boolean {
  return getRole() === "ADMIN";
}

// Get current user's ID
export function getCurrentUserId(): string | null {
  return localStorage.getItem("userId");
}

// Get current user's name
export function getCurrentUserName(): string {
  return localStorage.getItem("userName") || "User";
}

// Store login session
export function setSession(opts: {
  role?: string;
  userId?: string;
  name?: string;
}) {
  if (opts.role) {
    localStorage.setItem("role", opts.role);
  }

  if (opts.userId) {
    localStorage.setItem("userId", opts.userId);
  }

  if (opts.name) {
    localStorage.setItem("userName", opts.name);
  }
}

// Get complete current session
export function getSession(): Session {
  return {
    role: getRole(),
    userId: getCurrentUserId(),
    name: getCurrentUserName(),
  };
}

// Clear login session
export function clearSession() {
  localStorage.removeItem("role");
  localStorage.removeItem("userId");
  localStorage.removeItem("userName");
}