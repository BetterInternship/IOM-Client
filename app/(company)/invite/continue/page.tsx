"use client";

import { Suspense, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
} from "lucide-react";

import {
  type CompanyControllerCreateMoaRequestBody,
  getCompanyControllerGetPermissionsQueryKey,
  getCompanyControllerListMoaRequestsQueryKey,
  getCompanyControllerListPendingInvitesQueryKey,
  useCompanyControllerCreateMoaRequest,
  useCompanyControllerGetRequestableTemplates,
  useCompanyControllerListPendingInvites,
} from "@/app/api";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { FormError } from "@/components/auth-shell";
import { CompanyDocumentUploader } from "@/components/company/company-document-uploader";
import {
  CompanySignerForm,
  type CompanySignerMode,
} from "@/components/company-signer-form";
import { useIomModalRegistry } from "@/components/modal-registry";
import { TemplatePreviewRow } from "@/components/template-preview-row";
import type { MoaSignatureMode } from "@/components/moa-signature-input";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type RequestMode = CompanySignerMode;
type StepId = "documents" | "who-signs";
type Phase = "form" | "submitting" | "redirecting";

const STEP_ORDER: StepId[] = ["documents", "who-signs"];

// Same slide + fade + easing as the Docs client's signing-flow stepper
// (Docs-Client's app/docs/sign/page.tsx step transitions), adapted to
// AnimatePresence since this page's content height varies per step rather
// than living in a fixed-height shell.
const stepVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -24 : 24, opacity: 0 }),
};
const stepTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

type CreateRequestApiError = {
  code?: string;
  data?: { limit?: number };
  response?: { data?: { code?: string; data?: { limit?: number } } };
};

function OutcomeScreen({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex min-h-[20rem] w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <div className="bg-supportive/10 mb-5 rounded-full p-6">{icon}</div>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        {description}
      </p>
    </div>
  );
}

function InviteContinueShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative min-h-dvh">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 sm:top-6 sm:left-6">
        <Image
          src="/betterinternship-logo.png"
          alt="BetterInternship"
          width={25}
          height={25}
          className="flex-none"
        />
        <span className="font-display text-lg font-bold text-gray-900">
          Partners
        </span>
      </div>
      <PageContainer className={className}>{children}</PageContainer>
    </div>
  );
}

