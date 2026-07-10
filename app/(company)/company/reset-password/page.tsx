"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCompanyAuthControllerReset } from "@/app/api";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function CompanyResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const reset = useCompanyAuthControllerReset({
    mutation: {
    onSuccess: () => {
      setDone(true);
      setError("");
    },
    onError: (e: Error) => setError(e.message),
    },
  });

  if (!token) {
    return (
      <AuthShell portal="Company" title="Invalid reset link">
        <FormError>
          This password reset link is invalid or has expired. Please request a new
          one.
        </FormError>
        <Button
          className="mt-4 w-full"
          size="lg"
          variant="outline"
          scheme="primary"
          onClick={() => router.push("/forgot-password")}
        >
          Request a new link
        </Button>
      </AuthShell>
    );
  }

  const mismatch = !!confirm && password !== confirm;

  return (
    <AuthShell
      portal="Company"
      title={done ? "Password updated" : "Set a new password"}
      description={
        done ? undefined : "Choose a strong password with at least 8 characters."
      }
    >
      {done ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Your password has been reset successfully.
          </p>
          <Button
            className="w-full"
            size="lg"
            onClick={() => router.push("/login")}
          >
            Go to sign in
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            reset.mutate({ data: { token, password } });
          }}
          className="space-y-4"
        >
          <FormError>{error}</FormError>

          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
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
            <Label htmlFor="confirm">Confirm new password</Label>
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
            disabled={password.length < 8 || mismatch || reset.isPending}
          >
            {reset.isPending && <Loader2 className="animate-spin" />}
            {reset.isPending ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function CompanyResetPasswordPage() {
  return (
    <Suspense>
      <CompanyResetPasswordForm />
    </Suspense>
  );
}
