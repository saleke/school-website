import { bearerTokenFrom, verifyAccessToken } from "@/lib/supabase";

/**
 * Creates an additional administrator account.
 *
 * This is the only endpoint in the app that uses the service-role secret, so
 * it is also the only place where authorization is enforced in application
 * code rather than by Postgres RLS. That makes the checks below
 * load-bearing: a mistake here bypasses row-level security entirely.
 *
 * Order of operations, and why:
 *  1. Verify the caller holds a real, unexp Supabase session.
 *  2. Verify that session belongs to an admin. The lookup is done with the
 *     caller's own token so RLS applies, rather than with the service key —
 *     the route must not trust a client-supplied role.
 *  3. Only then touch the service key, to create the auth user and promote
 *     the profile.
 */

type AuthUser = { id: string; email?: string; msg?: string; message?: string; error_description?: string };
type Profile = { role: "student" | "teacher" | "admin" | "alumni" };

const MIN_PASSWORD_LENGTH = 8;

// Deliberately permissive: the goal is to catch typos, not to re-implement
// server-side password policy. Supabase enforces the real requirements.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(message: string, status: number) {
  return Response.json({ message }, { status });
}

function errorMessage(payload: AuthUser | null, fallback: string) {
  return payload?.message ?? payload?.msg ?? payload?.error_description ?? fallback;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  // 1. Authenticate before anything else. Verifying against Supabase rather
  //    than decoding the JWT locally means an unsigned or tampered token is
  //    never trusted, and an unauthenticated caller learns nothing about the
  //    server's configuration.
  const accessToken = bearerTokenFrom(request);
  const actor = await verifyAccessToken(accessToken);
  if (!actor?.id) return json("Authentication required.", 401);

  if (!url || !publishableKey || !secretKey) return json("Supabase is not configured.", 500);

  // 2. The session must belong to an admin. Uses the caller's own token, so
  //    the `user_read_self_or_admin` RLS policy governs the read.
  const authHeaders = {
    apikey: publishableKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  let profiles: Profile[] = [];
  try {
    const profileResponse = await fetch(
      `${url}/rest/v1/User?id=eq.${encodeURIComponent(actor.id)}&select=role`,
      { headers: authHeaders, cache: "no-store" },
    );
    if (profileResponse.ok) profiles = (await profileResponse.json()) as Profile[];
  } catch {
    // A network failure must fail closed, not skip the check.
    return json("Could not verify your permissions. Try again.", 503);
  }

  if (profiles[0]?.role !== "admin") return json("Only an admin can create another admin.", 403);

  // 3. Validate input before spending a privileged call.
  let body: { name?: string; email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json("Invalid request body.", 400);
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || name.length > 120) return json("A name is required.", 400);
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return json("A valid email address is required.", 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }

  // From here on the service key is used. It bypasses RLS by design.
  const serviceHeaders = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  let created: AuthUser;
  try {
    const createResponse = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: "student" },
      }),
    });
    created = (await createResponse.json().catch(() => null)) as AuthUser;
    if (!createResponse.ok || !created?.id) {
      return json(errorMessage(created, "Admin account could not be created."), 400);
    }
  } catch {
    return json("Supabase could not be reached. Try again.", 502);
  }

  // Promote the profile to admin. The signup trigger seeds a Student row for
  // every new auth user; since this is an admin, that row is removed.
  const promoteResponse = await fetch(
    `${url}/rest/v1/User?id=eq.${encodeURIComponent(created.id)}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ role: "admin", teacher_approval_status: null, is_librarian: false }),
    },
  );
  if (!promoteResponse.ok) {
    return json("Auth account created, but promotion failed. Review it in Supabase.", 500);
  }

  await fetch(`${url}/rest/v1/Student?user_id=eq.${encodeURIComponent(created.id)}`, {
    method: "DELETE",
    headers: { ...serviceHeaders, Prefer: "return=minimal" },
  });

  return Response.json({ id: created.id, email }, { status: 201 });
}
