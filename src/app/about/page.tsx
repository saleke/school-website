import { schoolContent } from "@/content/school";
import { PublicSiteNav } from "@/components/public-site-nav";
import { Card, SectionHeading } from "@/components/ui";

export const revalidate = 3600;

const values = [
  { title: "Clarity", description: "Every screen has a clear purpose and a obvious next step." },
  { title: "Calm", description: "Low-data, focused interfaces that respect attention." },
  { title: "Community", description: "Tools that bring students, teachers, and staff together." },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <PublicSiteNav />

        <div className="mt-12 grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div className="animate-fade-in">
            <p className="eyebrow">{schoolContent.about.eyebrow}</p>
            <h1 className="font-display mt-4 text-5xl font-semibold leading-tight sm:text-6xl">
              {schoolContent.about.title}
            </h1>
          </div>
          <Card className="p-7 sm:p-10 animate-scale-in">
            <p className="text-lg leading-8 text-text-secondary">{schoolContent.about.body}</p>
            <p className="mt-6 leading-7 text-text-secondary">{schoolContent.about.history}</p>
          </Card>
        </div>

        <section className="mt-16 border-t border-[var(--border)] pt-10">
          <SectionHeading
            eyebrow="The school experience"
            title="A place to learn with intention."
            description="The platform supports the work already happening in classrooms, clubs, and conversations."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3 stagger-children">
            {values.map((value) => (
              <Card key={value.title} className="p-5 animate-slide-up">
                <h3 className="font-display text-lg font-semibold">{value.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{value.description}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
