"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { AuthShell, FormError, FormSuccess } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function CompanyForgotPasswordPage() {
  const [tin, setTin] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const forgot = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/auth/company/forgot", { tin }),
    onSuccess: () => {
      setSent(true);
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <AuthShell
      portal="Company"
      title="Reset password"
      description="Enter your company TIN and we'll email a reset link to your representative."
      footer={
        <Link href="/company/login" className="text-primary font-medium">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <FormSuccess>
          If a matching account exists, a reset link has been sent to your
          representative email.
        </FormSuccess>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            forgot.mutate();
          }}
          className="space-y-4"
        >
          <FormError>{error}</FormError>

          <div className="space-y-1.5">
            <Label htmlFor="tin">Company TIN</Label>
            <Input
              id="tin"
              inputMode="numeric"
              placeholder="000-000-000-000"
              value={tin}
              onChange={(e) => setTin(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!tin || forgot.isPending}
          >
            {forgot.isPending && <Loader2 className="animate-spin" />}
            {forgot.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
