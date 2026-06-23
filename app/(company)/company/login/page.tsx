"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function CompanyLoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tin, setTin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/auth/company/login", { tin, password }),
    onSuccess: () => {
      queryClient.resetQueries({ queryKey: ["company-me"] });
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
      description="Use your company TIN and password to access the portal."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="text-primary font-medium">
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
