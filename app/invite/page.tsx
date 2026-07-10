"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useInviteControllerResolveCompanyInvite, useCompanyAuthControllerLoginViaInvite } from "@/app/api";
import { useResolvedFile } from "@/app/lib/resolve-file";
import { Button } from "@/components/ui/button";
import { useModal } from "@/app/providers/modal-provider";
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

function TemplatePreviewContent({ template, close }: { template: Template; close: () => void }) {
  const { url: pdfUrl, loading: isLoading } = useResolvedFile("template_pdf", template.id);
  return (
    <>
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
    </>
  );
}

function InvitePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const token = searchParams.get("token") ?? "";
  const [loginError, setLoginError] = useState("");

  const loginViaInvite = useCompanyAuthControllerLoginViaInvite({
    mutation: {
    onSuccess: (res) => {
      const params = new URLSearchParams();
      params.set("open_university_id", res.university_id);
      if (res.template_id) params.set("template_id", res.template_id);
      if (res.invite_id) params.set("invite_id", res.invite_id);
      router.replace(`/company/dashboard?${params}`);
    },
    onError: (e: Error) => setLoginError(e.message),
    },
  });

  const { data, isLoading, error } = useInviteControllerResolveCompanyInvite(
    { token },
    { query: { enabled: !!token, retry: false } },
  );

  const inviteData = data as unknown as InviteData | undefined;

  if (!token || (!isLoading && (error || !inviteData))) {
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

  const { email, company_name, email_status, university, template, invite } = inviteData!;
  const registerHref = `/company/register?invite_token=${encodeURIComponent(token)}`;

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
                    onClick={() =>
                      openModal("template-preview", <TemplatePreviewContent template={template} close={() => closeModal("template-preview")} />, {
                        title: template.name,
                        panelClassName: "!w-full sm:!max-w-4xl",
                        contentClassName: "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                        showHeaderDivider: true,
                      })
                    }
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
              ) : (
                <>
                  <p className="text-sm text-gray-700">
                    Your company already has an account.
                  </p>
                  {loginError && (
                    <p className="text-destructive rounded-[0.33em] bg-red-50 px-3 py-2 text-sm">
                      {loginError}
                    </p>
                  )}
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => loginViaInvite.mutate({ data: { token } })}
                    disabled={loginViaInvite.isPending}
                  >
                    {loginViaInvite.isPending && <Loader2 className="animate-spin" />}
                    {loginViaInvite.isPending ? "Signing in…" : email_status === "registered_verified" ? "Sign MOA" : "Continue"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

      </div>

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
