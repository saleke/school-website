import { PortalNavigationGuard } from "@/components/portal-navigation-guard";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PortalNavigationGuard />
      {children}
    </>
  );
}
