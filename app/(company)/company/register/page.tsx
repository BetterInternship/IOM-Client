"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { type ApiError } from "@/app/api/preconfig.axios";
import {
  useCompanyAuthControllerRegister,
  useCompanyAuthControllerRegisterInvited,
  useCompanyAuthControllerOtpRequest,
  useCompanyAuthControllerOtpVerify,
  useInviteControllerResolveCompanyInvite,
} from "@/app/api";
import { AuthShell, FormError } from "@/components/auth-shell";
import { useModal } from "@/app/providers/modal-provider";
import { getCareerHireUrl } from "@/components/career-listing-cta";
import { toastPresets } from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { ChevronLeft, Loader2 } from "lucide-react";
import { documentLabel, REQUIRED_DOCUMENT_TYPES } from "@/lib/document-types";
import { peekHireLinkIntent } from "@/lib/hire-link-intent";
import { CompanyAuthSessionGate } from "@/components/company-auth-session-gate";
import { toast } from "sonner";

type Step = "account" | "otp";

interface InvitePeek {
  email: string;
  invite_id: string;
  university: { id: string; registered_name: string };
  template: { id: string } | null;
  kind: "moa" | "listing";
}

function RecruiterRequiredDocumentsModal({
  onProceed,
}: {
  onProceed: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="border-warning/30 bg-warning/5 rounded-[0.33em] border p-4">
        <p className="text-sm font-semibold text-gray-900">
          In the next steps, you&apos;ll be asked to upload these documents to
          verify your account.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700 marker:text-warning">
          {REQUIRED_DOCUMENT_TYPES.map((type) => (
            <li key={type}>{documentLabel(type)}</li>
          ))}
        </ul>
      </div>
      <Button className="w-full" onClick={onProceed}>
        I have these documents ready
      </Button>
    </div>
  );
}

const CAREER_UNREACHABLE_MESSAGE =
  'Your account is ready, but we couldn\'t reach BetterInternship just now — use the "Post a listing" button below to continue.';

interface InviteCompletionData {
  kind?: "moa" | "listing" | "standard";
  university_id?: string;
  template_id?: string | null;
  magicLink?: string | null;
  conflictEmail?: string;
  autoLinkToken?: string;
}

/**
 * Shared post-registration redirect for the invite flow (plan §6.1, §11) —
 * used by both registerInvited's immediate completion and the OTP-verify
 * completion reached when the submitted email differs from the invite's, so
 * the listing magic-link/conflict branch and the MOA stepper branch can't
 * drift between the two entry points.
 */
function handleInviteCompletion(
  data: InviteCompletionData,
  invitePeek: InvitePeek | undefined,
  router: ReturnType<typeof useRouter>,
) {
  // Listing invites skip the MOA template-card flow entirely — career
  // provisioning already ran server-side (D6/D7); just follow its outcome.
  // Never blocks on failure: IOM registration already succeeded regardless.
  if (data.kind === "listing") {
    if (data.magicLink) {
      window.location.href = data.magicLink;
    } else if (data.conflictEmail && data.autoLinkToken) {
      const url = new URL("/login", getCareerHireUrl());
      url.searchParams.set("email", data.conflictEmail);
      url.searchParams.set("auto_link", data.autoLinkToken);
      window.location.href = url.toString();
    } else {
      toast(CAREER_UNREACHABLE_MESSAGE, toastPresets.destructive);
      router.replace("/company/dashboard");
    }
    return;
  }

  if (invitePeek?.invite_id) {
    router.replace(
      `/invite/continue?invite_id=${encodeURIComponent(invitePeek.invite_id)}`,
    );
  } else {
    router.replace("/company/dashboard");
  }
}

function RegisterPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useModal();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";
  const linkIntent = searchParams.get("link_intent") ?? "";
  const hireLink = peekHireLinkIntent(linkIntent);
  const [prefillReady, setPrefillReady] = useState(!linkIntent);
  const prefillModalOpenedRef = useRef(false);

  const [step, setStep] = useState<Step>("account");
  const [form, setForm] = useState({
    repEmail: searchParams.get("email") ?? hireLink?.email ?? "",
    email: "",
  });

  useEffect(() => {
    if (
      !linkIntent ||
      prefillReady ||
      prefillModalOpenedRef.current
    )
      return;
    prefillModalOpenedRef.current = true;
    openModal(
      "recruiter-required-documents",
      <RecruiterRequiredDocumentsModal
        onProceed={() => {
          closeModal("recruiter-required-documents");
          setPrefillReady(true);
        }}
      />,
      {
        title: (
          <h2 className="text-warning text-lg leading-snug font-semibold tracking-tight sm:text-2xl">
            Please ensure you have these files on-hand.
          </h2>
        ),
        allowBackdropClick: false,
        closeOnEsc: false,
        hasClose: false,
      },
    );
  }, [
    closeModal,
    linkIntent,
    openModal,
    prefillReady,
  ]);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // Set the instant an invite registration/verification succeeds, before the
  // queryClient.clear() below wipes the invite-resolve query this component
  // is still reading from — without it, the page re-renders into its "invite
  // expired" fallback for a frame while the redirect is still in flight.
  const [completingInvite, setCompletingInvite] = useState(false);

  const { data: invitePeekRaw, isLoading: inviteLoading } =
    useInviteControllerResolveCompanyInvite(
      { token: inviteToken },
      { query: { enabled: !!inviteToken, retry: false } },
    );
  const invitePeek = invitePeekRaw as InvitePeek | undefined;

  // D6: the invite's account-email field defaults to invitePeek.email but
  // stays editable — this only fills it in once, never clobbers a value the
  // user already typed.
  useEffect(() => {
    if (!invitePeek?.email) return;
    setForm((prev) => ({ ...prev, email: prev.email || invitePeek.email }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitePeek?.email]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Standard registration
  const register = useCompanyAuthControllerRegister({
    mutation: {
      onSuccess: (data) => {
        setResendIn(data.resendIn ?? 60);
        setStep("otp");
        setError("");
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  // Invite registration — instant when the email matches the invite;
  // otherwise the response carries needsOtp and we route to the OTP step
  // exactly like the standard flow (plan D2).
  const registerInvited = useCompanyAuthControllerRegisterInvited({
    mutation: {
      onSuccess: (data) => {
        if (data.needsOtp) {
          setResendIn(data.resendIn ?? 60);
          setStep("otp");
          setError("");
          return;
        }

        setCompletingInvite(true);
        // Full clear, not a scoped invalidate — these query keys aren't
        // scoped by company id, so a prior session's cache could otherwise
        // leak into the freshly-registered account.
        queryClient.clear();
        handleInviteCompletion(data, invitePeek, router);
      },
      onError: (e: Error) => setError((e as ApiError).message ?? e.message),
    },
  });

  // OtpInput's onComplete fires synchronously the instant the last digit
  // lands, in the same tick as a native Enter-triggered form submit — a
  // disabled submit button doesn't stop that second path, since Enter-to-
  // submit isn't a click on the button. Both handlers below can therefore
  // fire before React ever re-renders with mutation.isPending = true, so an
  // isPending check (still stale in both closures at that point) can't
  // de-dupe them. A ref can: it's a shared mutable cell, not a render
  // snapshot, so the first handler's write is visible to the second's read
  // even within the same synchronous event.
  const verifyInviteSubmittedRef = useRef(false);
  const verifySubmittedRef = useRef(false);

  // OTP completion for the invite flow's different-email path — same
  // redirect handling as registerInvited's immediate-completion branch
  // above, factored out to handleInviteCompletion so the two can't drift.
  const verifyInvite = useCompanyAuthControllerOtpVerify({
    mutation: {
      onSuccess: (data) => {
        setCompletingInvite(true);
        // Full clear, not a scoped invalidate — these query keys aren't
        // scoped by company id, so a prior session's cache could otherwise
        // leak into the freshly-registered account.
        queryClient.clear();
        handleInviteCompletion(data, invitePeek, router);
      },
      onError: (e: Error) => {
        verifyInviteSubmittedRef.current = false;
        setError(e.message);
      },
    },
  });

  const verify = useCompanyAuthControllerOtpVerify({
    mutation: {
      onSuccess: (data) => {
        if (data.careerLink) {
          toast[data.careerLink.status === "linked" ? "success" : "error"](
            data.careerLink.message,
          );
        }
        // Full clear, not a scoped invalidate — these query keys aren't
        // scoped by company id, so a prior session's cache could otherwise
        // leak into the freshly-registered account.
        queryClient.clear();
        // Standard registration always starts "incomplete" (no documents
        // yet) — go straight to the upload gate instead of the dashboard.
        router.replace("/verification");
      },
      onError: (e: Error) => {
        verifySubmittedRef.current = false;
        setError(e.message);
      },
    },
  });

  const resend = useCompanyAuthControllerOtpRequest({
    mutation: {
      onSuccess: (data) => {
        setResendIn(data.resendIn ?? 60);
        setError("");
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [k]: e.target.value }),
  });

  if (linkIntent && !prefillReady) {
    return (
      <AuthShell
        portal="Company"
        title="Prepare your documents"
        variant="split"
        splitFlush
      >
        <div className="flex justify-center py-4">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      </AuthShell>
    );
  }

  // ── Invite flow ───────────────────────────────────────────────────────────

  if (inviteToken) {
    if (inviteLoading || completingInvite) {
      return (
        <AuthShell
          portal="Company"
          title={
            completingInvite ? "Setting up your account…" : "Loading invite…"
          }
          variant="split"
          splitFlush
        >
          <div className="flex justify-center py-4">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        </AuthShell>
      );
    }

    if (!invitePeek) {
      return (
        <AuthShell
          portal="Company"
          title="Invite not found"
          variant="split"
          splitFlush
        >
          <FormError>
            This invite link has expired or is no longer valid.
          </FormError>
          <div className="mt-4 space-y-2 text-center text-sm font-medium">
            <Button asChild className="w-full">
              <Link href="/login">Login to your company account</Link>
            </Button>
            <Link href="/register" className="text-primary block">
              Register without an invite
            </Link>
          </div>
        </AuthShell>
      );
    }

    const isListingInvite = invitePeek.kind === "listing";

    if (step === "otp") {
      return (
        <AuthShell
          variant="split"
          splitFlush
          portal="Company"
          headerBefore={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStep("account");
                setError("");
                setCode("");
                verifyInviteSubmittedRef.current = false;
              }}
              className="mb-3"
            >
              <ChevronLeft className="gap-1" /> Back
            </Button>
          }
          description={
            <span className="block text-center">
              We sent a 6-digit code to{" "}
              <span className="text-foreground font-medium">{form.email}</span>.
            </span>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (verifyInviteSubmittedRef.current) return;
              verifyInviteSubmittedRef.current = true;
              setError("");
              verifyInvite.mutate({ data: { repEmail: form.email, code } });
            }}
            className="space-y-5"
          >
            <FormError>{error}</FormError>

            <OtpInput
              value={code}
              onChange={setCode}
              autoFocus
              disabled={verifyInvite.isPending}
              onComplete={(completedCode) => {
                if (verifyInviteSubmittedRef.current) return;
                verifyInviteSubmittedRef.current = true;
                setError("");
                verifyInvite.mutate({
                  data: { repEmail: form.email, code: completedCode },
                });
              }}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={code.length < 6 || verifyInvite.isPending}
            >
              {verifyInvite.isPending && <Loader2 className="animate-spin" />}
              {verifyInvite.isPending ? "Verifying…" : "Verify & continue"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() =>
                  resend.mutate({ data: { repEmail: form.email } })
                }
                disabled={resendIn > 0 || resend.isPending}
                className="text-muted-foreground hover:text-primary text-sm disabled:opacity-50 disabled:hover:text-current"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        </AuthShell>
      );
    }

    const inviteDetailsValid = !!form.email;

    return (
      <AuthShell
        variant="split"
        splitFlush
        portal="Company"
        title="Create your account"
        description={
          <>
            Invited by{" "}
            <span className="text-foreground font-medium">
              {invitePeek.university.registered_name}
            </span>
            . We'll send a one-time code to verify this email.
            {isListingInvite &&
              " You'll be able to post a listing on BetterInternship right after this."}
          </>
        }
        footer={
          <>
            Already registered?{" "}
            <Link
              href={`/company/login?invite_token=${encodeURIComponent(inviteToken)}`}
              className="text-primary font-medium"
            >
              Sign in instead
            </Link>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            registerInvited.mutate({
              data: {
                token: inviteToken,
                email: form.email,
              },
            });
          }}
          className="space-y-4"
        >
          <FormError>{error}</FormError>

          <div className="space-y-1.5">
            <Label htmlFor="email">Account email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...field("email")}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!inviteDetailsValid || registerInvited.isPending}
          >
            {registerInvited.isPending && <Loader2 className="animate-spin" />}
            {registerInvited.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  // ── Standard registration flow (email, then OTP) ──────────────────────────

  if (step === "otp") {
    return (
      <AuthShell
        variant="split"
        splitFlush
        portal="Company"
        headerBefore={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setStep("account");
              setError("");
              setCode("");
              verifySubmittedRef.current = false;
            }}
            className="gap-1"
          >
            <ChevronLeft /> Back
          </Button>
        }
        description={
          <span className="block text-center">
            We sent a 6-digit code to{" "}
            <span className="text-foreground font-medium">{form.repEmail}</span>
            .
          </span>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (verifySubmittedRef.current) return;
            verifySubmittedRef.current = true;
            setError("");
            verify.mutate({
              data: {
                repEmail: form.repEmail,
                code,
                ...(linkIntent ? { linkIntent } : {}),
              },
            });
          }}
          className="space-y-5"
        >
          {hireLink && (
            <div className="rounded-[0.33em] bg-primary/10 px-4 py-3 text-sm leading-6 text-primary">
              You are connecting your Partners account to{" "}
              <strong>{hireLink.employerName}</strong> on BetterInternship.
            </div>
          )}
          <FormError>{error}</FormError>

          <OtpInput
            value={code}
            onChange={setCode}
            autoFocus
            disabled={verify.isPending}
            onComplete={(completedCode) => {
              if (verifySubmittedRef.current) return;
              verifySubmittedRef.current = true;
              setError("");
              verify.mutate({
                data: {
                  repEmail: form.repEmail,
                  code: completedCode,
                  ...(linkIntent ? { linkIntent } : {}),
                },
              });
            }}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={code.length < 6 || verify.isPending}
          >
            {verify.isPending && <Loader2 className="animate-spin" />}
            {verify.isPending ? "Verifying…" : "Verify & continue"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() =>
                resend.mutate({ data: { repEmail: form.repEmail } })
              }
              disabled={resendIn > 0 || resend.isPending}
              className="text-muted-foreground hover:text-primary text-sm disabled:opacity-50 disabled:hover:text-current"
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  const detailsValid = !!form.repEmail;
  const loginHref = linkIntent
    ? `/company/login?${new URLSearchParams({
        email: form.repEmail,
        link_intent: linkIntent,
      })}`
    : "/login";
  const connectionNotice = hireLink && (
    <div className="rounded-[0.33em] bg-primary/10 px-4 py-3 text-sm leading-6 text-primary">
      You are connecting your Partners account to{" "}
      <strong>{hireLink.employerName}</strong> on BetterInternship.
    </div>
  );

  return (
    <AuthShell
      variant="split"
      splitFlush
      portal="Company"
      title="Register"
      footer={
        <>
          Already registered?{" "}
          <Link href={loginHref} className="text-primary font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          register.mutate({
            data: {
              repEmail: form.repEmail,
              ...(linkIntent ? { linkIntent } : {}),
            },
          });
        }}
        className="space-y-4"
      >
        {connectionNotice}
        <FormError>{error}</FormError>

        <div className="space-y-1.5">
          <Label htmlFor="repEmail">Email</Label>
          <Input
            id="repEmail"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...field("repEmail")}
            required
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!detailsValid || register.isPending}
        >
          {register.isPending && <Loader2 className="animate-spin" />}
          {register.isPending ? "Creating registration…" : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function CompanyRegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell portal="Company" title="Loading…" variant="split" splitFlush>
          <div className="flex justify-center py-4">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        </AuthShell>
      }
    >
      <CompanyAuthSessionGate>
        <RegisterPageContent />
      </CompanyAuthSessionGate>
    </Suspense>
  );
}
