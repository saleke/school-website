"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PortalNavigationGuard() {
  const router = useRouter();

  useEffect(() => {
    window.history.pushState({ portalEntry: true }, "", window.location.href);

    function handleBack() {
      window.history.pushState({ portalEntry: true }, "", window.location.href);
      if (!window.confirm("Leave the school portal? Your session will remain signed in.")) return;

      sessionStorage.removeItem("school_access_token");
      sessionStorage.removeItem("school_user_id");
      router.replace("/");
    }

    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [router]);

  return null;
}
