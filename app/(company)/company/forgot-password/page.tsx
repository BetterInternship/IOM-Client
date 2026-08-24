"use client";
import { useState } from "react";
import Link from "next/link";
import { useCompanyAuthControllerForgot } from "@/app/api";
import { AuthShell, FormError, FormSuccess } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function CompanyForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [censoredEmail, setCensoredEmail] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const forgot = useCompanyAuthControllerForgot({
    mutation: {
      onSuccess: (data) => {
        setCensoredEmail(data.censoredEmail);
        setSent(true);
        setError("");
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  return (
    <AuthShell
      portal="Company"
      title="Reset password"
      description="Enter your account email and we'll send a reset link."
      footer={
        <Link href="/login" className="text-primary font-medium">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <FormSuccess>
          {censoredEmail
            ? `A reset link has been sent to ${censoredEmail}.`
            : "If a matching account exists, a reset link has been sent to it."}
        </FormSuccess>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            forgot.mutate({ data: { email } });
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
            disabled={!email || forgot.isPending}
          >
            {forgot.isPending && <Loader2 className="animate-spin" />}
            {forgot.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
