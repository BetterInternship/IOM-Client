"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCompanyAuthControllerLoginOtpRequest,
  useCompanyAuthControllerLoginOtpVerify,
  companyControllerClaimInvite,
  companyControllerGetVerification,
} from "@/app/api";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { Loader2 } from "lucide-react";

type Step = "email" | "code";

function LoginPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";
  const nextParam = searchParams.get("next") ?? "";
  const next = nextParam.startsWith("/") ? nextParam : "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const verifySubmittedRef = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(
      () => setResendIn((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [resendIn]);

  const request = useCompanyAuthControllerLoginOtpRequest({
    mutation: {
      onSuccess: (data) => {
        setResendIn(data.resendIn ?? 60);
        setStep("code");
        setError("");
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  const verify = useCompanyAuthControllerLoginOtpVerify({
    mutation: {
      onSuccess: async () => {
        queryClient.clear();

        if (inviteToken) {
          try {
            const res = await companyControllerClaimInvite({
              token: inviteToken,
            });

            if (res.university_id) {
              router.replace(
                `/invite/continue?invite_id=${encodeURIComponent(res.invite_id)}`,
              );
              return;
            }
          } catch {
            // Invite expiry does not prevent a completed sign-in.
          }
        }

        try {
          const verification = await companyControllerGetVerification();
          if (verification.status === "incomplete") {
            router.replace("/verification");
            return;
          }
        } catch {
          // The landing guard handles an unavailable verification request.
        }

        router.replace(next || "/company/dashboard");
      },
      onError: (e: Error) => {
        verifySubmittedRef.current = false;
        setError(e.message);
      },
    },
  });

  const backToEmail = () => {
    setStep("email");
    setCode("");
    setError("");
    verifySubmittedRef.current = false;
  };

  if (step === "code") {
    const submitCode = (submittedCode: string) => {
      if (verifySubmittedRef.current) return;
      verifySubmittedRef.current = true;
      setError("");
      verify.mutate({ data: { email, code: submittedCode } });
    };

    return (
      <AuthShell
        variant="split"
        splitFlush
        portal="Company"
        title="Check your email"
        description={
          <span className="block text-center">
            If an eligible account exists, we sent a 6-digit code to{" "}
            <span className="text-foreground font-medium">{email}</span>.{" "}
            <Button onClick={backToEmail} variant="link">
              Wrong email?
            </Button>
          </span>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitCode(code);
          }}
          className="space-y-5"
        >
          <FormError>{error}</FormError>
          <OtpInput
            value={code}
            onChange={setCode}
            autoFocus
            disabled={verify.isPending}
            onComplete={submitCode}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={code.length < 6 || verify.isPending}
          >
            {verify.isPending && <Loader2 className="animate-spin" />}
            {verify.isPending ? "Signing in..." : "Sign in"}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => request.mutate({ data: { email } })}
              disabled={resendIn > 0 || request.isPending}
              className="text-muted-foreground hover:text-primary text-sm disabled:opacity-50 disabled:hover:text-current"
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      variant="split"
      splitFlush
      portal="Company"
      title="Sign in"
      description={
        inviteToken
          ? "Sign in to continue with your invitation."
          : "Enter your email and we'll send a sign-in code."
      }
      footer={
        <>
          New here?{" "}
          <Link
            href={
              inviteToken
                ? `/company/register?invite_token=${encodeURIComponent(inviteToken)}`
                : "/register"
            }
            className="text-primary font-medium"
          >
            Register your company
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          request.mutate({ data: { email } });
        }}
        className="space-y-4"
      >
        <FormError>{error}</FormError>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={request.isPending || !email}
        >
          {request.isPending && <Loader2 className="animate-spin" />}
          {request.isPending ? "Sending code..." : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function CompanyLoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell portal="Company" title="Sign in" variant="split" splitFlush>
          <div className="flex justify-center py-4">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        </AuthShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
