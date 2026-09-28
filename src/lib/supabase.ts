const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase environment variables are missing; auth requests will fail until configured.");
}

export function supabaseEndpoint(path: string) {
  return `${supabaseUrl ?? ""}${path}`;
}

export function supabaseHeaders(accessToken?: string): HeadersInit {
  return {
    apikey: supabaseKey ?? "",
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.");
  }
  return (await response.json()) as T;
}

export type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email?: string };
  error_description?: string;
  msg?: string;
};

export function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(currentUserIdKey);
}

export type AuthUser = {
  id: string;
  email?: string;
  /** Raw bearer token, valid because it was just verified/refreshed. */
  accessToken: string;
};

const accessTokenKey = "school_access_token";
const refreshTokenKey = "school_refresh_token";
const expiresAtKey = "school_token_expires_at";
const currentUserIdKey = "school_user_id";
let refreshInFlight: Promise<boolean> | null = null;

export function persistAuthSession(session: AuthResponse) {
  if (typeof window === "undefined" || !session.access_token) return;
  sessionStorage.setItem(accessTokenKey, session.access_token);
  if (session.refresh_token) sessionStorage.setItem(refreshTokenKey, session.refresh_token);
  if (session.user?.id) sessionStorage.setItem("school_user_id", session.user.id);
  if (session.expires_in) {
    sessionStorage.setItem(expiresAtKey, String(Date.now() + session.expires_in * 1000));
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(accessTokenKey);
  sessionStorage.removeItem(refreshTokenKey);
  sessionStorage.removeItem(expiresAtKey);
  sessionStorage.removeItem("school_user_id");
}

async function refreshAuthSession() {
  if (typeof window === "undefined") return false;
  const refreshToken = sessionStorage.getItem(refreshTokenKey);
  if (!refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(supabaseEndpoint("/auth/v1/token?grant_type=refresh_token"), {
        method: "POST",
        headers: supabaseHeaders(),
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null) as AuthResponse | null;
      if (!response.ok || !payload?.access_token) {
        clearAuthSession();
        return false;
      }
      persistAuthSession(payload);
      return true;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function ensureFreshAuthSession() {
  if (typeof window === "undefined") return;
  const expiresAt = Number(sessionStorage.getItem(expiresAtKey) ?? 0);
  if (expiresAt && expiresAt - Date.now() < 30_000) {
    await refreshAuthSession();
  }
}

export async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  await ensureFreshAuthSession();
  async function request() {
    const token = typeof window !== "undefined" ? sessionStorage.getItem(accessTokenKey) ?? undefined : undefined;
    return fetch(supabaseEndpoint(`/rest/v1/${path}`), {
      ...init,
      cache: "no-store",
      headers: { ...supabaseHeaders(token), ...(init.headers ?? {}) },
    });
  }
  let response = await request();
  if (response.status === 401 && await refreshAuthSession()) response = await request();
  const payload = (await response.json().catch(() => null)) as T | { message?: string; msg?: string } | null;
  if (!response.ok) throw new Error((payload as { message?: string; msg?: string } | null)?.message ?? (payload as { message?: string; msg?: string } | null)?.msg ?? "Supabase request failed.");
  return payload as T;
}

export async function signUp(email: string, password: string, name: string, role: "student" | "teacher") {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.");
  const response = await fetch(supabaseEndpoint("/auth/v1/signup"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email, password, data: { name, role } }),
  });
  const payload = await readJson<AuthResponse>(response);
  if (!response.ok) throw new Error(payload.error_description ?? payload.msg ?? "Unable to create account.");
  return payload;
}

export async function signIn(email: string, password: string) {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.");
  if (typeof window !== "undefined") {
    clearAuthSession();
  }

  const response = await fetch(supabaseEndpoint("/auth/v1/token?grant_type=password"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const payload = await readJson<AuthResponse>(response);
  if (!response.ok) throw new Error(payload.error_description ?? payload.msg ?? "Unable to log in.");
  return payload;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.");
  }
  const user = await getCurrentUser();
  if (!user?.email) throw new Error("Your session is missing. Please log in again.");
  const verification = await fetch(supabaseEndpoint("/auth/v1/token?grant_type=password"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email: user.email, password: currentPassword }),
    cache: "no-store",
  });
  const verified = await readJson<AuthResponse>(verification);
  if (!verification.ok || !verified.access_token) {
    throw new Error(verified.error_description ?? verified.msg ?? "Current password is incorrect.");
  }
  if (typeof window !== "undefined") {
    persistAuthSession(verified);
  }
  const token = typeof window !== "undefined" ? sessionStorage.getItem("school_access_token") : null;
  const response = await fetch(supabaseEndpoint("/auth/v1/user"), {
    method: "PUT",
    headers: supabaseHeaders(token ?? undefined),
    body: JSON.stringify({ password: newPassword }),
  });
  const payload = await response.json().catch(() => null) as { error_description?: string; msg?: string; message?: string } | null;
  if (!response.ok) throw new Error(payload?.error_description ?? payload?.msg ?? payload?.message ?? "Password could not be changed.");
}

/**
 * Verifies a Supabase access token and returns the user it belongs to.
 *
 * This is the **server-side** counterpart to `getCurrentUser`. Route handlers
 * must use this one: `getCurrentUser` reads from `sessionStorage`, so it
 * returns null on the server and would reject every request, including ones
 * carrying a perfectly valid session.
 *
 * The token is validated by Supabase rather than by decoding the JWT locally,
 * so an unsigned or tampered token is never trusted.
 */
export async function verifyAccessToken(token: string | null): Promise<{ id: string; email?: string } | null> {
  if (!token || !supabaseUrl) return null;
  const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
  if (!raw) return null;
  try {
    const response = await fetch(supabaseEndpoint("/auth/v1/user"), {
      headers: supabaseHeaders(raw),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; email?: string };
    return user?.id ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}

/**
 * Extracts the bearer token from a request's Authorization header.
 */
export function bearerTokenFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Returns the signed-in user, refreshing the access token first if it has
 * expired. Includes the raw `accessToken` so callers can forward it to a
 * server route.
 *
 * Client-only: returns null on the server.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (typeof window === "undefined") return null;
  await ensureFreshAuthSession();
  async function request() {
    const token = sessionStorage.getItem(accessTokenKey);
    if (!token) return null;
    return fetch(supabaseEndpoint("/auth/v1/user"), {
      headers: supabaseHeaders(token),
      cache: "no-store",
    });
  }
  let response = await request();
  if (response?.status === 401 && await refreshAuthSession()) response = await request();
  if (!response?.ok) return null;
  const user = (await response.json()) as { id: string; email?: string };
  // Re-read the token: a refresh above may have replaced it, and returning
  // the stale one would hand callers a value Supabase has already rejected.
  const accessToken = sessionStorage.getItem(accessTokenKey);
  if (!accessToken) return null;
  return { id: user.id, email: user.email, accessToken };
}
