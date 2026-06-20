"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Root redirects to company login as default entry
export default function RootPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/company/login"); }, [router]);
  return null;
}
