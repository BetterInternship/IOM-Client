"use client";
import { Suspense, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { useModal } from "@/app/providers/modal-provider";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

type Step = "details" | "otp";

interface InvitePeek {
  email: string;
  invite_id: string;
  university: { id: string; registered_name: string };
  template: { id: string } | null;
}

function RegisterPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useModal();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";

  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({
    tin: "",
    legalIdentifier: "",
    repEmail: "",
    password: "",
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tinTakenEmail, setTinTakenEmail] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const { data: invitePeekRaw, isLoading: inviteLoading } = useInviteControllerResolveCompanyInvite(
    { token: inviteToken },
    { query: { enabled: !!inviteToken, retry: false } },
  );
  const invitePeek = invitePeekRaw as InvitePeek | undefined;

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const showTinTaken = (email: string, isInvite: boolean) => {
    openModal("tin-taken", (
      <div className="space-y-4">
        <div className="space-y-2 text-sm">
          <p>This TIN is already registered under{' '}<span className="text-foreground font-mono font-medium">{email}</span>.</p>
          {isInvite ? (
            <p>If that's your account,{' '}
              <Link href={`/company/login?invite_token=${encodeURIComponent(inviteToken)}`} className="text-primary font-medium underline">sign in instead</Link>.
            </p>
          ) : (
            <p>Don't recognize this email?{' '}
              <a href="mailto:hello@betterinternship.com" className="text-primary font-medium underline underline-offset-2">Contact us at hello@betterinternship.com</a>.
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => { setTinTakenEmail(""); closeModal("tin-taken"); }}>Close</Button>
        </div>
      </div>
    ), { title: "TIN Already Registered", panelClassName: "!w-full sm:!max-w-md" });
  };

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
        showTinTaken(err.censoredEmail ?? "", false);
        setError("");
      } else {
        setError(e.message);
        setTinTakenEmail("");
      }
    },
    },
  });

  // Invite registration — no OTP, email locked to invite address
  const registerInvited = useCompanyAuthControllerRegisterInvited({
    mutation: {
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getCompanyControllerMeQueryKey() });
      if (data.university_id) {
        const params = new URLSearchParams({ invite_uni: data.university_id });
        if (data.template_id) params.set("invite_template", data.template_id);
        if (invitePeek?.invite_id) params.set("invite_id", invitePeek.invite_id);
        router.replace(`/company/profile?${params}`);
      } else {
        router.replace("/company/dashboard");
      }
    },
    onError: (e: Error) => {
      const err = e as ApiError;
      if (err.code === "TIN_TAKEN") {
        setTinTakenEmail(err.censoredEmail ?? "");
        showTinTaken(err.censoredEmail ?? "", true);
        setError("");
      } else {
        setError(e.message);
        setTinTakenEmail("");
      }
    },
    },
  });

  const verify = useCompanyAuthControllerOtpVerify({
    mutation: {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getCompanyControllerMeQueryKey() });
      router.replace("/company/dashboard");
    },
    onError: (e: Error) => setError(e.message),
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
        <AuthShell portal="Company" title="Loading invite…">
          <div className="flex justify-center py-4">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        </AuthShell>
      );
    }

    if (!invitePeek) {
      return (
        <AuthShell portal="Company" title="Invite not found">
          <FormError>This invite link has expired or is no longer valid.</FormError>
          <div className="mt-4 text-center">
            <Link href="/register" className="text-primary text-sm font-medium">
              Register without an invite
            </Link>
          </div>
        </AuthShell>
      );
    }

    const inviteDetailsValid = !!form.tin && !!form.legalIdentifier && form.password.length >= 8;

    return (
      <AuthShell
        portal="Company"
        title="Create your account"
        description={
          <>
            Invited by{" "}
            <span className="text-foreground font-medium">
              {invitePeek.university.registered_name}
            </span>
            . Your account email is pre-verified — no OTP needed.
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
            registerInvited.mutate({ data: { token: inviteToken, tin: form.tin, legalIdentifier: form.legalIdentifier, password: form.password } });
          }}
          className="space-y-4"
        >
          <FormError>{error}</FormError>

          <div className="space-y-1.5">
            <Label>Account email</Label>
            <Input value={invitePeek.email} disabled className="bg-gray-50" />
            <p className="text-muted-foreground text-xs">
              Set by the inviting university. This will be your login email.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tin">Company TIN</Label>
            <Input
              id="tin"
              inputMode="numeric"
              placeholder="123456789"
              maxLength={9}
              value={form.tin}
              onChange={(e) =>
                setForm({ ...form, tin: e.target.value.replace(/\D/g, "").slice(0, 9) })
              }
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
              onChange={(e) =>
                setForm({ ...form, legalIdentifier: e.target.value.toUpperCase() })
              }
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

  if (step === "otp") {
    return (
      <AuthShell
        portal="Company"
        title="Verify your email"
        description={
          <>
            We sent a 6-digit code to{" "}
            <span className="text-foreground font-medium">{form.repEmail}</span>.
          </>
        }
        footer={
          <button
            type="button"
            onClick={() => {
              setStep("details");
              setError("");
              setCode("");
            }}
            className="hover:text-primary inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to details
          </button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
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
            onComplete={() => {
              setError("");
              verify.mutate({ data: { repEmail: form.repEmail, code } });
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
              onClick={() => resend.mutate({ data: { repEmail: form.repEmail } })}
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

  const detailsValid =
    !!form.tin && !!form.legalIdentifier && !!form.repEmail && form.password.length >= 8;

  return (
    <AuthShell
      portal="Company"
      title="Register your company"
      description="You can refer to an Official Receipt (OR) issued by your company for the exact TIN and company name to use."
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
          register.mutate({ data: form });
        }}
        className="space-y-4"
      >
        <FormError>{error}</FormError>

        <div className="space-y-1.5">
          <Label htmlFor="tin">Company TIN</Label>
          <Input
            id="tin"
            inputMode="numeric"
            placeholder="123456789"
            maxLength={9}
            value={form.tin}
            onChange={(e) =>
              setForm({ ...form, tin: e.target.value.replace(/\D/g, "").slice(0, 9) })
            }
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
            onChange={(e) =>
              setForm({ ...form, legalIdentifier: e.target.value.toUpperCase() })
            }
            required
          />
          <p className="text-muted-foreground text-xs">
            Must match your BIR registration exactly. Saved in uppercase.
          </p>
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
              Verifying with BIR…
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
        <AuthShell portal="Company" title="Loading…">
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
