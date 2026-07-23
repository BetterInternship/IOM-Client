"use client";

import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/page-header";
import { LegacyCompanyImportWizard } from "@/components/legacy-companies/legacy-company-import-wizard";

export default function LegacyCompanyImportWizardPage() {
  const router = useRouter();

  return (
    <PageContainer className="max-w-none py-0">
      <LegacyCompanyImportWizard
        onBack={() => router.push("/university/partners")}
      />
    </PageContainer>
  );
}
