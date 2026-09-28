"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Intercepts the browser Back button inside the portal.
 *
 * The original version re-pushed a history entry *before* prompting, which
 * meant a declined prompt left an extra entry on the stack and the user had
 * to press Back repeatedly to escape. It also relied on `window.confirm`,
 * which is unstyleable and reads as a browser error.
 *
 * Now: Back always stays on the portal without side effects, and signing out
 * is an explicit action reached through the (already confirm-gated) Sign out
 * button rather than something the user can trigger by accident while
 * navigating.
 */
export function PortalNavigationGuard() {
  const router = useRouter();

  useEffect(() => {
    // Seed one entry so Back targets this page rather than the public site.
    window.history.pushState({ portalEntry: true }, "", window.location.href);

    function handleBack() {
      // Trap: re-arm without ever leaving the portal.
      window.history.pushState({ portalEntry: true }, "", window.location.href);
      router.replace("/portal");
    }

    window.addEventListener("popstate", handleBack);
    // Intentionally no session clearing here. Unmounting this guard must not
    // sign anyone out; signing out is an explicit, separately confirmed action.
    return () => window.removeEventListener("popstate", handleBack);
  }, [router]);

  return null;
}