function DocumentsStep({
  onAllUploaded,
  onCompletionChange,
  onContinue,
  canContinue,
}: {
  onAllUploaded: () => void;
  onCompletionChange: (isComplete: boolean) => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <div className="space-y-6">
      <CompanyDocumentUploader
        onAllUploaded={onAllUploaded}
        onCompletionChange={onCompletionChange}
      />
      <div className="flex justify-end">
        <Button disabled={!canContinue} onClick={onContinue}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function InviteContinueContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const modal = useIomModalRegistry();
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("invite_id") ?? "";

  const { company, isLoading: companyLoading } = useCompanyProfile();
  const { data: verification, isLoading: verificationLoading } =
    useCompanyVerification(!!company);
  const { data: invitesData, isLoading: invitesLoading } =
    useCompanyControllerListPendingInvites({
      query: { enabled: !!company },
    });

  const invite = (invitesData?.invites ?? []).find(
    (inv) => inv.id === inviteId && !!inv.university,
  );

  const needsFallbackTemplate = !!invite && !invite.template;
  const { data: fallbackData, isLoading: fallbackLoading } =
    useCompanyControllerGetRequestableTemplates(invite?.university?.id ?? "", {
      query: { enabled: needsFallbackTemplate },
    });
  const fallbackTemplates = fallbackData?.templates ?? [];
  const fallbackTemplateId =
    fallbackData?.defaultTemplateId ?? fallbackTemplates[0]?.id ?? null;
  const fallbackTemplate = fallbackTemplates.find(
    (t) => t.id === fallbackTemplateId,
  );

  const templateId = invite?.template?.id ?? fallbackTemplateId;
  const templateName = invite?.template?.name ?? fallbackTemplate?.name ?? null;
  const templateDescription =
    invite?.template?.description ?? fallbackTemplate?.description ?? null;
  const templateTermMonths = fallbackTemplate?.term_months;

  const [stepDirection, setStepDirection] = useState(1);
  const [mode, setMode] = useState<RequestMode | null>(null);
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [repName, setRepName] = useState("");
  const [repTitle, setRepTitle] = useState("");
  const [sigMode, setSigMode] = useState<MoaSignatureMode>("type");
  const [sigText, setSigText] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [signatoryEmail, setSignatoryEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [documentsUploaded, setDocumentsUploaded] = useState(false);
  const [documentsStepCompleted, setDocumentsStepCompleted] = useState(false);
  // Frozen the first time it's known (below) so finishing uploads — which
  // flips verification.status away from "incomplete" — can't retroactively
  // change the active flow from 2 phases to 1 while it is still on screen.
  const hasDocumentsStepRef = useRef<boolean | null>(null);

  const createRequest = useCompanyControllerCreateMoaRequest();

  if (companyLoading || verificationLoading || invitesLoading) {
    return (
      <InviteContinueShell className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </InviteContinueShell>
    );
  }
  if (!company) return null;

  if (phase === "submitting" || phase === "redirecting") {
    return (
      <InviteContinueShell className="max-w-2xl">
        <OutcomeScreen
          icon={<FileText className="text-primary h-9 w-9" />}
          title={
            phase === "redirecting"
              ? "Opening your requests"
              : "Submitting your request"
          }
          description="One moment…"
        />
      </InviteContinueShell>
    );
  }

  if (!invite) {
    return (
      <InviteContinueShell className="max-w-2xl space-y-6">
        <PageHeader title="Invite expired or already used." />
        <Button onClick={() => router.push("/company/dashboard")}>
          Go to your dashboard
        </Button>
      </InviteContinueShell>
    );
  }

  const university = invite.university!;
  if (hasDocumentsStepRef.current === null) {
    hasDocumentsStepRef.current = verification?.status === "incomplete";
  }
  const hasDocumentsStep = hasDocumentsStepRef.current;
  const steps: StepId[] = hasDocumentsStep
    ? STEP_ORDER
    : STEP_ORDER.filter((id) => id !== "documents");
  const currentStep: StepId =
    hasDocumentsStep && !documentsStepCompleted ? "documents" : "who-signs";
  const currentStepNumber = steps.indexOf(currentStep) + 1;

  const handleSuccess = (res: {
    request?: { status?: string; moa_id?: string | null };
  }) => {
    setPhase("redirecting");
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerListMoaRequestsQueryKey(),
    });
    // Same staleTime: Infinity issue as the dashboard's RequestDialog — the
    // requests page's auto-request CTA reads GetPermissions, which won't
    // pick up this self-sign on its own.
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerGetPermissionsQueryKey(),
    });
    const status = res.request?.status;
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerListPendingInvitesQueryKey(),
    });
    const result =
      status === "issued"
        ? "signed"
        : mode === "delegate"
          ? "signing-request"
          : "submitted";
    router.replace(
      `/company/requests?invite_result=${result}&template_id=${templateId}`,
    );
  };

  const handleError = (e: unknown) => {
    setPhase("form");
    const err = e as CreateRequestApiError;
    const code = err.response?.data?.code || err.code || "";
    if (code === "AT_ACTIVE_MOA_CAP") {
      const limit =
        err.response?.data?.data?.limit ?? err.data?.limit ?? "the maximum";
      setError(
        `You have reached the maximum of ${limit} active MOAs with this university.`,
      );
    } else if (code === "DOCUMENTS_INCOMPLETE") {
      setError("Upload your documents before you can request MOAs.");
      hasDocumentsStepRef.current = true;
      setDocumentsUploaded(false);
      setDocumentsStepCompleted(false);
      setStepDirection(-1);
    } else if (code === "REQUEST_ALREADY_IN_FLIGHT") {
      setError("You already have a request in flight with this university.");
    } else if (code === "UNIVERSITY_NOT_REQUESTABLE") {
      setError("Unable to request from this university at this time.");
    } else {
      setError(
        "Couldn't request from this university at this time. Please contact us for help.",
      );
    }
  };

  const submitRequest = () => {
    if (!mode || !templateId) return;
    setError(null);
    setPhase("submitting");

    const requestData: CompanyControllerCreateMoaRequestBody = {
      universityId: university.id,
      templateId,
      mode,
      inviteId: invite.id,
      ...(mode === "self"
        ? {
            signatoryName: repName,
            signatoryTitle: repTitle,
            ...(sigMode !== "type" && sigFile
              ? { signature: sigFile }
              : { signatureText: sigText }),
          }
        : { signatoryEmail }),
    };

    createRequest.mutate(
      { data: requestData },
      { onSuccess: handleSuccess, onError: handleError },
    );
  };

  const sigReady = sigMode === "type" ? !!sigText.trim() : !!sigFile;
  const selfReady = !!repName.trim() && !!repTitle.trim() && sigReady;
  const delegateReady = /\S+@\S+\.\S+/.test(signatoryEmail.trim());
  const detailsReady = mode === "self" ? selfReady : delegateReady;

  return (
    <InviteContinueShell className="flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col gap-10 pt-28 sm:gap-16">
      <section className="text-left sm:text-center">
        <div className="flex justify-start sm:h-36 sm:justify-center">
          {currentStep === "who-signs" && university.logo_url && (
            // University logos are user-uploaded external assets.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={university.logo_url}
              alt={`${university.registered_name} logo`}
              className="mb-4 size-24 rounded-full border border-gray-200 object-contain sm:mb-0 sm:size-36"
            />
          )}
        </div>
        <h1 className="mt-0 text-2xl font-semibold tracking-tight text-gray-900 sm:mt-4 sm:text-4xl">
          Step {currentStepNumber}/{steps.length}:{" "}
          {currentStep === "documents"
            ? "Upload your documents"
            : `Sign MOA with ${university.registered_name}`}
          {" "}
          <span className="bg-primary/5 text-primary inline-flex h-8 items-center gap-1.5 rounded-full px-3 align-middle text-sm font-semibold sm:h-11 sm:px-4 sm:text-base">
            <Clock3 className="size-4" aria-hidden="true" /> 1 min
          </span>
        </h1>
        {currentStep === "documents" && (
          <p className="text-muted-foreground mt-2 text-sm">
            We use these documents to verify your company. We&apos;ll email you
            once the review is complete.
          </p>
        )}
      </section>

      <AnimatePresence mode="wait" initial={false} custom={stepDirection}>
        <motion.div
          key={currentStep}
          custom={stepDirection}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
        >
          {currentStep === "documents" && (
            <DocumentsStep
              onAllUploaded={() => setDocumentsUploaded(true)}
              onCompletionChange={setDocumentsUploaded}
              canContinue={documentsUploaded}
              onContinue={() => {
                setDocumentsStepCompleted(true);
                setStepDirection(1);
              }}
            />
          )}

          {currentStep === "who-signs" && (
            <div className="w-full space-y-4">
              <div>
                {fallbackLoading && needsFallbackTemplate ? (
                  <Skeleton className="h-20 w-full" />
                ) : templateName && templateId ? (
                  <TemplatePreviewRow
                    name={templateName}
                    termMonths={templateTermMonths}
                    onPreview={() =>
                      modal.previewTemplate.open({
                        id: templateId,
                        name: templateName,
                        description: templateDescription,
                      })
                    }
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Document: None available
                  </p>
                )}
              </div>

              <h2 className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">
                Who will sign the MOA?
              </h2>

              <CompanySignerForm
                mode={mode}
                onModeChange={(nextMode) => {
                  setMode(nextMode);
                  setError(null);
                }}
                onModeChangingChange={setIsChangingMode}
                repName={repName}
                onRepNameChange={setRepName}
                repTitle={repTitle}
                onRepTitleChange={setRepTitle}
                signatureMode={sigMode}
                onSignatureModeChange={setSigMode}
                signatureText={sigText}
                onSignatureTextChange={setSigText}
                signatureFile={sigFile}
                onSignatureFileChange={setSigFile}
                signatoryEmail={signatoryEmail}
                onSignatoryEmailChange={setSignatoryEmail}
              />

              {error && <FormError>{error}</FormError>}

              <div className="flex justify-end gap-2">
                {hasDocumentsStep && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDocumentsStepCompleted(false);
                      setStepDirection(-1);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                )}
                {mode && !isChangingMode && (
                  <Button
                    onClick={submitRequest}
                    disabled={!detailsReady || createRequest.isPending}
                  >
                    {createRequest.isPending && (
                      <Loader2 className="animate-spin" />
                    )}
                    {createRequest.isPending
                      ? "Submitting…"
                      : mode === "delegate"
                        ? "Send signing request"
                        : "Sign & request MOA"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </InviteContinueShell>
  );
}

export default function InviteContinuePage() {
  return (
    <Suspense
      fallback={
        <InviteContinueShell className="max-w-2xl space-y-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 w-full" />
        </InviteContinueShell>
      }
    >
      <InviteContinueContent />
    </Suspense>
  );
}
