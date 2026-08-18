"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { type ApiError } from "@/app/api/preconfig.axios";
import {
  getCompanyControllerMeQueryKey,
  useCompanyAuthControllerCheckIdentity,
  useCompanyAuthControllerRegister,
  useCompanyAuthControllerRegisterInvited,
  useCompanyAuthControllerOtpRequest,
  useCompanyAuthControllerOtpVerify,
  useInviteControllerResolveCompanyInvite,
} from "@/app/api";
import { AuthShell, FormError } from "@/components/auth-shell";
import { getCareerHireUrl } from "@/components/career-listing-cta";
import { toastPresets } from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { AlertCircle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Step = "identity" | "account" | "otp";

interface InvitePeek {
  email: string;
  invite_id: string;
  university: { id: string; registered_name: string };
  template: { id: string } | null;
  kind: "moa" | "listing";
  tin_hint: string | null;
}

const CAREER_UNREACHABLE_MESSAGE =
  'Your account is ready, but we couldn\'t reach BetterInternship just now — use the "Post a listing" button below to continue.';

function RegistrationLoader({ step, active }: { step: Step; active: boolean }) {
  const progress = step === "identity" ? "w-1/2" : "w-full";

  return (
    <div
      className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200"
      role="status"
      aria-live="polite"
      aria-label={active ? "Loading" : "Registration progress"}
    >
      <div
        className={`bg-primary relative h-full rounded-full transition-all duration-300 ${progress}`}
      >
        {active && (
          <span className="absolute inset-0 animate-pulse bg-white/35" />
        )}
      </div>
    </div>
  );
}

/**
 * Reads (never verifies) the career → new-IOM prefill JWT's payload for
 * form prefill purposes only (plan §6) — actual verification happens
 * server-side on registration completion. An unreadable/malformed token
 * just means no prefill, never an error.
 */
function peekPrefillPayload(
  token: string,
): { name?: string; email?: string } | null {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as { name?: string; email?: string };
  } catch {
    return null;
  }
}

interface InviteCompletionData {
  kind?: "moa" | "listing" | "standard";
  university_id?: string;
  template_id?: string | null;
  magicLink?: string | null;
  conflictEmail?: string;
  autoLinkToken?: string;
}

