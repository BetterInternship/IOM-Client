"use client";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { PageContainer, PageHeader } from "@/components/page-header";
import { LegacyCompaniesPanel } from "@/components/legacy-companies/legacy-companies-panel";

export default function LegacyPartnersPage() {
  const { account, isLoading: profileLoading } = useUniversityProfile();

  if (profileLoading || !account) return null;

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="Legacy Partners"
          description="Manage legacy MOA partnerships recorded outside IOM."
        />
        <LegacyCompaniesPanel
          listEndpoint="/api/university/legacy-companies"
          uploadEndpoint="/api/university/legacy-companies"
          bulkCsvEndpoint="/api/university/legacy-companies/bulk/csv"
          bulkZipEndpoint="/api/university/legacy-companies/bulk/zip"
          detailEndpoint={(id) => `/api/university/legacy-companies/${id}`}
          addDocumentsEndpoint={(id) => `/api/university/legacy-companies/${id}/documents`}
          canUpload={true}
          queryKeyPrefix="university-legacy-companies"
        />
      </div>
    </PageContainer>
  );
}
