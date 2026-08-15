"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import {
  useCompanyControllerListUniversities,
  type CompanyUniversityDirectoryItemDto,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestDialog } from "@/components/moa-request-dialog";
import { useModal } from "@/app/providers/modal-provider";
import { RequestableUniversitiesTable } from "@/components/company/requestable-universities-table";
import { useIomModalRegistry } from "@/components/modal-registry";
import { CompanyProfileStatusNotice } from "@/components/company/company-profile-status-notice";

function UniversityDirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: vLoading } =
    useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const status = verification?.status;
  const canRequestMoa = !!status;
  const { openModal, closeModal } = useModal();
  const { approvalPending } = useIomModalRegistry();
  const showApprovalPending = searchParams.get("approval_pending") === "1";

  useEffect(() => {
    if (!showApprovalPending) return;
    approvalPending.open({
      onQueueMoa: () => router.replace("/company/universities"),
      onClose: () => router.replace("/company/universities"),
    });
  }, [router, showApprovalPending]);

  const { data, isLoading: uniLoading } = useCompanyControllerListUniversities({
    query: { enabled: !!company && canRequestMoa },
  });

  const requestableUniversities = useMemo(
    () =>
      (data?.universities ?? []).filter((university) => university.requestable),
    [data?.universities],
  );

  const openRequestDialog = (university: CompanyUniversityDirectoryItemDto) => {
    openModal(
      "request-moa",
      <RequestDialog
        universityId={university.id}
        verified={verified}
        onClose={() => closeModal("request-moa")}
      />,
      {
        title: (
          <h2 className="text-2xl leading-snug font-semibold tracking-tight">
            Requesting a MOA with{" "}
            <span className="text-primary">{university.registered_name}</span>
          </h2>
        ),
        panelClassName: "sm:!max-w-none",
        headerClassName: "request-moa-header",
        exitAnimation: "fade",
      },
    );
  };

  if (isLoading || vLoading) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
      </PageContainer>
    );
  }
  if (!company) return null;

  return (
    <PageContainer className="space-y-8 pb-12">
      {status && status !== "verified" && (
        <CompanyProfileStatusNotice
          status={status}
          rejectionReason={verification?.rejectionReason}
          compactAttention
        />
      )}

      <PageHeader
        title="Request MOA"
        description={
          verified
            ? "This is a list of universities you can request a MOA with."
            : "Your MOA requests will be queued and issued automatically after approval."
        }
      />

      <RequestableUniversitiesTable
        universities={requestableUniversities}
        isLoading={uniLoading}
        onRequest={openRequestDialog}
      />
    </PageContainer>
  );
}

export default function UniversityDirectoryPage() {
  return (
    <Suspense>
      <UniversityDirectoryContent />
    </Suspense>
  );
}
