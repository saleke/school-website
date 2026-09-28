"use client";

import { useState } from "react";
import { supabaseRequest } from "@/lib/supabase";
import { useToast } from "@/components/toast";

type Subject = { id: string; name: string; class_id: string };
type ClassOption = { id: string; class_id: string; code: string };

export function AssignmentForm({
  subjects,
  classOptions,
  teacherId,
  onCreated,
}: {
  subjects: Subject[];
  classOptions: ClassOption[];
  teacherId: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classOptionId, setClassOptionId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [saving, setSaving] = useState(false);

  const selectedClassOption = classOptions.find((o) => o.id === classOptionId);
  const filteredSubjects = selectedClassOption
    ? subjects.filter((s) => s.class_id === selectedClassOption.class_id)
    : subjects;

  async function submit() {
    if (!title.trim() || !subjectId || !classOptionId || !dueDate) {
      toast("Please fill in all required fields", "error");
      return;
    }
    setSaving(true);
    try {
      await supabaseRequest("Assignment", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          subject_id: subjectId,
          class_id: selectedClassOption!.class_id,
          class_option_id: classOptionId,
          teacher_id: teacherId,
          due_date: new Date(dueDate).toISOString(),
          max_score: Number(maxScore),
        }),
      });
      toast("Assignment created", "success");
      setTitle("");
      setDescription("");
      setSubjectId("");
      setClassOptionId("");
      setDueDate("");
      setMaxScore("100");
      onCreated();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not create assignment", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-surface-1 p-5">
      <h3 className="font-display text-lg font-semibold">New assignment</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment title"
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm"
          />
        </label>
        <label className="text-sm font-semibold">
          Section
          <select
            value={classOptionId}
            onChange={(e) => { setClassOptionId(e.target.value); setSubjectId(""); }}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm"
          >
            <option value="">Select section</option>
            {classOptions.map((o) => (
              <option key={o.id} value={o.id}>Section {o.code}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-semibold">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the assignment..."
          rows={3}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Subject
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm"
          >
            <option value="">Select subject</option>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Due date
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm"
          />
        </label>
        <label className="text-sm font-semibold">
          Max score
          <input
            type="number"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            min={1}
            max={1000}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-surface-0 px-3 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={saving || !title.trim() || !subjectId || !classOptionId || !dueDate}
        className="min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-[var(--accent-contrast)] disabled:opacity-40"
      >
        {saving ? "Creating..." : "Create assignment"}
      </button>
    </div>
  );
}
