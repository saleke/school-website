import type { Metadata } from "next";
import { Lora, Source_Sans_3 } from "next/font/google";
import { OfflineStatus } from "@/components/offline-status";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "School Platform",
  description: "A low-data school community and learning platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${lora.variable}`}
    >
      <body><ServiceWorkerRegistration /><OfflineStatus />{children}</body>
    </html>
  );
}
