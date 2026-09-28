import Link from "next/link";
import { PublicSiteNav } from "@/components/public-site-nav";
import { ImageCarousel } from "@/components/image-carousel";
import { RotatingHeadline } from "@/components/rotating-headline";
import { AnimatedCounter } from "@/components/animated-counter";
import { Badge, Button, Card } from "@/components/ui";

export const revalidate = 3600;

const features = [
  {
    title: "For Students",
    description: "Results, timetable, assignments, and profile in one focused view.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>
    ),
  },
  {
    title: "For Teachers",
    description: "A focused home for classes, attendance, and assessment.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
    ),
  },
  {
    title: "For the School",
    description: "The signal needed to make good decisions, fast.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg>
    ),
  },
];

const stats = [
  { label: "Students", value: 500, suffix: "+" },
  { label: "Teachers", value: 30, suffix: "+" },
  { label: "Classes", value: 24, suffix: "" },
  { label: "Subjects", value: 18, suffix: "" },
];

export default function Home() {
  return (
    <main className="min-h-screen px-5 pb-24 pt-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <PublicSiteNav />

        {/* Hero - carousel first, then text */}
        <section className="pt-4 lg:pt-6">
          <div className="animate-scale-in">
            <ImageCarousel />
          </div>

          <div className="mb-8 mt-8 max-w-3xl animate-fade-in">
            <p className="eyebrow">A record of school life</p>
            <RotatingHeadline />
            <p className="mt-7 max-w-2xl text-lg leading-8 text-text-secondary">
              A calm, low-data home for students, teachers, and the people who help a school move forward.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/admissions" className="glass-login inline-flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] px-5 font-semibold">
                Explore admissions <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/about" className="glass-control inline-flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] px-5 font-semibold">
                Learn about the school
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-16 border-t border-[var(--border)] py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="surface-glass rounded-[var(--radius-md)] p-5 text-center">
                <p className="text-3xl font-bold">
                  <AnimatedCounter value={stat.value} />
                  {stat.suffix}
                </p>
                <p className="mt-1 text-sm text-text-secondary">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-[var(--border)] py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Built for the day-to-day</p>
              <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">A clear start for every learner.</h2>
              <p className="mt-2 max-w-2xl text-text-secondary">Find your place, keep track of your progress, and stay close to the school community.</p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 stagger-children">
            {features.map((f) => (
              <Card key={f.title} className="p-5 animate-slide-up">
                <span className="grid size-10 place-items-center rounded-[var(--radius-sm)] bg-surface-2 text-accent-light" aria-hidden="true">
                  {f.icon}
                </span>
                <h3 className="font-display mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{f.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Quick links */}
        <section className="border-t border-[var(--border)] py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">School, made easier to navigate.</h2>
              <p className="mt-2 max-w-2xl text-text-secondary">Everything has a place, and the important things stay close.</p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 stagger-children">
            <Link href="/about" className="glass-control group rounded-[var(--radius-md)] p-5 animate-slide-up">
              <p className="text-sm font-semibold">About the school</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Meet the values and people behind the work.</p>
              <span className="mt-6 block text-sm font-semibold text-accent-light">Read more →</span>
            </Link>
            <Link href="/news" className="glass-control group rounded-[var(--radius-md)] p-5 animate-slide-up">
              <p className="text-sm font-semibold">Notes from campus</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Read the latest updates and school stories.</p>
              <span className="mt-6 block text-sm font-semibold text-accent-light">Read news →</span>
            </Link>
            <Link href="/login" className="glass-control group rounded-[var(--radius-md)] p-5 animate-slide-up">
              <p className="text-sm font-semibold">Open the portal</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Sign in to your student, teacher, or admin space.</p>
              <span className="mt-6 block text-sm font-semibold text-accent-light">Log in →</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
