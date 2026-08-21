"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCompanyAuthControllerLogin,
  companyControllerClaimInvite,
} from "@/app/api";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function LoginPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";
  const nextParam = searchParams.get("next") ?? "";
  // Only ever a same-origin relative path (avoids an open redirect).
  const next = nextParam.startsWith("/") ? nextParam : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = useCompanyAuthControllerLogin({
    mutation: {
      onSuccess: async () => {
        // Full clear, not a scoped invalidate — these query keys aren't
        // scoped by company id, so a prior session's cache could otherwise
        // leak into this account (e.g. switching between test accounts).
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
            // Invite expired or already claimed — fall through to dashboard
          }
        }

        router.replace(next || "/company/dashboard");
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate({ data: { email, password } });
  };

  return (
    <AuthShell
      variant="split"
      splitFlush
      portal="Company"
      title="Sign in"
      description={
        inviteToken
          ? "Sign in to continue with your invitation."
          : "Enter your email and password to access the portal."
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
      <form onSubmit={submit} className="space-y-4">
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-primary text-xs"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={login.isPending || !email || !password}
        >
          {login.isPending && <Loader2 className="animate-spin" />}
          {login.isPending ? "Signing in…" : "Sign in"}
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
