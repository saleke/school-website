import Link from "next/link";
import { Card } from "@/components/ui";
import { schoolContent } from "@/content/school";
export const revalidate = 3600;
export default function AboutPage() { return <main className="paper-grid min-h-screen px-5 py-8 sm:px-8 sm:py-12"><div className="mx-auto max-w-4xl"><Link href="/" className="text-sm font-semibold text-text-secondary">← {schoolContent.identity.name}</Link><Card className="mt-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">{schoolContent.about.eyebrow}</p><h1 className="font-display mt-3 text-4xl font-semibold sm:text-6xl">{schoolContent.about.title}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-text-secondary">{schoolContent.about.body}</p><p className="mt-5 max-w-2xl text-text-secondary">{schoolContent.about.history}</p></Card></div></main>; }
