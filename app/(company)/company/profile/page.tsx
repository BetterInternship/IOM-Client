"use client";

import { Suspense } from "react";
import { CompanyProfileContent } from "./company-profile-content";

export default function CompanyProfilePage() {
  return (
    <Suspense>
      <CompanyProfileContent mode="profile" />
    </Suspense>
  );
}
