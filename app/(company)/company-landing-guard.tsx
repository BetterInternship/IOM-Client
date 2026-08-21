"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { PageContainer } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// While a required document is missing (fresh registration, a rejection, or
// a lapsed expiry), every route funnels back to the verification page
// except the three the company can still freely browse — the universities
// list (locked CTA), Invites, and the invite-continuation stepper, which
// has its own embedded documents step. /profile is deliberately NOT exempt
// here: it's the read-only-identity + document-replace page for a company
// that's already pending/verified, not the onboarding gate. Matched by
// suffix, not full path — subdomain routing drops the /company prefix (see
// company-header.tsx's own note).
const EXEMPT_SUFFIXES = [
  "/dashboard",
  "/invites",
  "/verification",
  "/invite/continue",
];

function GuardSkeleton() {
  return (
    <PageContainer className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-2.5">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </PageContainer>
  );
}

/**
 * The redirect can only happen once the verification fetch resolves,
 * client-side — there's no server-side hook for it (that would need the
 * auth cookie to reach this app's own host, which it currently isn't
 * scoped to). Until then, this renders a skeleton instead of `children`, so
 * a company that's about to be bounced never sees the real page underneath
 * flash into view first.
 */
export function CompanyLandingGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { company, isLoading: companyLoading } = useCompanyProfile();
  const { data: verification, isLoading: verificationLoading } =
    useCompanyVerification(!!company);

  const exempt = EXEMPT_SUFFIXES.some((suffix) => pathname.endsWith(suffix));
  const needsRedirect =
    !!company && !exempt && verification?.status === "incomplete";

  useEffect(() => {
    if (needsRedirect) router.replace("/verification");
  }, [needsRedirect, router]);

  // Exempt pages never need to wait on any of this. Everything else stays
  // on the skeleton until we positively know company+verification have
  // loaded and no redirect is needed — company alone isn't enough: without
  // also waiting on verificationLoading there's a window right after
  // company resolves, before its status is known, where this would render
  // the real page a beat early.
  const isChecking =
    !exempt &&
    (companyLoading || (!!company && verificationLoading) || needsRedirect);

  if (isChecking) return <GuardSkeleton />;
  return <>{children}</>;
}
