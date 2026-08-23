"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useSignControllerResolve, useSignControllerSubmit } from "@/app/api";
import type { ApiError } from "@/app/api/preconfig.axios";
import { useIomModalRegistry } from "@/components/modal-registry";
import { PageContainer } from "@/components/page-header";
import { SignatoryCard } from "@/components/signatory-card";
import { TemplatePreviewRow } from "@/components/template-preview-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoaSignatureInput,
  type MoaSignatureMode,
} from "@/components/moa-signature-input";
import { cn } from "@/lib/utils";
import { CheckCircle2, Link2Off, Loader2 } from "lucide-react";

interface SignLinkError extends ApiError {
  reason?: "expired" | "already_signed" | "cancelled" | "not_found";
}

function OutcomeScreen({
  tone,
  icon,
  title,
  description,
  children,
}: {
  tone: "neutral" | "supportive";
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex w-full max-w-md flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10"
    >
      <span
        className={cn(
          "mb-5 flex size-16 items-center justify-center rounded-full",
          tone === "supportive"
            ? "bg-supportive/10 text-supportive"
            : "bg-slate-100 text-slate-500",
        )}
      >
        {icon}
      </span>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        {description}
      </p>
      {children}
    </motion.div>
  );
}

function HelpLine() {
  return (
    <p className="text-muted-foreground mt-4 text-sm">
      Questions?{" "}
      <a
        href="mailto:hello@betterinternship.com"
        className="text-primary underline"
      >
        hello@betterinternship.com
      </a>
    </p>
  );
}

export default function SignTokenPage() {
  const { token } = useParams<{ token: string }>();
  const { previewDocument } = useIomModalRegistry();

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [sigMode, setSigMode] = useState<MoaSignatureMode>("type");
  const [sigText, setSigText] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [outcome, setOutcome] = useState<{
    kind: "issued" | "requested";
    verificationCode: string | null;
  } | null>(null);

  const { data, isLoading, error } = useSignControllerResolve(token, {
    query: { enabled: !!token, retry: false },
  });
  const apiError = error as SignLinkError | null;

  const submit = useSignControllerSubmit({
    mutation: {
      onSuccess: (res) =>
        setOutcome({ kind: res.kind, verificationCode: res.verificationCode }),
      onError: (e: Error) => toast.error(e.message),
    },
  });

  const sigReady = sigMode === "type" ? !!sigText.trim() : !!sigFile;
  const canSubmit =
    !!name.trim() && !!title.trim() && sigReady && !submit.isPending;

  const handleSubmit = (autoSign: boolean) => {
    if (!canSubmit) return;
    submit.mutate({
      token,
      data: {
        name: name.trim(),
        title: title.trim(),
        autoSign,
        ...(sigMode !== "type" && sigFile
          ? { signature: sigFile }
          : { signatureText: sigText }),
      },
    });
  };

  if (!token || (!isLoading && (error || !data))) {
    return (
      <PageContainer className="flex min-h-dvh max-w-2xl items-center justify-center">
        <OutcomeScreen
          tone="neutral"
          icon={<Link2Off className="h-8 w-8" aria-hidden="true" />}
          title="This signing link is no longer active"
          description={
            <>
              {apiError?.message ??
                "This link is invalid — check that you copied the whole URL."}{" "}
              Contact whoever sent it to you for a new one.
            </>
          }
        >
          <HelpLine />
        </OutcomeScreen>
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer className="max-w-6xl space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full rounded-[0.33em]" />
      </PageContainer>
    );
  }

  if (outcome) {
    return (
      <PageContainer className="flex min-h-dvh max-w-2xl items-center justify-center">
        <OutcomeScreen
          tone="supportive"
          icon={<CheckCircle2 className="h-8 w-8" aria-hidden="true" />}
          title={outcome.kind === "issued" ? "MOA signed!" : "MOA Requested!"}
          description={
            outcome.kind === "issued"
              ? "The agreement has been issued. A copy has been emailed to you."
              : "Thanks for signing — the company isn't verified yet, so this will issue automatically once they are. We'll email you when it does."
          }
        >
          {outcome.kind === "issued" && outcome.verificationCode && (
            <p className="text-muted-foreground mt-4 text-xs">
              Verification code:{" "}
              <span className="font-mono font-medium text-gray-900">
                {outcome.verificationCode}
              </span>
            </p>
          )}
          <HelpLine />
        </OutcomeScreen>
      </PageContainer>
    );
  }

  if (!data) return null;
  const {
    universityName,
    universityLogoUrl,
    templateName,
    templatePdfUrl,
    requesterEmail,
  } = data;

  return (
    <PageContainer className="flex min-h-dvh max-w-6xl flex-col justify-center gap-20 pb-48">
      <section className="text-center">
        {universityLogoUrl && (
          // University logos are user-uploaded external assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={universityLogoUrl}
            alt={`${universityName} logo`}
            className="mx-auto size-24 rounded-full border border-gray-200 object-contain sm:size-36"
          />
        )}
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          Sign MOA with {universityName}
        </h1>
      </section>

      <div className="w-full space-y-6">
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm leading-6">
            This agreement was requested by{" "}
            <span className="font-mono text-gray-900">{requesterEmail}</span>.
            Review it before signing. Auto-signing will also sign future MOAs
            from this company that use this template.
          </p>
          <TemplatePreviewRow
            name={templateName}
            onPreview={() => previewDocument.open(templatePdfUrl, templateName)}
          />
          <SignatoryCard bordered>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="sign-name">
                  Name
                </Label>
                <Input
                  id="sign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="sign-title">
                  Title
                </Label>
                <Input
                  id="sign-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
        </div>

        <div className="mt-4 flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
            <Button
              size="lg"
              disabled={!canSubmit}
              onClick={() => handleSubmit(true)}
            >
              {submit.isPending && <Loader2 className="animate-spin" />}
              Sign this and auto-sign future MOAs
            </Button>
          </div>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => handleSubmit(false)}
            className="text-muted-foreground hover:text-primary cursor-pointer text-sm font-medium underline disabled:pointer-events-none disabled:opacity-50"
          >
            Sign this MOA only
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
