"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  getUniversityControllerMeQueryKey,
  useUniversityAuthControllerOtpRequest,
  useUniversityAuthControllerOtpVerify,
} from "@/app/api";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { Loader2 } from "lucide-react";

type Step = "email" | "code";

function UniversityLoginPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  // OtpInput's onComplete fires synchronously the instant the last digit
  // lands, in the same tick as a native Enter-triggered form submit — a
  // disabled submit button doesn't stop that second path, since Enter-to-
  // submit isn't a click on the button. A ref (not isPending, still stale in
  // both closures at that point) de-dupes the two.
  const verifySubmittedRef = useRef(false);
  const autoSentRef = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const request = useUniversityAuthControllerOtpRequest({
    mutation: {
      onSuccess: (data) => {
        setResendIn(data.resendIn ?? 60);
        setStep("code");
        setError("");
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  // An invite/reminder link carries ?email= — land straight on the code
  // step instead of making the person retype their address and click
  // Continue themselves.
  useEffect(() => {
    if (!prefillEmail || autoSentRef.current) return;
    autoSentRef.current = true;
    request.mutate({ data: { email: prefillEmail } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillEmail]);

  const verify = useUniversityAuthControllerOtpVerify({
    mutation: {
      onSuccess: () => {
        queryClient.resetQueries({
          queryKey: getUniversityControllerMeQueryKey(),
        });
        router.replace("/partners");
      },
      onError: (e: Error) => {
        verifySubmittedRef.current = false;
        setError(e.message);
      },
    },
  });

  const backToEmail = () => {
    setStep("email");
    setError("");
    setCode("");
    verifySubmittedRef.current = false;
  };

  if (step === "code") {
    return (
      <AuthShell
        variant="split"
        splitFlush
        portal="University"
        description={
          <span className="block text-center">
            We sent a 6-digit code to{" "}
            <span className="text-foreground font-medium">{email}</span>.{" "}
            <Button
              onClick={backToEmail}
              variant="link"  
            >
              Wrong email?
            </Button>
          </span>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (verifySubmittedRef.current) return;
            verifySubmittedRef.current = true;
            setError("");
            verify.mutate({ data: { email, code } });
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
              verify.mutate({ data: { email, code: completedCode } });
            }}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={code.length < 6 || verify.isPending}
          >
            {verify.isPending && <Loader2 className="animate-spin" />}
            {verify.isPending ? "Signing in…" : "Sign in"}
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
      portal="University"
      title="Sign in"
      description="Sign in to manage your MOAs, partners, and staff accounts."
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
            autoComplete="username"
            placeholder="you@university.edu"
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
          {request.isPending ? "Sending code…" : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function UniversityLoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          portal="University"
          title="Loading…"
          variant="split"
          splitFlush
        >
          <div className="flex justify-center py-4">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        </AuthShell>
      }
    >
      <UniversityLoginPageContent />
    </Suspense>
  );
}
