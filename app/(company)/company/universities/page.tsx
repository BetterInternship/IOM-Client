"use client";

import { useMemo } from "react";
import Link from "next/link";
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

export default function UniversityDirectoryPage() {
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: vLoading } =
    useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const status = verification?.status;
  const canRequestMoa = verified || status === "pending";
  const { openModal, closeModal } = useModal();

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

  if (!canRequestMoa) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          title="Request MOA"
          description="This is a list of universities you can request a MOA with."
        />
        <div className="border-warning/30 bg-warning/10 rounded-[0.33em] border p-4 text-sm text-gray-700">
          {status === "rejected"
            ? verification?.rejectionReason ||
              "Your company could not be verified. Please review your profile and documents."
            : status === "incomplete"
              ? "Complete your profile and upload all required documents so the platform team can verify your company."
              : status === "expired"
                ? "Your company verification has expired. Please re-upload your documents to request re-review."
                : "Your company is pending verification by the platform team. You can queue MOA requests once your profile is complete."}{" "}
          <Link href="/profile" className="text-primary underline">
            Go to your profile
          </Link>
          .
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-8 pb-12">
      <PageHeader
        title="Request MOA"
        description={
          verified
            ? "This is a list of universities you can request a MOA with."
            : "Your MOA requests will be queued and issued automatically after approval."
        }
      />

      {!verified && (
        <div className="border-primary/20 bg-primary/5 rounded-[0.33em] border p-4 text-sm text-gray-700">
          Your company is pending platform approval. You can still submit MOA
          requests now; they will stay queued until your company is approved.
        </div>
      )}

      <RequestableUniversitiesTable
        universities={requestableUniversities}
        isLoading={uniLoading}
        onRequest={openRequestDialog}
      />
    </PageContainer>
  );
}
