"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { PageContainer } from "@/components/page-header";
import { CompanyDocumentUploader } from "@/components/company/company-document-uploader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function VerificationPage() {
  const router = useRouter();
  const [documentsUploaded, setDocumentsUploaded] = useState(false);
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
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          Upload once to partner with any university on BetterInternship{" "}
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 text-sm">
          We use these documents to verify your company. We'll email you once
          the review is complete.
        </p>
      </section>

      <CompanyDocumentUploader onCompletionChange={setDocumentsUploaded} />
      <div className="flex justify-end">
        <Button
          disabled={!documentsUploaded}
          onClick={() => router.replace("/company/dashboard")}
        >
          Next <ChevronRight />
        </Button>
      </div>
    </PageContainer>
  );
}
