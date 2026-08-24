"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Folded into the Partners page (plan §7.1, §9.6) — the requestable table
 * that lived here now renders alongside active partners on /company/dashboard.
 * Kept as a redirect for one release before the folder is deleted outright.
 */
export default function CompanyUniversitiesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/company/dashboard");
  }, [router]);

  return null;
}
