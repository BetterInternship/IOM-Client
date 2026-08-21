"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useSignControllerResolve, useSignControllerSubmit } from "@/app/api";
import type { ApiError } from "@/app/api/preconfig.axios";
import { useIomModalRegistry } from "@/components/modal-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MoaSignatureInput,
  type MoaSignatureMode,
} from "@/components/moa-signature-input";
import { CheckCircle2, FileSignature, Link2Off, Loader2 } from "lucide-react";

interface SignLinkError extends ApiError {
  reason?: "expired" | "already_signed" | "cancelled" | "not_found";
}

function SignPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-5 py-8 shadow-sm sm:px-8">
        {children}
      </div>
    </main>
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
      <SignPageShell>
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Link2Off className="size-8" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-gray-900">
            This signing link is no longer active
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {apiError?.message ??
              "This link is invalid — check that you copied the whole URL."}
          </p>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Contact whoever sent it to you for a new one.
          </p>
          <HelpLine />
        </div>
      </SignPageShell>
    );
  }

  if (isLoading) {
    return (
      <SignPageShell>
        <div className="flex justify-center py-8">
          <Loader2 className="text-primary size-8 animate-spin" />
        </div>
      </SignPageShell>
    );
  }

  if (outcome) {
    return (
      <SignPageShell>
        <div className="text-center">
          <span className="bg-supportive/10 text-supportive mx-auto flex size-16 items-center justify-center rounded-full">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-gray-900">
            {outcome.kind === "issued" ? "MOA signed!" : "MOA Requested!"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {outcome.kind === "issued"
              ? "The agreement has been issued. A copy has been emailed to you."
              : "Thanks for signing — the company isn't verified yet, so this will issue automatically once they are. We'll email you when it does."}
          </p>
          {outcome.kind === "issued" && outcome.verificationCode && (
            <p className="text-muted-foreground mt-4 text-xs">
              Verification code:{" "}
              <span className="font-mono font-medium text-gray-900">
                {outcome.verificationCode}
              </span>
            </p>
          )}
          <HelpLine />
        </div>
      </SignPageShell>
    );
  }

  if (!data) return null;
  const { universityName, templateName, templatePdfUrl, requesterEmail } = data;

  return (
    <SignPageShell>
      <div className="text-center">
        <span className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-full">
          <FileSignature className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg leading-snug font-semibold text-gray-900">
          {requesterEmail && (
            <>
              <span className="text-primary">{requesterEmail}</span>{" "}
            </>
          )}
          is asking you to sign an MOA for a partnership with{" "}
          <span className="text-primary">{universityName}</span>.
        </h1>
      </div>

      <button
        type="button"
        onClick={() =>
          previewDocument.open(
            `/gcs-proxy?url=${encodeURIComponent(templatePdfUrl)}`,
            templateName,
          )
        }
        className="text-primary mt-4 block w-full cursor-pointer text-center text-sm font-medium hover:underline"
      >
        Preview {templateName}
      </button>

      <div className="mt-6 space-y-4 border-t border-gray-200 pt-6">
        <div className="space-y-1.5">
          <Label htmlFor="sign-name">Your name</Label>
          <Input
            id="sign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sign-title">Your title</Label>
          <Input
            id="sign-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <MoaSignatureInput
          mode={sigMode}
          onModeChange={setSigMode}
          text={sigText}
          onTextChange={setSigText}
          file={sigFile}
          onFileChange={setSigFile}
        />
      </div>

      <div className="mt-6 space-y-3">
        <Button
          size="lg"
          className="w-full"
          disabled={!canSubmit}
          onClick={() => handleSubmit(true)}
        >
          {submit.isPending && <Loader2 className="animate-spin" />}
          Sign this and auto-sign future MOAs
        </Button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => handleSubmit(false)}
          className="text-muted-foreground hover:text-primary block w-full cursor-pointer text-center text-sm font-medium underline disabled:pointer-events-none disabled:opacity-50"
        >
          Sign this MOA only
        </button>
      </div>
    </SignPageShell>
  );
}
