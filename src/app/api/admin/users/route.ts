type AuthUser = { id: string; email?: string };
type Profile = { role: "student" | "teacher" | "admin" | "alumni" };

function headers(apiKey: string, authorization: string) {
  return { apikey: apiKey, Authorization: authorization, "Content-Type": "application/json" };
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !publishableKey || !secretKey) return Response.json({ message: "Supabase is not configured." }, { status: 500 });
  if (!authorization?.startsWith("Bearer ")) return Response.json({ message: "Authentication required." }, { status: 401 });
  const authResponse = await fetch(`${url}/auth/v1/user`, { headers: headers(publishableKey, authorization), cache: "no-store" });
  if (!authResponse.ok) return Response.json({ message: "Invalid session." }, { status: 401 });
  const actor = await authResponse.json() as AuthUser;
  const profileResponse = await fetch(`${url}/rest/v1/User?id=eq.${encodeURIComponent(actor.id)}&select=role`, { headers: headers(publishableKey, authorization), cache: "no-store" });
  const profiles = profileResponse.ok ? await profileResponse.json() as Profile[] : [];
  if (profiles[0]?.role !== "admin") return Response.json({ message: "Only an admin can create another admin." }, { status: 403 });
  const body = await request.json() as { name?: string; email?: string; password?: string };
  const name = body.name?.trim(); const email = body.email?.trim().toLowerCase(); const password = body.password ?? "";
  if (!name || !email || password.length < 8) return Response.json({ message: "Name, email, and an 8-character password are required." }, { status: 400 });
  const serviceAuthorization = `Bearer ${secretKey}`;
  const createResponse = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: headers(secretKey, serviceAuthorization), body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name, role: "student" } }) });
  const created = await createResponse.json() as AuthUser & { msg?: string; message?: string };
  if (!createResponse.ok || !created.id) return Response.json({ message: created.message ?? created.msg ?? "Admin account could not be created." }, { status: createResponse.status });
  const promoteResponse = await fetch(`${url}/rest/v1/User?id=eq.${encodeURIComponent(created.id)}`, { method: "PATCH", headers: { ...headers(secretKey, serviceAuthorization), Prefer: "return=minimal" }, body: JSON.stringify({ role: "admin", teacher_approval_status: null, is_librarian: false }) });
  if (!promoteResponse.ok) return Response.json({ message: "Auth account created, but promotion failed. Review it in Supabase." }, { status: 500 });
  await fetch(`${url}/rest/v1/Student?user_id=eq.${encodeURIComponent(created.id)}`, { method: "DELETE", headers: { ...headers(secretKey, serviceAuthorization), Prefer: "return=minimal" } });
  return Response.json({ id: created.id, email }, { status: 201 });
}
