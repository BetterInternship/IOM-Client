"use client";
import { useState } from "react";
import Link from "next/link";
import { useCompanyAuthControllerList, useCompanyAuthControllerForgot } from "@/app/api";
import { AuthShell, FormError, FormSuccess } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Loader2 } from "lucide-react";

interface CompanyListItem {
  id: string;
  registered_name: string;
  censored_tin: string;
}

export default function CompanyForgotPasswordPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [censoredEmail, setCensoredEmail] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const { data: companyListResponse } = useCompanyAuthControllerList();
  const companyList = (companyListResponse?.companies ?? []) as CompanyListItem[];

  const options = companyList.map((c) => ({ id: c.id, name: c.registered_name }));
  const selectedCompany = companyList.find((c) => c.id === selectedId) ?? null;

  const forgot = useCompanyAuthControllerForgot({
    mutation: {
    onSuccess: (data) => {
      setCensoredEmail(data.censoredEmail);
      setSent(true);
      setError("");
    },
    onError: (e: Error) => setError(e.message),
    },
  });

  return (
    <AuthShell
      portal="Company"
      title="Reset password"
      description="Select your company and we'll email a reset link to your representative."
      footer={
        <Link href="/login" className="text-primary font-medium">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <FormSuccess>
          {censoredEmail
            ? `A reset link has been sent to ${censoredEmail}.`
            : "If a matching account exists, a reset link has been sent to your representative email."}
        </FormSuccess>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            forgot.mutate({ data: { companyId: selectedId! } });
          }}
          className="space-y-4"
        >
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
                <span className="text-muted-foreground text-xs font-medium">TIN</span>
                <span className="font-mono text-gray-800">
                  {selectedCompany?.censored_tin ?? <span className="text-muted-foreground">—</span>}
                </span>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!selectedId || forgot.isPending}
          >
            {forgot.isPending && <Loader2 className="animate-spin" />}
            {forgot.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
