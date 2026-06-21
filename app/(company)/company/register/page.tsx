"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

type Step = "details" | "otp";

export default function CompanyRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({
    tin: "",
    legalIdentifier: "",
    displayName: "",
    repEmail: "",
    password: "",
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const register = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/auth/company/register", form),
    onSuccess: (res) => {
      setResendIn(res.data?.resendIn ?? 60);
      setStep("otp");
      setError("");
    },
    onError: (e: any) => setError(e.message),
  });

  const verify = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/auth/company/otp/verify", {
        repEmail: form.repEmail,
        code,
      }),
    onSuccess: () => router.replace("/company/dashboard"),
    onError: (e: any) => setError(e.message),
  });

  const resend = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/auth/company/otp/request", {
        repEmail: form.repEmail,
      }),
    onSuccess: (res) => {
      setResendIn(res.data?.resendIn ?? 60);
      setError("");
    },
    onError: (e: any) => setError(e.message),
  });

  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [k]: e.target.value }),
  });

  const detailsValid =
    form.tin && form.legalIdentifier && form.repEmail && form.password.length >= 8;

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
            verify.mutate();
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
              verify.mutate();
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
              onClick={() => resend.mutate()}
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

  return (
    <AuthShell
      portal="Company"
      title="Register your company"
      description="Your TIN is verified against BIR ORUS before your account is created."
      footer={
        <>
          Already registered?{" "}
          <Link href="/company/login" className="text-primary font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          register.mutate();
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
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            placeholder="ACME CORP"
            className="uppercase"
            value={form.displayName}
            onChange={(e) =>
              setForm({ ...form, displayName: e.target.value.toUpperCase() })
            }
          />
          <p className="text-muted-foreground text-xs">
            Shown across the platform. Defaults to your registered name.
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
