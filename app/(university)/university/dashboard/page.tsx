"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The dashboard hub was replaced by the grouped top-bar navigation; the
// review queue (under Partners) is now the landing page.
export default function UniversityDashboardRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/university/partners");
  }, [router]);
  return null;
}
