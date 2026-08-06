"use client";

import { Suspense } from "react";
import { CompanyProfileContent } from "../profile/company-profile-content";

export default function CompanyCompleteProfilePage() {
  return (
    <Suspense>
      <CompanyProfileContent mode="setup" />
    </Suspense>
  );
}
