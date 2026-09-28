import { supabaseRequest } from "@/lib/supabase";

const SOURCES = new Set(["website", "referral", "walk-in", "other"]);

// Chosen to shed obvious bot traffic from the public form while staying far
// enough below real-world rates that a parent filling this in during an
// admissions drive is never blocked.
const RATE_LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * In-memory sliding window, keyed by client IP.
 *
 * Intentionally per-instance and best-effort: a school deployment runs a
 * small number of nodes, and the real goal is to blunt casual abuse rather
 * than to enforce a hard limit. A shared store (Redis/Postgres) would be the
 * upgrade if this ever fronts a public site at scale.
 */
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ message: "Admissions is not configured." }, { status: 500 });

  if (rateLimited(clientIp(request))) {
    return Response.json(
      { message: "Too many submissions. Please try again shortly." },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  try {
    const body = (await request.json()) as { applicant_name?: string; source?: string };
    const name = body.applicant_name?.trim();
    const source = body.source ?? "website";
    if (!name || name.length < 2 || name.length > 160) {
      return Response.json({ message: "Enter a valid applicant name." }, { status: 400 });
    }
    if (!SOURCES.has(source)) {
      return Response.json({ message: "Choose a valid source." }, { status: 400 });
    }

    // Uses the anon role, so the insert is subject to RLS rather than being
    // an unscoped privileged write.
    await supabaseRequest("AdmissionApplication", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ applicant_name: name, source, stage: "applied" }),
    });

    return Response.json({ message: "Application received." }, { status: 201 });
  } catch {
    return Response.json({ message: "Application could not be saved." }, { status: 502 });
  }
}
