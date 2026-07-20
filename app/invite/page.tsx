"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  FileText,
  Loader2,
  Quote,
} from "lucide-react";

import {
  useCompanyAuthControllerLoginViaInvite,
  useCompanyControllerCareerListingLink,
  useInviteControllerResolveCompanyInvite,
} from "@/app/api";
import type { ApiError } from "@/app/api/preconfig.axios";
import { getCareerHireUrl } from "@/components/career-listing-cta";
import { useIomModalRegistry } from "@/components/modal-registry";
import { toastPresets } from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import { formatDateWithoutTime } from "@/lib/utils";

const CAREER_UNREACHABLE_MESSAGE =
  "Your account is ready, but we couldn't reach BetterInternship just now — use the \"Post a listing\" button on your dashboard to continue.";

interface InviteData {
  email: string;
  company_name: string | null;
  email_status:
    | "not_registered"
    | "registered_unverified"
    | "registered_verified";
  university: {
    id: string;
    registered_name: string;
    address: string | null;
    logo_url: string | null;
  };
  template: {
    id: string;
    name: string;
    description: string | null;
    term_months: number | null;
  } | null;
  invite: { personal_message: string | null; expires_at: string };
  kind: "moa" | "listing";
  tin_hint: string | null;
}

function InvitePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modal = useIomModalRegistry();
  const token = searchParams.get("token") ?? "";
  const [loginError, setLoginError] = useState("");

  // Listing-invite handoff after sign-in — no MOA modal, straight to
  // create-listing (mirrors career-listing-cta.tsx's conflict handling).
  const careerListingLink = useCompanyControllerCareerListingLink({
    mutation: {
      onSuccess: (data) => {
        if (data.magicLink) {
          window.location.href = data.magicLink;
        } else {
          toast(CAREER_UNREACHABLE_MESSAGE, toastPresets.destructive);
          router.replace("/company/dashboard");
        }
      },
      onError: (e: Error) => {
        const error = e as ApiError;
        if (
          error.code === "EMAIL_MANAGES_OTHER_EMPLOYER" &&
          error.email &&
          error.autoLinkToken
        ) {
          const url = new URL("/login", getCareerHireUrl());
          url.searchParams.set("email", error.email);
          url.searchParams.set("auto_link", error.autoLinkToken);
          window.location.href = url.toString();
          return;
        }
        toast(CAREER_UNREACHABLE_MESSAGE, toastPresets.destructive);
        router.replace("/company/dashboard");
      },
    },
  });

  const loginViaInvite = useCompanyAuthControllerLoginViaInvite({
    mutation: {
      onSuccess: (response) => {
        if (response.kind === "listing") {
          careerListingLink.mutate();
          return;
        }
        const params = new URLSearchParams();
        params.set("open_university_id", response.university_id);
        if (response.template_id)
          params.set("template_id", response.template_id);
        if (response.invite_id) params.set("invite_id", response.invite_id);
        router.replace(`/company/dashboard?${params}`);
      },
      onError: (error: Error) => setLoginError(error.message),
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
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-8 py-7 text-center shadow-lg backdrop-blur-sm">
          <p className="text-lg font-semibold text-slate-950">
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
        <Loader2 className="text-primary size-8 animate-spin" />
      </div>
    );
  }

  const { company_name, email_status, university, template, invite, kind } =
    inviteData!;
  const registerHref = `/company/register?invite_token=${encodeURIComponent(token)}`;
  const companyLabel = company_name || "Your company";
  const isListing = kind === "listing";

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
      <div className="w-full max-w-md rounded-xl bg-white px-5 py-8 backdrop-blur-[2px] sm:px-0 md:bg-transparent md:py-12 md:backdrop-blur-none">
        <section className="text-center">
          {university.logo_url && (
            // University logos are user-uploaded external assets.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={university.logo_url}
              alt={`${university.registered_name} logo`}
              className="mx-auto size-24 object-contain sm:size-28"
            />
          )}

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#121d3d] sm:text-3xl">
            {university.registered_name}
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-sm text-base leading-7 sm:text-lg">
            invites{" "}
            <strong className="font-semibold text-primary">
              {companyLabel}
            </strong>{" "}
            {isListing
              ? "to post internship listings on BetterInternship."
              : "to establish an internship partnership."}
          </p>
        </section>

        <div className="mt-8 border-t border-slate-200">
          {template && (
            <div className="flex items-center gap-4 border-b border-slate-200 py-6">
              <span className="bg-primary/5 text-primary flex size-14 shrink-0 items-center justify-center rounded-full">
                <FileText className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Document
                </p>
                <p className="mt-1 font-semibold text-[#121d3d]">
                  {template.name}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {template.term_months == null
                    ? "Perpetual  •  No expiry"
                    : `${template.term_months} months`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => modal.previewTemplate.open(template)}
                className="text-primary hidden shrink-0 cursor-pointer items-center gap-2 text-sm font-medium hover:underline sm:flex"
              >
                Preview template
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {template && (
            <button
              type="button"
              onClick={() => modal.previewTemplate.open(template)}
              className="text-primary flex w-full cursor-pointer items-center justify-center gap-2 border-b border-slate-200 py-3 text-sm font-medium sm:hidden"
            >
              Preview template
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          )}

          {invite.personal_message && (
            <div className="flex items-center gap-4 border-b border-slate-200 py-6">
              <span className="bg-primary/5 text-primary flex size-14 shrink-0 items-center justify-center rounded-full">
                <Quote className="size-7 fill-current" aria-hidden="true" />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Message from {university.registered_name}
                </p>
                <p className="mt-2 whitespace-pre-line text-base leading-6 text-[#121d3d]">
                  “{invite.personal_message}”
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          {loginError && (
            <p className="text-destructive mb-3 rounded-md bg-red-50 px-3 py-2 text-sm">
              {loginError}
            </p>
          )}

          {email_status === "not_registered" ? (
            <Button size="lg" className="w-full" asChild>
              <Link href={registerHref}>
                Accept invitation
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={() => loginViaInvite.mutate({ data: { token } })}
              disabled={loginViaInvite.isPending || careerListingLink.isPending}
            >
              {loginViaInvite.isPending || careerListingLink.isPending
                ? "Signing in…"
                : "Accept invitation"}
              {loginViaInvite.isPending || careerListingLink.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowRight aria-hidden="true" />
              )}
            </Button>
          )}
          <p className="text-muted-foreground mt-3 text-center text-sm">
            {isListing
              ? "You'll set up your account and can start posting right away."
              : "You'll be able to review the agreement before signing."}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function CompanyInvitePage() {
  return (
    <div className="min-h-screen bg-[url('/invite/invite-bg-mobile.png')] bg-cover bg-center md:bg-[url('/invite/invite-bg.png')]">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="text-primary size-8 animate-spin" />
          </div>
        }
      >
        <InvitePageContent />
      </Suspense>
    </div>
  );
}
