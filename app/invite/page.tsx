"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { Button } from "@/components/ui/button";
import { Building2, Loader2, Mail } from "lucide-react";

interface InviteData {
  email: string;
  company_name: string | null;
  email_status: "not_registered" | "registered_unverified" | "registered_verified";
  university: { id: string; registered_name: string; address: string | null };
  template: { id: string; name: string; description: string | null; term_months: number } | null;
  invite: { personal_message: string | null; expires_at: string };
}

function InvitePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { data, isLoading, error } = useQuery<InviteData>({
    queryKey: ["invite-peek", token],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/invite/company?token=${encodeURIComponent(token)}`)
        .then((r) => r.data as InviteData),
    enabled: !!token,
    retry: false,
  });

  if (!token || (!isLoading && (error || !data))) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold text-gray-900">
            {!token ? "Invalid invite link" : "Invite not found"}
          </p>
          <p className="text-muted-foreground text-sm">
            {!token
              ? "This invite link is missing required information."
              : "This invite link may have expired or already been used."}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  const { email, company_name, email_status, university, template, invite } = data!;
  const registerHref = `/company/register?invite_token=${encodeURIComponent(token)}`;
  const loginHref = `/company/login?invite_token=${encodeURIComponent(token)}`;

  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-6 rounded-[0.33em] border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Invitation from
              </p>
              <p className="font-semibold text-gray-900">{university.registered_name}</p>
              {university.address && (
                <p className="text-muted-foreground text-xs">{university.address}</p>
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-3">
            {company_name && (
              <div className="flex items-start gap-2">
                <Building2 className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  For <span className="font-medium text-gray-900">{company_name}</span>
                </p>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Mail className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                Sent to <span className="font-medium text-gray-900">{email}</span>
              </p>
            </div>

            {template && (
              <div className="rounded-[0.33em] border border-gray-200 bg-gray-50 px-3 py-2.5">
                <p className="text-muted-foreground text-xs">MOA template</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">{template.name}</p>
                {template.description && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{template.description}</p>
                )}
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Term: {template.term_months} months
                </p>
              </div>
            )}

            {invite.personal_message && (
              <div className="rounded-[0.33em] border border-gray-200 px-3 py-2.5">
                <p className="text-muted-foreground mb-1 text-xs">Message</p>
                <p className="whitespace-pre-line text-sm text-gray-700">
                  {invite.personal_message}
                </p>
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-3">
            {email_status === "not_registered" ? (
              <>
                <p className="text-sm text-gray-700">
                  {university.registered_name} has invited your company to sign a Memorandum of
                  Agreement. Create an account to get started — no email verification needed.
                </p>
                <Button size="lg" className="w-full" asChild>
                  <Link href={registerHref}>Create company account</Link>
                </Button>
              </>
            ) : email_status === "registered_verified" ? (
              <>
                <p className="text-sm text-gray-700">
                  Your company is already registered and verified. Sign in to request the MOA now.
                </p>
                <Button size="lg" className="w-full" asChild>
                  <Link href={loginHref}>Sign in to request MOA</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700">
                  Your company is registered but not yet verified. Sign in to finish your profile
                  and queue the MOA — it will be issued automatically once approved.
                </p>
                <Button size="lg" className="w-full" asChild>
                  <Link href={loginHref}>Sign in to continue</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          Institutional MOA Platform
        </p>
      </div>
    </div>
  );
}

export default function CompanyInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      }
    >
      <InvitePageContent />
    </Suspense>
  );
}
