"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  FileText,
  Link2Off,
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
import { useModal } from "@/app/providers/modal-provider";
import { toastPresets } from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import { documentLabel, REQUIRED_DOCUMENT_TYPES } from "@/lib/document-types";
import { formatDateWithoutTime } from "@/lib/utils";

function RequiredDocumentsList() {
  return (
    <ul className="space-y-1.5">
      {REQUIRED_DOCUMENT_TYPES.map((type) => (
        <li
          key={type}
          className="flex items-center gap-2 text-sm text-[#121d3d]"
        >
          <FileText
            className="text-muted-foreground h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          {documentLabel(type)}
        </li>
      ))}
    </ul>
  );
}

function RequiredDocumentsModal({ onProceed }: { onProceed: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        To be able to partner with a university, you'll be asked to upload the following documents:
      </p>
      <RequiredDocumentsList />
      <p className="text-destructive text-sm font-bold">
        Please ensure you have these files on-hand.
      </p>
      <Button className="w-full" onClick={onProceed}>
        Proceed
      </Button>
    </div>
  );
}

const CAREER_UNREACHABLE_MESSAGE =
  'Your account is ready, but we couldn\'t reach BetterInternship just now — use the "Post a listing" button on your dashboard to continue.';

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
  documents_complete: boolean;
}

interface ExpiredInviteError extends ApiError {
  university?: Pick<
    InviteData["university"],
    "id" | "registered_name" | "logo_url"
  > | null;
}

function InvitePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const modal = useIomModalRegistry();
  const { openModal, closeModal } = useModal();
  const token = searchParams.get("token") ?? "";
  const [loginError, setLoginError] = useState("");
  // Set the instant sign-in-via-invite succeeds, before the queryClient.clear()
  // below wipes the invite-resolve query this page is still reading from —
  // without it, the page re-renders into its "invite not found" fallback for
  // a frame while the redirect (or the listing career-link handoff) is still
  // in flight.
  const [completingInvite, setCompletingInvite] = useState(false);

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
        setCompletingInvite(true);
        // Full clear, not a scoped invalidate — these query keys aren't
        // scoped by company id, so a prior session's cache in this same
        // browser could otherwise leak into this account.
        queryClient.clear();
        if (response.kind === "listing") {
          // Seeds the employer name from the university's legacy-record hint
          // (plan §12) — this account may have no registered_name yet.
          careerListingLink.mutate({
            data: { displayName: inviteData?.company_name ?? undefined },
          });
          return;
        }
        router.replace(
          `/invite/continue?invite_id=${encodeURIComponent(response.invite_id)}`,
        );
      },
      onError: (error: Error) => setLoginError(error.message),
    },
  });

  const { data, isLoading, error } = useInviteControllerResolveCompanyInvite(
    { token },
    { query: { enabled: !!token, retry: false } },
  );
  const inviteData = data as unknown as InviteData | undefined;
  // §5.6 — a cancelled invite's token resolves to a distinguishable
  // INVITE_WITHDRAWN error carrying its own message, rather than the
  // generic expired/bogus-token copy.
  const apiError = error as ExpiredInviteError | null;
  const isWithdrawn = apiError?.code === "INVITE_WITHDRAWN";
  const isExpired = apiError?.code === "INVITE_EXPIRED";

  if ((isExpired || isWithdrawn) && apiError?.university) {
    const university = apiError.university;
    const title = isExpired ? "Invitation expired" : "Invitation withdrawn";
    const message = isExpired
      ? "Please ask the university to send a new invitation."
      : apiError.message;
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
          </section>

          <div className="mt-8 border-y border-slate-200 py-6">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                <CalendarDays className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 text-left">
                <p className="font-semibold text-[#121d3d]">{title}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-5">
                  {message}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Button asChild size="lg" className="w-full" variant="outline">
              <Link href="/login">Sign in to your company account</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!completingInvite && (!token || (!isLoading && (error || !inviteData)))) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-xl bg-white px-5 py-8 backdrop-blur-[2px] sm:px-0 md:bg-transparent md:py-12 md:backdrop-blur-none">
          <section className="text-center">
            <span className="mx-auto flex size-24 items-center justify-center rounded-full bg-slate-100 text-slate-500 sm:size-28">
              <Link2Off className="size-10" aria-hidden="true" />
            </span>
          </section>

          <div className=" border-slate-200 py-6">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <p className="font-semibold text-[#121d3d]">
                  {!token ? "Invalid invite link" : "Invite not found"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-5">
                  {!token
                    ? "This invite link is missing required information."
                    : "This invite link may have expired or already been used."}
                </p>
              </div>
            </div>
          </div>

          {token && !isWithdrawn && (
            <Button asChild size="lg" className="mt-8 w-full" variant="outline">
              <Link href="/login">Sign in to your company account</Link>
            </Button>
          )}
        </div>
      </main>
    );
  }

  if (isLoading || completingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-primary size-8 animate-spin" />
      </div>
    );
  }

  const {
    company_name,
    email_status,
    university,
    template,
    invite,
    kind,
    documents_complete,
  } = inviteData!;
  const registerHref = `/company/register?invite_token=${encodeURIComponent(token)}`;
  const companyLabel = company_name || "Your company";
  const isListing = kind === "listing";
  const isMoa = kind === "moa";

  // Flow spec §11 — a heads-up shown right when they try to accept,
  // not on page load, so it doesn't compete with the rest of the page.
  const openRequiredDocumentsModal = (onProceed: () => void) => {
    openModal(
      "invite-required-documents",
      <RequiredDocumentsModal
        onProceed={() => {
          closeModal("invite-required-documents");
          onProceed();
        }}
      />,
      { title: "Prepare these documents", showHeaderDivider: false },
    );
  };

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

          {isMoa && (
            <div className="border-b border-slate-200 py-6 text-left">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Documents you&apos;ll need
              </p>
              <div className="mt-3">
                <RequiredDocumentsList />
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
              <Link
                href={registerHref}
                onClick={(e) => {
                  if (isMoa && !documents_complete) {
                    e.preventDefault();
                    openRequiredDocumentsModal(() =>
                      router.push(registerHref),
                    );
                  }
                }}
              >
                Accept invitation
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                const proceed = () =>
                  loginViaInvite.mutate({ data: { token } });
                if (isMoa && !documents_complete) {
                  openRequiredDocumentsModal(proceed);
                } else {
                  proceed();
                }
              }}
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
