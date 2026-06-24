"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The dashboard hub was replaced by the grouped top-bar navigation; the
// Partners page is now the landing page.
export default function UniversityDashboardRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/partners");
  }, [router]);
  return null;
}
