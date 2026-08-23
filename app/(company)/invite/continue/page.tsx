"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock4,
  FileText,
  Loader2,
  Mail,
  PenLine,
  Send,
  Upload,
} from "lucide-react";

import {
  type CompanyControllerCreateMoaRequestBody,
  type CompanyPendingInvitesResponse,
  getCompanyControllerGetDocumentsQueryKey,
  getCompanyControllerGetVerificationQueryKey,
  getCompanyControllerListMoaRequestsQueryKey,
  getCompanyControllerListPendingInvitesQueryKey,
  useCompanyControllerCreateMoaRequest,
  useCompanyControllerGetDocuments,
  useCompanyControllerGetRequestableTemplates,
  useCompanyControllerListPendingInvites,
  useCompanyControllerUploadDocument,
} from "@/app/api";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { FormError } from "@/components/auth-shell";
import { useIomModalRegistry } from "@/components/modal-registry";
import {
  MoaSignatureInput,
  type MoaSignatureMode,
} from "@/components/moa-signature-input";
import { PageContainer, PageHeader } from "@/components/page-header";
import { SignatoryCard } from "@/components/signatory-card";
import { SignatoryEmailInput } from "@/components/signatory-email-input";
import { toastPresets } from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { documentLabel, REQUIRED_DOCUMENT_TYPES } from "@/lib/document-types";
import { cn } from "@/lib/utils";

type RequestMode = "self" | "delegate";
type SubStep = "who-signs" | "details";
type StepId = "documents" | SubStep;
type Phase = "form" | "submitting" | "issued" | "submitted";

const SUB_STEP_META: Record<StepId, StepperStep> = {
  documents: { title: "Upload documents" },
  "who-signs": { title: "Who signs" },
  details: { title: "Details" },
};

const STEP_ORDER: StepId[] = ["documents", "who-signs", "details"];

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