/**
 * Shared post-registration redirect for the invite flow (plan §6.1) — used
 * by both registerInvited's immediate completion and the OTP-verify
 * completion reached when the submitted email differs from the invite's, so
 * the listing magic-link/conflict branch and the MOA dashboard-params
 * branch can't drift between the two entry points.
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

  if (data.university_id) {
    const params = new URLSearchParams({
      open_university_id: data.university_id,
      complete_profile_after_queue: "1",
    });
    if (data.template_id) params.set("template_id", data.template_id);
    if (invitePeek?.invite_id) params.set("invite_id", invitePeek.invite_id);
    router.replace(`/company/dashboard?${params}`);
  } else {
    router.replace("/company/dashboard");
  }
}

function RegisterPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";
  const prefillToken = searchParams.get("prefill") ?? "";

  const [step, setStep] = useState<Step>("identity");
  const [form, setForm] = useState({
    tin: "",
    legalIdentifier: "",
    repEmail: "",
    email: "",
    password: "",
  });

  // One-time prefill from the career-site handoff — doesn't clobber
  // whatever the user has already typed.
  useEffect(() => {
    if (!prefillToken) return;
    const payload = peekPrefillPayload(prefillToken);
    if (!payload) return;
    setForm((prev) => ({
      ...prev,
      repEmail: prev.repEmail || (payload.email ?? ""),
      legalIdentifier:
        prev.legalIdentifier || (payload.name ?? "").toUpperCase(),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillToken]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tinTakenEmail, setTinTakenEmail] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const { data: invitePeekRaw, isLoading: inviteLoading } =
    useInviteControllerResolveCompanyInvite(
      { token: inviteToken },
      { query: { enabled: !!inviteToken, retry: false } },
    );
  const invitePeek = invitePeekRaw as InvitePeek | undefined;

  // Register-form prefill for legacy-linked listing invites (§4.2's tin_hint)
  // — editable, never clobbers what the user has already typed.
  useEffect(() => {
    if (!invitePeek?.tin_hint) return;
    setForm((prev) => ({ ...prev, tin: prev.tin || invitePeek.tin_hint! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitePeek?.tin_hint]);

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

  const checkIdentity = useCompanyAuthControllerCheckIdentity({
    mutation: {
      onSuccess: (data) => {
        setForm((current) => ({
          ...current,
          legalIdentifier: data.registeredName,
        }));
        setStep("account");
        setError("");
        setTinTakenEmail("");
      },
      onError: (e: Error) => {
        const err = e as ApiError;
        if (err.code === "TIN_TAKEN") {
          setTinTakenEmail(err.censoredEmail ?? "");
          setError("");
        } else {
          setError(e.message);
          setTinTakenEmail("");
        }
      },
    },
  });

  // Standard registration
  const register = useCompanyAuthControllerRegister({
    mutation: {
      onSuccess: (data) => {
        setResendIn(data.resendIn ?? 60);
        setStep("otp");
        setError("");
        setTinTakenEmail("");
      },
      onError: (e: Error) => {
        const err = e as ApiError;
        if (err.code === "TIN_TAKEN") {
          setTinTakenEmail(err.censoredEmail ?? "");
          setStep("identity");
          setError("");
        } else {
          setError(e.message);
          setTinTakenEmail("");
        }
      },
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
          setTinTakenEmail("");
          return;
        }

        queryClient.invalidateQueries({
          queryKey: getCompanyControllerMeQueryKey(),
        });
        handleInviteCompletion(data, invitePeek, router);
      },
      onError: (e: Error) => {
        const err = e as ApiError;
        if (err.code === "TIN_TAKEN") {
          setTinTakenEmail(err.censoredEmail ?? "");
          setStep("identity");
          setError("");
        } else {
          setError(e.message);
          setTinTakenEmail("");
        }
      },
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
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerMeQueryKey(),
        });
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
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerMeQueryKey(),
        });
        router.replace("/company/dashboard");
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

  const identityValid = form.tin.length === 9 && !!form.legalIdentifier.trim();
  const renderIdentityStep = (
    description: React.ReactNode,
    footer: React.ReactNode,
  ) => (
    <AuthShell
      variant="split"
      splitFlush
      portal="Company"
      title="Verify your company"
      description={description}
      progress={
        <RegistrationLoader step="identity" active={checkIdentity.isPending} />
      }
      footer={footer}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          setTinTakenEmail("");
          checkIdentity.mutate({
            data: {
              tin: form.tin,
              legalIdentifier: form.legalIdentifier,
            },
          });
        }}
        className="space-y-4"
      >
        <FormError>{error}</FormError>

        {tinTakenEmail && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/5 rounded-[0.33em] border p-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1.5">
                <p className="font-medium text-gray-900">
                  This TIN is already registered
                </p>
                <p className="text-muted-foreground">
                  It belongs to{" "}
                  <span className="text-foreground font-mono font-medium">
                    {tinTakenEmail}
                  </span>
                  .
                </p>
                {inviteToken ? (
                  <Link
                    href={`/company/login?invite_token=${encodeURIComponent(inviteToken)}`}
                    className="text-primary inline-block font-medium underline underline-offset-2"
                  >
                    Sign in to accept this invite
                  </Link>
                ) : (
                  <a
                    href="mailto:hello@betterinternship.com"
                    className="text-primary inline-block font-medium underline underline-offset-2"
                  >
                    Don&apos;t recognize it? Contact support
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="tin">Company TIN</Label>
          <Input
            id="tin"
            inputMode="numeric"
            placeholder="123456789"
            maxLength={9}
            value={form.tin}
            onChange={(event) => {
              setTinTakenEmail("");
              setForm({
                ...form,
                tin: event.target.value.replace(/\D/g, "").slice(0, 9),
              });
            }}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="legalIdentifier">BIR-registered name</Label>
          <Input
            id="legalIdentifier"
            placeholder="ACME CORPORATION, INC."
            className="uppercase"
            value={form.legalIdentifier}
            onChange={(event) => {
              setTinTakenEmail("");
              setForm({
                ...form,
                legalIdentifier: event.target.value.toUpperCase(),
              });
            }}
            required
          />
          <p className="text-muted-foreground text-xs">
            Must match your BIR registration exactly.
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!identityValid || checkIdentity.isPending}
        >
          {checkIdentity.isPending && <Loader2 className="animate-spin" />}
          {checkIdentity.isPending ? "Checking company…" : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );

  // ── Invite flow ───────────────────────────────────────────────────────────

  if (inviteToken) {
    if (inviteLoading) {
      return (
        <AuthShell
          portal="Company"
          title="Loading invite…"
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

    if (step === "identity") {
      return renderIdentityStep(
        isListingInvite
          ? `Confirm the legal identity of the company invited by ${invitePeek.university.registered_name} to post internship listings on BetterInternship.`
          : `Confirm the legal identity of the company invited by ${invitePeek.university.registered_name}.`,
        <>
          Already registered?{" "}
          <Link
            href={`/company/login?invite_token=${encodeURIComponent(inviteToken)}`}
            className="text-primary font-medium"
          >
            Sign in instead
          </Link>
        </>,
      );
    }

    if (step === "otp") {
      return (
        <AuthShell
          variant="split"
          splitFlush
          portal="Company"
          title="Verify your email"
          headerBefore={
            <button
              type="button"
              onClick={() => {
                setStep("account");
                setError("");
                setCode("");
                verifyInviteSubmittedRef.current = false;
              }}
              className="text-muted-foreground hover:text-primary mb-3 inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to details
            </button>
          }
          progress={
            <RegistrationLoader
              step="otp"
              active={verifyInvite.isPending || resend.isPending}
            />
          }
          description={
            <>
              We sent a 6-digit code to{" "}
              <span className="text-foreground font-medium">
                {form.email}
              </span>
              .
            </>
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

    const inviteDetailsValid = !!form.email && form.password.length >= 8;
    const inviteEmailMatchesInvite = form.email === invitePeek.email;

    return (
      <AuthShell
        variant="split"
        splitFlush
        portal="Company"
        title="Create your account"
        progress={
          <RegistrationLoader
            step="account"
            active={registerInvited.isPending}
          />
        }
        description={
          <>
            Invited by{" "}
            <span className="text-foreground font-medium">
              {invitePeek.university.registered_name}
            </span>
            .{" "}
            {inviteEmailMatchesInvite
              ? "Your account email is pre-verified — no OTP needed."
              : "We'll send a one-time code to verify this email."}
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
            setTinTakenEmail("");
            registerInvited.mutate({
              data: {
                token: inviteToken,
                tin: form.tin,
                legalIdentifier: form.legalIdentifier,
                email: form.email,
                password: form.password,
              },
            });
          }}
          className="space-y-4"
        >
          <FormError>{error}</FormError>

          <div className="rounded-[0.33em] border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-900">
              {form.legalIdentifier}
            </p>
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">
              TIN {form.tin}
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("identity");
                setError("");
              }}
              className="text-primary mt-2 text-xs font-medium"
            >
              Change company
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Account email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...field("email")}
              required
            />
            <p className="text-muted-foreground text-xs">
              Defaults to the address this invite was sent to — you can use a
              different one. This will be your login email.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              {...field("password")}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!inviteDetailsValid || registerInvited.isPending}
          >
            {registerInvited.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Verifying with BIR…
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
      </AuthShell>
    );
  }

  // ── Standard registration flow ────────────────────────────────────────────

  if (step === "identity") {
    return renderIdentityStep(
      "Enter the company TIN and BIR-registered name so we can verify that the company is available.",
      <>
        Already registered?{" "}
        <Link href="/login" className="text-primary font-medium">
          Sign in
        </Link>
      </>,
    );
  }

  if (step === "otp") {
    return (
      <AuthShell
        variant="split"
        splitFlush
        portal="Company"
        title="Verify your email"
        headerBefore={
          <button
            type="button"
            onClick={() => {
              setStep("account");
              setError("");
              setCode("");
              verifySubmittedRef.current = false;
            }}
            className="text-muted-foreground hover:text-primary mb-3 inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to details
          </button>
        }
        progress={
          <RegistrationLoader
            step="otp"
            active={verify.isPending || resend.isPending}
          />
        }
        description={
          <>
            We sent a 6-digit code to{" "}
            <span className="text-foreground font-medium">{form.repEmail}</span>
            .
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (verifySubmittedRef.current) return;
            verifySubmittedRef.current = true;
            setError("");
            verify.mutate({ data: { repEmail: form.repEmail, code } });
          }}
          className="space-y-5"
        >
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
                data: { repEmail: form.repEmail, code: completedCode },
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

  const detailsValid = !!form.repEmail && form.password.length >= 8;

  return (
    <AuthShell
      variant="split"
      splitFlush
      portal="Company"
      title="Create your account"
      progress={
        <RegistrationLoader step="account" active={register.isPending} />
      }
      description="Add the representative email and password you will use to sign in."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="text-primary font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setTinTakenEmail("");
          register.mutate({
            data: {
              tin: form.tin,
              legalIdentifier: form.legalIdentifier,
              repEmail: form.repEmail,
              password: form.password,
              ...(prefillToken ? { prefillToken } : {}),
            },
          });
        }}
        className="space-y-4"
      >
        <FormError>{error}</FormError>

        <div className="rounded-[0.33em] border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-900">
            {form.legalIdentifier}
          </p>
          <p className="text-muted-foreground mt-0.5 font-mono text-xs">
            TIN {form.tin}
          </p>
          <button
            type="button"
            onClick={() => {
              setStep("identity");
              setError("");
            }}
            className="text-primary mt-2 text-xs font-medium"
          >
            Change company
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="repEmail">Representative email</Label>
          <Input
            id="repEmail"
            type="email"
            autoComplete="email"
            placeholder="rep@acme.com"
            {...field("repEmail")}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...field("password")}
            required
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!detailsValid || register.isPending}
        >
          {register.isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Creating registration…
            </>
          ) : (
            "Continue"
          )}
        </Button>

        <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          We&apos;ll email a verification code after BIR check.
        </p>
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
      <RegisterPageContent />
    </Suspense>
  );
}
