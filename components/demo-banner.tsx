"use client";

import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";

// Demo sandbox marker (Docs/plans/PARTNERS_DEMO_UNIVERSITY_PLAN.md §6) — shown
// on both portals so a prospect never mistakes the sandbox for the real thing.
function DemoBanner() {
  return (
    <div className="border-warning/30 bg-warning/10 shrink-0 border-b px-4 py-1.5 text-center text-xs text-gray-700">
      Demo environment: companies here are fictional and won&apos;t receive
      emails.
    </div>
  );
}

export function UniversityDemoBanner() {
  const { account } = useUniversityProfile();
  return account?.university.is_demo ? <DemoBanner /> : null;
}

export function CompanyDemoBanner() {
  const { company } = useCompanyProfile();
  return company?.is_demo ? <DemoBanner /> : null;
}
