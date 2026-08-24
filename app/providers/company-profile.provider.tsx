"use client";
import { createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  useCompanyControllerMe,
  useCompanyControllerGetVerification,
} from "@/app/api";

interface CompanyProfile {
  id: string;
  // Only bound at admin approval now — a fresh company has neither (plan §3).
  tin: string | null;
  email: string;
  registered_name: string | null;
  company_type: string | null;
  registered_address: string | null;
  cosmetic: Record<string, unknown>;
  is_deactivated: boolean | null;
}

interface CompanyProfileCtx {
  company: CompanyProfile | null;
  isLoading: boolean;
}

const CompanyProfileContext = createContext<CompanyProfileCtx>({
  company: null,
  isLoading: true,
});

export function useCompanyProfile() {
  return useContext(CompanyProfileContext);
}

// Rejected and expired are reasons attached to "incomplete" now, not
// separate statuses (flow spec §1) — the same state wearing a different
// banner.
export type VerificationStatus = "incomplete" | "pending" | "verified";
export type VerificationReason = "rejected" | "expired" | null;

export interface CompanyVerification {
  status: VerificationStatus;
  reason: VerificationReason;
  documentRejections: Record<string, string>;
  expiredDocument: string | null;
  canPostListing: boolean;
  approvalExpiresAt: string | null;
}

/** Shared platform-verification state for the company (banner + request gate). */
export function useCompanyVerification(enabled = true) {
  const { data, ...rest } = useCompanyControllerGetVerification({
    query: { enabled, staleTime: 30_000 },
  });
  return { data: data as CompanyVerification | undefined, ...rest };
}

export function CompanyProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const { data, isLoading, isError } = useCompanyControllerMe({
    query: { retry: false, staleTime: Infinity },
  });

  // Gate: redirect to login on 401 (isError catches axios 401).
  // pathname is the browser URL path — on subdomain routing it won't carry the /company prefix.
  const onAuthPage =
    pathname.startsWith("/company/login") ||
    pathname.startsWith("/company/register") ||
    pathname === "/login" ||
    pathname.startsWith("/register");
  const loginRedirect = "/login";

  useEffect(() => {
    if (isError && !onAuthPage) router.replace(loginRedirect);
  }, [isError, loginRedirect, onAuthPage, router]);

  return (
    <CompanyProfileContext.Provider
      value={{ company: (data?.company as CompanyProfile) ?? null, isLoading }}
    >
      {children}
    </CompanyProfileContext.Provider>
  );
}
