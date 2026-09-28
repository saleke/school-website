"use client";

import { useEffect, useRef, useState } from "react";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import { supabaseRequest } from "@/lib/supabase";
import { useLiveQuery } from "@/lib/realtime";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { Badge, Button } from "@/components/ui";

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

/** Single source of truth for the query — previously copy-pasted three times. */
const ANNOUNCEMENTS_PATH =
  "Announcement?select=id,title,body,scope,target_id,author_id,published_at,User(name)&order=published_at.desc&limit=20";

const POLL_INTERVAL = 15_000;

export function AnnouncementFeed({ role }: { role: string }) {
  const { toast } = useToast();
  const { data, status, refresh } = useLiveQuery<Announcement[]>({
    path: ANNOUNCEMENTS_PATH,
    intervalMs: POLL_INTERVAL,
  });

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const mounted = useIsHydrated();

  // Announce newly arrived items exactly once each. Diffing in an effect
  // (rather than inside a setState updater) keeps the toast out of the
  // render/reducer path, where StrictMode would fire it twice.
  const seenIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const seen = seenIdsRef.current;
    if (seen === null) {
      // First payload: adopt silently, these are not "new".
      seenIdsRef.current = new Set(data.map((item) => item.id));
      return;
    }
    const fresh = data.filter((item) => !seen.has(item.id));
    if (fresh.length > 0) {
      fresh.forEach((item) => seen.add(item.id));
      toast(
        fresh.length === 1
          ? `New announcement: ${fresh[0].title}`
          : `${fresh.length} new announcements`,
        "info",
      );
    }
  }, [data, toast]);

  const canPost = role === "teacher" || role === "admin";
  const canPublish = title.trim().length > 0 && body.trim().length > 0;

  async function publish() {
    if (!canPublish || saving) return;
    setSaving(true);
    try {
      await supabaseRequest("Announcement", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          // School-wide only. Class/grade targeting needs the author's class
          // roster wired through; shipping the control without it would have
          // posted "My class" notices school-wide.
          scope: "school",
          target_id: null,
        }),
      });
      setTitle("");
      setBody("");
      setShowForm(false);
      refresh();
      toast("Announcement published", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not publish announcement", "error");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" && !data) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading announcements">
        <div className="h-20 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-20 animate-pulse rounded-lg bg-surface-2" />
      </div>
    );
  }

  if (status === "error" && !data) {
    return (
      <EmptyState
        icon="megaphone"
        title="Announcements unavailable"
        description="We could not reach the school noticeboard. Check your connection and try again."
        action={
          <Button size="sm" variant="secondary" onClick={refresh}>
            Retry
          </Button>
        }
      />
    );
  }

  const announcements = data ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-semibold">Announcements</h3>
        <div className="flex items-center gap-2">
          {status === "live" && (
            <span className="hidden items-center gap-1.5 text-[11px] font-semibold text-text-secondary sm:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
              Live
            </span>
          )}
          {canPost && (
            <Button variant="secondary" size="sm" onClick={() => setShowForm((open) => !open)}>
              {showForm ? "Cancel" : "New announcement"}
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <form
          className="space-y-3 rounded-xl border border-[var(--border)] bg-surface-1 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void publish();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="announcement-title" className="text-xs font-semibold text-text-secondary">
              Title
            </label>
            <input
              id="announcement-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Sports day moved to Friday"
              maxLength={120}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="announcement-body" className="text-xs font-semibold text-text-secondary">
              Message
            </label>
            <textarea
              id="announcement-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your announcement…"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-text-secondary">Visible to the whole school.</p>
            <Button type="submit" size="sm" disabled={saving || !canPublish}>
              {saving ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </form>
      )}

      {announcements.length === 0 ? (
        <EmptyState
          icon="megaphone"
          title="No announcements yet"
          description="School notices will appear here as soon as they are published."
        />
      ) : (
        <ul className="space-y-3">
          {announcements.map((announcement) => (
            <li
              key={announcement.id}
              className="rounded-xl border border-[var(--border)] bg-surface-1 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-semibold">{announcement.title}</h4>
                <Badge tone={announcement.scope === "school" ? "accent" : "neutral"}>
                  {announcement.scope}
                </Badge>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-text-secondary">{announcement.body}</p>
              <p className="mt-2.5 text-xs text-text-secondary">
                {announcement.User?.name ?? "Staff"} ·{" "}
                {/* Date rendering is client-only to avoid a hydration mismatch. */}
                {mounted
                  ? new Date(announcement.published_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
