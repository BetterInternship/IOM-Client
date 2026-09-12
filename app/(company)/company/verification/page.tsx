"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { PageContainer } from "@/components/page-header";
import { CompanyDocumentUploader } from "@/components/company/company-document-uploader";
import {
  GovernmentIdentityClaim,
  useIdentityClaimForm,
} from "@/components/company/government-identity-claim";
import { isGovEmailDomain } from "@/lib/identity-claim";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Only ever mounted once `company` is loaded (see the guard below), so
 * useIdentityClaimForm's initial state is guaranteed to seed from real data
 * — matters for a returning, previously-rejected claimant.
 */
function VerificationForm({
  company,
  onDone,
}: {
  company: { identity_claims: Record<string, unknown>; email: string };
  onDone: () => void;
}) {
  const [documentsUploaded, setDocumentsUploaded] = useState(false);
  const identityClaim = useIdentityClaimForm(
    company,
    isGovEmailDomain(company.email),
  );
  const canContinue =
    identityClaim.choice === "government"
      ? identityClaim.valid
      : identityClaim.choice === "company"
        ? documentsUploaded
        : false;

  async function handleNext() {
    if (identityClaim.choice === "government") {
      if (await identityClaim.submit()) onDone();
      return;
    }
    onDone();
  }

  return (
    <div className="space-y-8">
      <GovernmentIdentityClaim
        form={identityClaim}
        tall
        companyContent={
          <CompanyDocumentUploader onCompletionChange={setDocumentsUploaded} />
        }
      />
      <div className="flex justify-end">
        <Button
          disabled={!canContinue || identityClaim.isPending}
          onClick={handleNext}
        >
          {identityClaim.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              Next <ChevronRight />
            </>
          )}
          {identityClaim.isPending && "Submitting..."}
        </Button>
      </div>
    </div>
  );
}

export default function VerificationPage() {
  const router = useRouter();
  const initialVerificationStatus = useRef<string | null>(null);
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: verificationLoading } =
    useCompanyVerification(!!company);
  const status = verification?.status;

  useEffect(() => {
    if (!status || initialVerificationStatus.current) return;

    initialVerificationStatus.current = status;
    if (status !== "incomplete") router.replace("/company/dashboard");
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
    <PageContainer className="flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col justify-center gap-20 pb-48">
      <section className="text-center">
        <div className="bg-primary/10 text-primary mx-auto flex size-24 items-center justify-center rounded-full sm:size-36">
          <ShieldCheck className="size-10 sm:size-14" />
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          Verify your company to start partnering with universities
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 text-sm">
          We use these documents to verify your company. We'll email you once
          the review is complete.
        </p>
      </section>

      <VerificationForm
        company={company}
        onDone={() => router.replace("/company/dashboard")}
      />
    </PageContainer>
  );
}
