"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UniversityRootPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/university/login"); }, [router]);
  return null;
}
