"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompanyRootPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/company/login"); }, [router]);
  return null;
}
