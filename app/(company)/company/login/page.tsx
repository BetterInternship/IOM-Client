"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCompanyControllerMeQueryKey,
  useCompanyAuthControllerList,
  useCompanyAuthControllerLogin,
  companyControllerClaimInvite,
} from "@/app/api";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Loader2 } from "lucide-react";

interface CompanyListItem {
  id: string;
  registered_name: string;
  censored_tin: string;
}

function LoginPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { data: companyListResponse } = useCompanyAuthControllerList();
  const companyList = (companyListResponse?.companies ??
    []) as CompanyListItem[];

  const options = companyList.map((c) => ({
    id: c.id,
    name: c.registered_name,
  }));
  const selectedCompany = companyList.find((c) => c.id === selectedId) ?? null;

  const login = useCompanyAuthControllerLogin({
    mutation: {
      onSuccess: async () => {
        queryClient.resetQueries({
          queryKey: getCompanyControllerMeQueryKey(),
        });

        if (inviteToken) {
          try {
            const res = await companyControllerClaimInvite({
              token: inviteToken,
            });

            if (res.university_id) {
              const params = new URLSearchParams({
                open_university_id: res.university_id,
              });
              if (res.template_id) params.set("template_id", res.template_id);
              if (res.invite_id) params.set("invite_id", res.invite_id);
              router.replace(`/company/dashboard?${params}`);
              return;
            }
          } catch {
            // Invite expired or already claimed — fall through to dashboard
          }
        }

        router.replace("/company/dashboard");
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate({ data: { companyId: selectedId!, password } });
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
          : "Select your company and enter your password to access the portal."
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
          <Label>Company name</Label>
          <div>
            <Autocomplete
              options={options}
              value={selectedId}
              onChange={(id) => setSelectedId(id as string | null)}
              placeholder="Search for your company…"
              inputClassName="rounded-b-none"
            />
            <div className="flex items-center gap-2 rounded-b-[0.33em] border border-t-0 border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm">
              <span className="text-muted-foreground text-xs font-medium">
                TIN
              </span>
              <span className="font-mono text-gray-800">
                {selectedCompany?.censored_tin ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </div>
          </div>
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
          disabled={login.isPending || !selectedId || !password}
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
