"use client";
import { useParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { LegacyCompaniesPanel } from "@/components/legacy-companies/legacy-companies-panel";

export default function AdminUniversityLegacyPartnersPage() {
  const { universityId } = useParams<{ universityId: string }>();

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="Legacy Partners"
          description="Manage legacy MOA partnerships recorded outside IOM for this university."
        />
        <LegacyCompaniesPanel
          listEndpoint={`/api/admin/universities/${universityId}/legacy-companies`}
          uploadEndpoint={`/api/admin/universities/${universityId}/legacy-companies`}
          bulkCsvEndpoint={`/api/admin/universities/${universityId}/legacy-companies/bulk/csv`}
          bulkZipEndpoint={`/api/admin/universities/${universityId}/legacy-companies/bulk/zip`}
          detailEndpoint={(id) => `/api/admin/universities/${universityId}/legacy-companies/${id}`}
          addDocumentsEndpoint={(id) => `/api/admin/universities/${universityId}/legacy-companies/${id}/documents`}
          canUpload={true}
          queryKeyPrefix="admin-university-legacy-companies"
          showDetailBackButton={false}
        />
      </div>
    </PageContainer>
  );
}
