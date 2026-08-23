"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CompanyDocumentUploader } from "@/components/company/company-document-uploader";
import { Skeleton } from "@/components/ui/skeleton";

export default function VerificationPage() {
  const router = useRouter();
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: verificationLoading } =
    useCompanyVerification(!!company);
  const status = verification?.status;

  // Nothing left to verify — move on. Covers arriving here directly once
  // already pending/verified, not just the just-finished-uploading case
  // above (which redirects faster, without waiting on this refetch).
  useEffect(() => {
    if (status && status !== "incomplete") router.replace("/company/dashboard");
  }, [status, router]);

  if (isLoading || verificationLoading || !company) {
    return (
      <PageContainer className="space-y-8">
        <Skeleton className="h-8 w-96" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </PageContainer>
    );
  }

  return (
    <div className="relative isolate flex-1 bg-slate-50/70">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[url('/bg2.png')] bg-cover bg-center bg-no-repeat opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-gradient-to-b from-white/90 via-white/50 to-transparent" />
      <PageContainer className="relative z-10 space-y-8 pb-12">
        <PageHeader
          title="Verify your company to start partnering with universities"
          description="Upload your documents for your company. We will verify your account within a day."
        />

        <CompanyDocumentUploader
          onAllUploaded={() =>
            window.setTimeout(() => router.replace("/company/dashboard"), 1200)
          }
        />
      </PageContainer>
    </div>
  );
}
