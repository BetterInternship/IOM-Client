"use client";

import { Suspense } from "react";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import { CompanyProfileContent } from "./company-profile-content";

function CompanyProfilePageContent() {
  const { company, isLoading } = useCompanyProfile();
  if (isLoading || !company) return null;
  return <CompanyProfileContent />;
}

export default function CompanyProfilePage() {
  return (
    <Suspense>
      <CompanyProfilePageContent />
    </Suspense>
  );
}
