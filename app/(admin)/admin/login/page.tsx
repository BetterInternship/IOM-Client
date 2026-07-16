"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAdminControllerOverviewQueryKey,
  useAdminAuthControllerLogin,
} from "@/app/api";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = useAdminAuthControllerLogin({
    mutation: {
      onSuccess: () => {
        queryClient.resetQueries({
          queryKey: getAdminControllerOverviewQueryKey(),
        });
        router.replace("/admin/universities");
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  return (
    <AuthShell
      variant="split"
      splitFlush
      portal="Platform Admin"
      title="Admin sign in"
      description="Restricted access for platform administrators."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          login.mutate({ data: { email, password } });
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
            placeholder="admin@betterinternship.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
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
