"use client";
import { useState } from "react";
import Link from "next/link";
import { useUniversityAuthControllerForgot } from "@/app/api";
import { AuthShell, FormError, FormSuccess } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function UniversityForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const forgot = useUniversityAuthControllerForgot({
    mutation: {
    onSuccess: () => {
      setSent(true);
      setError("");
    },
    onError: (e: Error) => setError(e.message),
    },
  });

  return (
    <AuthShell
      portal="University"
      title="Reset password"
      description="Enter your account email and we'll send you a reset link."
      footer={
        <Link href="/login" className="text-primary font-medium">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <FormSuccess>
          If an account with that email exists, a reset link has been sent.
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
