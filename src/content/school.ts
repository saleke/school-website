export const schoolContent = {
  identity: { name: "School Platform", shortName: "School Platform", tagline: "Learning, community, and growth—kept together." },
  about: { eyebrow: "About us", title: "A school record built around people.", body: "We help students learn with confidence, teachers work with clarity, and school communities keep the important moments together.", history: "Our school story will be added here when the official history is ready." },
  contact: { admissionsEmail: "admissions@school.example", phone: "+000 000 000 000", address: "School address to be confirmed", hours: "Monday–Friday · 8:00–16:00" },
  images: { hero: "/images/school/hero-placeholder.svg", learning: "/images/school/learning-placeholder.svg", community: "/images/school/community-placeholder.svg", campus: "/images/school/campus-placeholder.svg" },
} as const;

export type SchoolContent = typeof schoolContent;
