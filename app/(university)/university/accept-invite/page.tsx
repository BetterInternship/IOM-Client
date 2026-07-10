"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUniversityAuthControllerAcceptInvite } from "@/app/api";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const accept = useUniversityAuthControllerAcceptInvite({
    mutation: {
    onSuccess: () => router.replace("/partners"),
    onError: (e: Error) => setError(e.message),
    },
  });

  if (!token) {
    return (
      <AuthShell portal="University" title="Invalid invitation">
        <FormError>
          This invitation link is invalid or has expired. Please ask your
          administrator to resend it.
        </FormError>
      </AuthShell>
    );
  }

  const mismatch = !!confirm && password !== confirm;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (mismatch) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    accept.mutate({ data: { token, password } });
  };

  return (
    <AuthShell
      portal="University"
      title="Activate your account"
      description="Choose a password to finish setting up your university account."
    >
      <form onSubmit={submit} className="space-y-4">
        <FormError>{error}</FormError>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {mismatch && (
            <p className="text-destructive text-xs">Passwords do not match.</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={password.length < 8 || mismatch || accept.isPending}
        >
          {accept.isPending && <Loader2 className="animate-spin" />}
          {accept.isPending ? "Activating…" : "Activate account"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}
