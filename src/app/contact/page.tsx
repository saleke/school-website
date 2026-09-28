import { schoolContent } from "@/content/school";
import { PublicSiteNav } from "@/components/public-site-nav";
import { Card } from "@/components/ui";

export const revalidate = 3600;

export default function ContactPage() {
  return (
    <main className="min-h-screen px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <PublicSiteNav />

        <div className="mt-12 grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div className="animate-fade-in">
            <p className="eyebrow">Contact</p>
            <h1 className="font-display mt-4 text-5xl font-semibold leading-tight sm:text-6xl">
              Let&apos;s talk about school.
            </h1>
          </div>
          <Card className="p-7 sm:p-10 animate-scale-in">
            <div className="grid gap-7 sm:grid-cols-2">
              <div>
                <span className="eyebrow block">Admissions</span>
                <a
                  className="mt-2 block font-semibold text-accent-light underline-offset-4 hover:underline"
                  href={`mailto:${schoolContent.contact.admissionsEmail}`}
                >
                  {schoolContent.contact.admissionsEmail}
                </a>
              </div>
              <div>
                <span className="eyebrow block">Office hours</span>
                <span className="mt-2 block font-semibold">{schoolContent.contact.hours}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="eyebrow block">Address</span>
                <span className="mt-2 block font-semibold">{schoolContent.contact.address}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
