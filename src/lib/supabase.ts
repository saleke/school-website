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

export type AuthResponse = { access_token?: string; user?: { id: string; email?: string }; error_description?: string; msg?: string };

export async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  const token = typeof window !== "undefined" ? sessionStorage.getItem("school_access_token") ?? undefined : undefined;
  const response = await fetch(supabaseEndpoint(`/rest/v1/${path}`), {
    ...init,
    cache: "no-store",
    headers: { ...supabaseHeaders(token), ...(init.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) throw new Error((payload as { message?: string } | null)?.message ?? "Supabase request failed.");
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
    sessionStorage.removeItem("school_access_token");
    sessionStorage.removeItem("school_user_id");
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
    sessionStorage.setItem("school_access_token", verified.access_token);
    if (verified.user?.id) sessionStorage.setItem("school_user_id", verified.user.id);
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

export async function getCurrentUser() {
  const token = typeof window !== "undefined" ? sessionStorage.getItem("school_access_token") : null;
  if (!token) return null;
  const response = await fetch(supabaseEndpoint("/auth/v1/user"), {
    headers: supabaseHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as { id: string; email?: string };
}
