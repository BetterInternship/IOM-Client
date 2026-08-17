"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { CompanyProfileContent } from "./company-profile-content";

function CompanyProfilePageContent() {
  const router = useRouter();
  const { company, isLoading: companyLoading } = useCompanyProfile();
  const { data: verification, isLoading: verificationLoading } =
    useCompanyVerification(!!company);
  const isIncomplete = verification?.status === "incomplete";

  useEffect(() => {
    if (isIncomplete) router.replace("/complete-profile");
  }, [isIncomplete, router]);

  if (companyLoading || verificationLoading || !company || isIncomplete)
    return null;

  return <CompanyProfileContent mode="profile" />;
}

export default function CompanyProfilePage() {
  return (
    <Suspense>
      <CompanyProfilePageContent />
    </Suspense>
  );
}
