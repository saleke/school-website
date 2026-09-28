"use client";

import { useEffect, useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";

type Announcement = {
  id: string;
  title: string;
  body: string;
  scope: "school" | "grade" | "class";
  target_id: string | null;
  author_id: string;
  published_at: string;
  User?: { name: string } | null;
};

export function AnnouncementFeed({ userId, role }: { userId: string; role: string }) {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"school" | "class">("school");
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await supabaseRequest<Announcement[]>(
          "Announcement?select=id,title,body,scope,target_id,author_id,published_at,User(name)&order=published_at.desc&limit=20",
        );
        if (!cancelled) setAnnouncements(rows ?? []);
      } catch (error) {
        if (!cancelled) toast(error instanceof Error ? error.message : "Could not load announcements", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  async function publish() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await supabaseRequest("Announcement", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), scope, target_id: targetId || null }),
      });
      toast("Announcement published", "success");
      setTitle("");
      setBody("");
      setShowForm(false);
      const rows = await supabaseRequest<Announcement[]>(
        "Announcement?select=id,title,body,scope,target_id,author_id,published_at,User(name)&order=published_at.desc&limit=20",
      );
      setAnnouncements(rows ?? []);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not publish announcement", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-20 rounded-lg bg-surface-2" /><div className="h-20 rounded-lg bg-surface-2" /></div>;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">Announcements</h3>
        {(role === "teacher" || role === "admin") && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-surface-2"
          >
            {showForm ? "Cancel" : "New announcement"}
          </button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-surface-1 p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement..."
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "school" | "class")}
              className="min-h-10 rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm"
            >
              <option value="school">School-wide</option>
              <option value="class">My class</option>
            </select>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={saving || !title.trim() || !body.trim()}
              className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-[var(--accent-contrast)] disabled:opacity-40"
            >
              {saving ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      )}

      {!announcements.length ? (
        <EmptyState icon="Announcements" title="No announcements yet" description="School announcements will appear here." />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <article key={a.id} className="rounded-xl border border-[var(--border)] bg-surface-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold">{a.title}</h4>
                  <p className="mt-1 text-sm text-text-secondary">{a.body}</p>
                </div>
                <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  {a.scope}
                </span>
              </div>
              <p className="mt-2 text-xs text-text-secondary">
                {a.User?.name ?? "Staff"} · {mounted ? new Date(a.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
