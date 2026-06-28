"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Loader2 } from "lucide-react";

interface CompanyListItem {
  tin: string;
  display_name: string;
}

function LoginPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";

  const [selectedTin, setSelectedTin] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { data: companyList = [] } = useQuery({
    queryKey: ["company-list"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/auth/company/list")
        .then((r) => r.data.companies as CompanyListItem[]),
    staleTime: 5 * 60 * 1000,
  });

  const options = companyList.map((c) => ({ id: c.tin, name: c.display_name }));
  const selectedCompany = companyList.find((c) => c.tin === selectedTin) ?? null;

  const login = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/auth/company/login", {
        tin: selectedTin,
        password,
      }),
    onSuccess: async () => {
      queryClient.resetQueries({ queryKey: ["company-me"] });

      if (inviteToken) {
        try {
          const res = await preconfiguredAxios
            .post("/api/company/invites/claim", { token: inviteToken })
            .then(
              (r) =>
                r.data as {
                  university_id: string;
                  template_id: string | null;
                  invite_id: string;
                },
            );

          if (res.university_id) {
            const params = new URLSearchParams();
            if (res.template_id) params.set("template_id", res.template_id);
            if (res.invite_id) params.set("invite_id", res.invite_id);
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
              value={selectedTin}
              onChange={(tin) => setSelectedTin(tin as string | null)}
              placeholder="Search for your company…"
              inputClassName="rounded-b-none"
            />
            <div className="flex items-center gap-2 rounded-b-[0.33em] border border-t-0 border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm">
              <span className="text-muted-foreground text-xs font-medium">TIN</span>
              <span className="font-mono text-gray-800">
                {selectedCompany?.tin ?? <span className="text-muted-foreground">—</span>}
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
          disabled={login.isPending || !selectedTin || !password}
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
