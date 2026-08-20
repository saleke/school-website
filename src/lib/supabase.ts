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

export type AuthResponse = { access_token?: string; user?: { id: string; email?: string }; error_description?: string; msg?: string };

export async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("school_access_token") ?? undefined : undefined;
  const response = await fetch(supabaseEndpoint(`/rest/v1/${path}`), {
    ...init,
    headers: { ...supabaseHeaders(token), ...(init.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) throw new Error((payload as { message?: string } | null)?.message ?? "Supabase request failed.");
  return payload as T;
}

export async function signUp(email: string, password: string, name: string, role: "student" | "teacher") {
  const response = await fetch(supabaseEndpoint("/auth/v1/signup"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email, password, data: { name, role } }),
  });
  const payload = (await response.json()) as AuthResponse;
  if (!response.ok) throw new Error(payload.error_description ?? payload.msg ?? "Unable to create account.");
  return payload;
}

export async function signIn(email: string, password: string) {
  const response = await fetch(supabaseEndpoint("/auth/v1/token?grant_type=password"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json()) as AuthResponse;
  if (!response.ok) throw new Error(payload.error_description ?? payload.msg ?? "Unable to log in.");
  return payload;
}
