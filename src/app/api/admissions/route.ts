const SOURCES = new Set(["website", "referral", "walk-in", "other"]);
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ message: "Admissions is not configured." }, { status: 500 });
  try {
    const body = await request.json() as { applicant_name?: string; source?: string }; const name = body.applicant_name?.trim(); const source = body.source ?? "website";
    if (!name || name.length < 2 || name.length > 160) return Response.json({ message: "Enter a valid applicant name." }, { status: 400 });
    if (!SOURCES.has(source)) return Response.json({ message: "Choose a valid source." }, { status: 400 });
    const response = await fetch(`${url}/rest/v1/AdmissionApplication`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ applicant_name: name, source, stage: "applied" }), cache: "no-store" });
    if (!response.ok) return Response.json({ message: "Application could not be saved." }, { status: 502 });
    return Response.json({ message: "Application received." }, { status: 201 });
  } catch { return Response.json({ message: "Invalid request." }, { status: 400 }); }
}
