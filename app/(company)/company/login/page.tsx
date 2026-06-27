"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
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

  const [tin, setTin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/auth/company/login", { tin, password }),
    onSuccess: async () => {
      queryClient.resetQueries({ queryKey: ["company-me"] });

      if (inviteToken) {
        try {
          const res = await preconfiguredAxios
            .post("/api/company/invites/claim", { token: inviteToken })
            .then((r) => r.data as { university_id: string; template_id: string | null });

          if (res.university_id) {
            const params = new URLSearchParams();
            if (res.template_id) params.set("template_id", res.template_id);
            const qs = params.toString() ? `?${params}` : "";
            router.replace(`/company/universities/${res.university_id}/queue-moa${qs}`);
            return;
          }
        } catch {
          // Invite expired or already claimed — fall through to dashboard
        }
      }

      router.replace("/company/dashboard");
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate();
  };

  return (
    <AuthShell
      portal="Company"
      title="Sign in"
      description={
        inviteToken
          ? "Sign in to continue with your invitation."
          : "Use your company TIN and password to access the portal."
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
          <Label htmlFor="tin">Company TIN</Label>
          <Input
            id="tin"
            inputMode="numeric"
            autoComplete="username"
            placeholder="123456789"
            maxLength={9}
            value={tin}
            onChange={(e) => setTin(e.target.value.replace(/\D/g, "").slice(0, 9))}
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
          disabled={login.isPending || !tin || !password}
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
        <AuthShell portal="Company" title="Sign in">
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
