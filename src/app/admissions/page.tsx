"use client";

import { FormEvent, useState } from "react";
import { PublicSiteNav } from "@/components/public-site-nav";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/toast";

export default function AdmissionsPage() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [source, setSource] = useState("website");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicant_name: name, source }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Application could not be submitted.");
      setName("");
      toast("Application submitted successfully", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Application could not be submitted.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <PublicSiteNav />

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_.9fr]">
          <header className="max-w-xl animate-fade-in">
            <p className="eyebrow">Admissions</p>
            <h1 className="font-display mt-4 text-5xl font-semibold leading-tight sm:text-6xl">
              Begin the next chapter.
            </h1>
            <p className="mt-6 text-lg leading-8 text-text-secondary">
              Tell us who is applying and our admissions team will follow up with the next step.
            </p>
            <div className="mt-10 border-t border-[var(--border)] pt-6">
              <p className="text-sm font-semibold">What happens next?</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                We review your application, contact you, and share the right next step for your family.
              </p>
            </div>
          </header>

          <Card className="p-7 sm:p-9 animate-scale-in">
            <form onSubmit={submit} className="space-y-5">
              <label className="block text-sm font-semibold">
                Applicant name
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-surface-0 px-3 outline-none focus:border-[var(--accent-light)]"
                />
              </label>
              <label className="block text-sm font-semibold">
                How did you hear about us?
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-surface-0 px-3 outline-none focus:border-[var(--accent-light)]"
                >
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="walk-in">Walk-in</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <Button type="submit" disabled={busy} className="w-full" size="lg">
                {busy ? "Sending…" : "Submit application"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
