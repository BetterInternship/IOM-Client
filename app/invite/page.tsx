"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { useResolvedFile } from "@/app/lib/resolve-file";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBottomSheet,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface InviteData {
  email: string;
  company_name: string | null;
  email_status: "not_registered" | "registered_unverified" | "registered_verified";
  university: { id: string; registered_name: string; address: string | null; logo_url: string | null };
  template: { id: string; name: string; description: string | null; term_months: number } | null;
  invite: { personal_message: string | null; expires_at: string };
}

interface Template {
  id: string;
  name: string;
  description: string | null;
}

function TemplatePreviewSheet({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const { url: pdfUrl, loading: isLoading } = useResolvedFile("template_pdf", template.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogBottomSheet showCloseButton={false} className="flex h-[85vh] flex-col overflow-hidden">
        <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-sm font-medium text-gray-900">{template.name}</DialogTitle>
            {template.description && (
              <p className="text-muted-foreground truncate text-xs">{template.description}</p>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} className="h-full w-full border-0" title={template.name} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm">Couldn&apos;t load the template PDF.</p>
            </div>
          )}
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

function InvitePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [showPreview, setShowPreview] = useState(false);

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
        <div className="space-y-2 rounded-[0.33em] bg-white/90 px-8 py-6 text-center shadow-lg backdrop-blur-sm">
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
        <Loader2 className="h-8 w-8 animate-spin text-white drop-shadow" />
      </div>
    );
  }

  const { email, company_name, email_status, university, template, invite } = data!;
  const registerHref = `/company/register?invite_token=${encodeURIComponent(token)}`;
  const loginHref = `/company/login?invite_token=${encodeURIComponent(token)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        {university.logo_url && (
          <div className="flex justify-center">
            <img
              src={university.logo_url}
              alt={university.registered_name}
              className="h-48 w-48 rounded-full border border-gray-200 object-contain"
            />
          </div>
        )}

        <div className="overflow-hidden rounded-[0.33em] border border-gray-300 bg-white shadow-lg">
          <div className="space-y-6 p-6 sm:p-8">
            <p className="font-semibold text-gray-900 text-2xl">
              {university.registered_name}
              <br />
              <span className="font-normal text-base">
                invites {company_name ? <span className="font-medium text-gray-900">{company_name}</span> : "your company"} to <span className="font-semibold">sign a MOA</span> with them!
              </span>
            </p>

            <div className="space-y-3">
              {template && (
                <div className="flex items-stretch overflow-hidden rounded-[0.33em] border border-gray-200">
                  <div className="flex-1 bg-gray-50 px-3 py-2.5">
                    <p className="text-muted-foreground text-xs">MOA template</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900">{template.name}</p>
                    {template.description && (
                      <p className="text-muted-foreground mt-0.5 text-xs">{template.description}</p>
                    )}
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Term: {template.term_months} months
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="text-muted-foreground flex cursor-pointer items-center border-l border-gray-200 bg-gray-50 px-4 text-sm duration-200 hover:bg-gray-200"
                  >
                    Preview
                  </button>
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
                    We'll help you set up the MOA.
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
        </div>

        <p className="text-center text-xs text-white/70 drop-shadow">
          Institutional MOA Platform
        </p>
      </div>

      {template && showPreview && (
        <TemplatePreviewSheet template={template} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}

export default function CompanyInvitePage() {
  return (
    <div className="min-h-screen bg-[url('/invite/invite-bg-mobile.png')] bg-cover bg-center md:bg-[url('/invite/invite-bg.png')]">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white drop-shadow" />
          </div>
        }
      >
        <InvitePageContent />
      </Suspense>
    </div>
  );
}