function DocumentsStep({
  onAllUploaded,
}: {
  onAllUploaded: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: verification } = useCompanyVerification(true);
  const { data: docsData } = useCompanyControllerGetDocuments();
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  // Set right before a singular upload fires, read back in its onSuccess —
  // different document types can upload concurrently (only the matching
  // type's button disables), so deriving "did this complete the set" live
  // inside onSuccess would race a second upload's own invalidation.
  const pendingCompletionRef = useRef(false);

  const docs = docsData?.documents ?? [];
  const latestDoc = (type: string) => docs.find((d) => d.type === type);
  const docCount = REQUIRED_DOCUMENT_TYPES.filter((t) => latestDoc(t)).length;

  const uploadSingle = useCompanyControllerUploadDocument({
    mutation: {
      onSuccess: () => {
        setUploadingType(null);
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerGetDocumentsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerGetVerificationQueryKey(),
        });
        if (pendingCompletionRef.current) {
          toast(
            "All documents submitted — your account is now under review.",
            toastPresets.success,
          );
          onAllUploaded();
        } else {
          toast("Document uploaded", toastPresets.success);
        }
      },
      onError: (e: Error) => {
        setUploadingType(null);
        toast(e.message, toastPresets.destructive);
      },
    },
  });

  function slotState(
    type: string,
  ): { kind: "missing" } | { kind: "rejected"; reason: string } | { kind: "on-file" } {
    if (
      verification?.reason === "rejected" &&
      verification.documentRejections[type]
    ) {
      return { kind: "rejected", reason: verification.documentRejections[type] };
    }
    return latestDoc(type) ? { kind: "on-file" } : { kind: "missing" };
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        We use these three documents to verify the identity of your company.<br />
        You will be emailed once we've verified all three documents you upload.
      </p>
      <div className="flex max-w-xs items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
          <div
            className="bg-primary h-full rounded-full"
            style={{
              width: `${(docCount / REQUIRED_DOCUMENT_TYPES.length) * 100}%`,
            }}
          />
        </div>
        <span className="text-muted-foreground text-xs">
          {docCount} of {REQUIRED_DOCUMENT_TYPES.length} uploaded
        </span>
      </div>

      <div className="overflow-hidden rounded-[0.33em] border border-gray-200 bg-white">
        {REQUIRED_DOCUMENT_TYPES.map((type) => {
          const label = documentLabel(type);
          const slot = slotState(type);
          const busy = uploadingType === type;
          return (
            <div
              key={type}
              className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                {slot.kind === "missing" && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Not uploaded
                  </p>
                )}
                {slot.kind === "rejected" && (
                  <p className="text-destructive mt-0.5 text-xs">
                    Rejected: {slot.reason}
                  </p>
                )}
                {slot.kind === "on-file" && (
                  <p className="text-supportive mt-0.5 text-xs">On file</p>
                )}
              </div>
              <div className="flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    document.getElementById(`invite-doc-${type}`)?.click()
                  }
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Upload />}
                  {busy
                    ? "Uploading…"
                    : slot.kind === "on-file"
                      ? "Replace"
                      : "Upload"}
                </Button>
                <input
                  id={`invite-doc-${type}`}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setUploadingType(type);
                      pendingCompletionRef.current =
                        docCount === REQUIRED_DOCUMENT_TYPES.length - 1 &&
                        !latestDoc(type);
                      uploadSingle.mutate({ data: { file, type } });
                    }
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
          );
        })}
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

  const [subStep, setSubStep] = useState<SubStep>("who-signs");
  const [subStepDirection, setSubStepDirection] = useState(1);
  const [mode, setMode] = useState<RequestMode | null>(null);
  const [repName, setRepName] = useState("");
  const [repTitle, setRepTitle] = useState("");
  const [sigMode, setSigMode] = useState<MoaSignatureMode>("type");
  const [sigText, setSigText] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [signatoryEmail, setSignatoryEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [outcomeMessage, setOutcomeMessage] = useState("");
  const [documentsDoneOverride, setDocumentsDoneOverride] = useState(false);
  // Frozen the first time it's known (below) so finishing uploads — which
  // flips verification.status away from "incomplete" — can't retroactively
  // shrink the stepper from 3 phases to 2 while it's still on screen.
  const hasDocumentsStepRef = useRef<boolean | null>(null);

  const createRequest = useCompanyControllerCreateMoaRequest();

  if (companyLoading || verificationLoading || invitesLoading) {
    return (
      <PageContainer className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }
  if (!company) return null;

  if (!invite) {
    return (
      <PageContainer className="max-w-2xl space-y-6">
        <PageHeader title="Invite expired or already used." />
        <Button onClick={() => router.push("/company/dashboard")}>
          Go to your dashboard
        </Button>
      </PageContainer>
    );
  }

  const university = invite.university!;
  const needsDocumentsStep =
    !documentsDoneOverride && verification?.status === "incomplete";
  if (hasDocumentsStepRef.current === null) {
    hasDocumentsStepRef.current = verification?.status === "incomplete";
  }
  const hasDocumentsStep = hasDocumentsStepRef.current;
  const steps: StepId[] = hasDocumentsStep
    ? STEP_ORDER
    : STEP_ORDER.filter((id) => id !== "documents");
  const currentStep: StepId = needsDocumentsStep ? "documents" : subStep;

  const handleSuccess = (res: {
    request?: { status?: string; moa_id?: string | null };
  }) => {
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerListMoaRequestsQueryKey(),
    });
    queryClient.setQueriesData<CompanyPendingInvitesResponse>(
      { queryKey: getCompanyControllerListPendingInvitesQueryKey() },
      (current) =>
        current
          ? {
              ...current,
              invites: current.invites.filter((inv) => inv.id !== invite.id),
            }
          : current,
    );

    const status = res.request?.status;
    if (status === "issued" && res.request?.moa_id) {
      setPhase("issued");
      window.setTimeout(() => {
        router.push(`/company/moas/${res.request!.moa_id}?issued=1`);
      }, 550);
      return;
    }

    const message =
      mode === "delegate"
        ? `We emailed ${signatoryEmail} a link to sign — you'll see it here once it's signed.`
        : "Signed and on file — it will issue automatically once your company is verified.";
    setOutcomeMessage(message);
    setPhase("submitted");
    toast(
      mode === "delegate"
        ? "Signature request sent."
        : "MOA request submitted.",
      toastPresets.success,
    );
    window.setTimeout(() => {
      router.push("/company/requests");
    }, 1400);
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
      setDocumentsDoneOverride(false);
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

  if (phase === "submitting") {
    return (
      <PageContainer className="max-w-2xl">
        <OutcomeScreen
          icon={<FileText className="text-primary h-9 w-9" />}
          title="Submitting your request"
          description="One moment…"
        />
      </PageContainer>
    );
  }
  if (phase === "issued") {
    return (
      <PageContainer className="max-w-2xl">
        <OutcomeScreen
          icon={<CheckCircle2 className="text-supportive h-9 w-9" />}
          title="MOA issued"
          description="Opening your MOA…"
        />
      </PageContainer>
    );
  }
  if (phase === "submitted") {
    return (
      <PageContainer className="max-w-2xl">
        <OutcomeScreen
          icon={<Clock4 className="text-supportive h-9 w-9" />}
          title="Request submitted"
          description={outcomeMessage}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-2xl space-y-6">
      <PageHeader
        title={`Sign MOA with ${university.registered_name}`}
      />

      <Stepper
        steps={steps.map((id) => SUB_STEP_META[id])}
        currentStep={steps.indexOf(currentStep)}
      />

      <AnimatePresence mode="wait" initial={false} custom={subStepDirection}>
        <motion.div
          key={currentStep}
          custom={subStepDirection}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
        >
          {currentStep === "documents" && (
            <DocumentsStep
              onAllUploaded={() => setDocumentsDoneOverride(true)}
            />
          )}

          {currentStep === "who-signs" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {fallbackLoading && needsFallbackTemplate ? (
                  <Skeleton className="h-4 w-40" />
                ) : (
                  <>
                    <span className="text-muted-foreground">Document:</span>
                    <span className="font-medium text-gray-900">
                      {templateName ?? "None available"}
                    </span>
                    {templateName && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <button
                          type="button"
                          className="text-primary cursor-pointer underline underline-offset-2"
                          onClick={() =>
                            modal.previewTemplate.open({
                              id: templateId!,
                              name: templateName,
                              description: templateDescription,
                            })
                          }
                        >
                          Preview
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("self")}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-2 rounded-[0.33em] border p-4 text-left transition-colors",
                    mode === "self"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full",
                      mode === "self"
                        ? "bg-primary/10 text-primary"
                        : "bg-gray-100 text-muted-foreground",
                    )}
                  >
                    <PenLine className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    I&apos;ll sign it myself
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Enter your name, title, and signature now.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("delegate")}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-2 rounded-[0.33em] border p-4 text-left transition-colors",
                    mode === "delegate"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full",
                      mode === "delegate"
                        ? "bg-primary/10 text-primary"
                        : "bg-gray-100 text-muted-foreground",
                    )}
                  >
                    <Send className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    Send it to someone else to sign
                  </span>
                  <span className="text-muted-foreground text-xs">
                    We&apos;ll email a signing link — no account needed.
                  </span>
                </button>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setSubStepDirection(1);
                    setSubStep("details");
                  }}
                  disabled={!mode || !templateId}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === "details" && (
            <div className="space-y-4">
              {mode === "self" ? (
                <SignatoryCard>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="rep-name">
                        Name
                      </Label>
                      <Input
                        id="rep-name"
                        value={repName}
                        onChange={(e) => setRepName(e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="rep-title">
                        Title
                      </Label>
                      <Input
                        id="rep-title"
                        value={repTitle}
                        onChange={(e) => setRepTitle(e.target.value)}
                        placeholder="e.g. CEO, HR Manager"
                      />
                    </div>
                  </div>

                  <MoaSignatureInput
                    mode={sigMode}
                    onModeChange={setSigMode}
                    text={sigText}
                    onTextChange={setSigText}
                    file={sigFile}
                    onFileChange={setSigFile}
                  />
                </SignatoryCard>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-[0.33em] border border-gray-200 bg-gray-50 p-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-muted-foreground">
                      <Mail className="h-4 w-4" />
                    </span>
                    <p className="text-muted-foreground text-sm">
                      Just the email — name, title, and signature are theirs
                      to enter, since they&apos;re what gets printed on the
                      document.
                    </p>
                  </div>

                  <SignatoryEmailInput
                    id="signatory-email"
                    value={signatoryEmail}
                    onChange={setSignatoryEmail}
                    suggestions={[]}
                  />
                </div>
              )}

              {error && <FormError>{error}</FormError>}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubStepDirection(-1);
                    setSubStep("who-signs");
                    setError(null);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
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
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </PageContainer>
  );
}

export default function InviteContinuePage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="max-w-2xl space-y-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 w-full" />
        </PageContainer>
      }
    >
      <InviteContinueContent />
    </Suspense>
  );
}
