"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { type ApiError } from "@/app/api/preconfig.axios";
import {
  getCompanyControllerMeQueryKey,
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
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Step = "account" | "otp";

interface InvitePeek {
  email: string;
  invite_id: string;
  university: { id: string; registered_name: string };
  template: { id: string } | null;
  kind: "moa" | "listing";
}

const CAREER_UNREACHABLE_MESSAGE =
  'Your account is ready, but we couldn\'t reach BetterInternship just now — use the "Post a listing" button below to continue.';

function RegistrationLoader({ step, active }: { step: Step; active: boolean }) {
  const progress = step === "account" ? "w-1/2" : "w-full";

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
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";
  const prefillToken = searchParams.get("prefill") ?? "";

  const [step, setStep] = useState<Step>("account");
  const [form, setForm] = useState({
    repEmail: "",
    email: "",
    password: "",
  });

  // One-time prefill from the career-site handoff — doesn't clobber
  // whatever the user has already typed.
  useEffect(() => {
    if (!prefillToken) return;
    const payload = peekPrefillPayload(prefillToken);
    if (!payload?.email) return;
    setForm((prev) => ({ ...prev, repEmail: prev.repEmail || payload.email! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillToken]);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

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

        queryClient.invalidateQueries({
          queryKey: getCompanyControllerMeQueryKey(),
        });
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
            registerInvited.mutate({
              data: {
                token: inviteToken,
                email: form.email,
                password: form.password,
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
            {registerInvited.isPending && <Loader2 className="animate-spin" />}
            {registerInvited.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  // ── Standard registration flow (flow spec §3: email + password, then OTP) ──

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
      description="Add the email and password you will use to sign in. You'll upload your documents next."
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
          register.mutate({
            data: {
              repEmail: form.repEmail,
              password: form.password,
              ...(prefillToken ? { prefillToken } : {}),
            },
          });
        }}
        className="space-y-4"
      >
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
      <RegisterPageContent />
    </Suspense>
  );
}
