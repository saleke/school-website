"use client";

import { useEffect } from "react";
import { clearAuthSession } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function PortalNavigationGuard() {
  const router = useRouter();

  useEffect(() => {
    window.history.pushState({ portalEntry: true }, "", window.location.href);

    function handleBack() {
      window.history.pushState({ portalEntry: true }, "", window.location.href);
      if (!window.confirm("Leave the school portal? Your session will remain signed in.")) return;

      clearAuthSession();
      router.replace("/");
    }

    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [router]);

  return null;
}
