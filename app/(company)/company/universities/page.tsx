"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestDialog } from "@/components/moa-request-dialog";
import { useModal } from "@/app/providers/modal-provider";
import { RequestableUniversitiesTable } from "@/components/company/requestable-universities-table";
import { useIomModalRegistry } from "@/components/modal-registry";
import { StatusNotice } from "@/components/ui/status-notice";
import { AlertCircle, ClipboardList, Clock } from "lucide-react";

function UniversityDirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: vLoading } =
    useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const status = verification?.status;
  const canRequestMoa = !!status;
  const profileHref =
    status === "incomplete" ? "/complete-profile" : "/profile";
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
      {!verified && status === "incomplete" && (
        <StatusNotice
          icon={ClipboardList}
          title="Finish setting up your account"
          description="You can sign and queue MOA requests now, but they won't be issued until you complete your profile and the platform team approves your company."
          variant="warning"
          role="alert"
          tabIndex={0}
          className="cursor-pointer"
          onClick={() => router.push("/complete-profile")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push("/complete-profile");
            }
          }}
          actionClassName="sm:flex sm:w-52 sm:justify-end"
          action={
            <Button asChild variant="outline" scheme="primary" expandIcon>
              <Link
                href="/complete-profile"
                onClick={(event) => event.stopPropagation()}
              >
                <ClipboardList aria-hidden="true" />
                <span className="button-label">Complete profile</span>
              </Link>
            </Button>
          }
        />
      )}

      {!verified && status === "pending" && (
        <StatusNotice
          icon={Clock}
          title="Pending approval"
          description="You can submit MOA requests now. They'll be queued and issued automatically once the platform team verifies your company."
          variant="warning"
          role="alert"
          tabIndex={0}
          className="cursor-pointer"
          onClick={() => router.push("/profile")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push("/profile");
            }
          }}
        />
      )}

      {!verified &&
        status &&
        status !== "incomplete" &&
        status !== "pending" && (
        <StatusNotice
          compact
          icon={AlertCircle}
          title={
            status === "expired"
              ? "Verification expired"
              : "Verification needs attention"
          }
          description={
            <>
              You can submit MOA requests now. They&apos;ll stay queued until
              your company is approved.{" "}
              <Link href={profileHref} className="text-primary underline">
                Update profile
              </Link>
              .
            </>
          }
          variant="destructive"
          role="alert"
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
