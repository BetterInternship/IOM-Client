"use client";
import { createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCompanyControllerMe, useCompanyControllerGetVerification } from "@/app/api";

interface CompanyProfile {
  id: string;
  tin: string;
  email: string;
  registered_name: string;
  company_type: string | null;
  registered_address: string | null;
  cosmetic: Record<string, unknown>;
  is_deactivated: boolean | null;
}

interface CompanyProfileCtx {
  company: CompanyProfile | null;
  isLoading: boolean;
}

const CompanyProfileContext = createContext<CompanyProfileCtx>({ company: null, isLoading: true });

export function useCompanyProfile() {
  return useContext(CompanyProfileContext);
}

export type VerificationStatus = "incomplete" | "pending" | "verified" | "expired" | "rejected";

export interface CompanyVerification {
  status: VerificationStatus;
  rejectionReason: string | null;
  canPostListing: boolean;
}

/** Shared platform-verification state for the company (banner + request gate). */
export function useCompanyVerification(enabled = true) {
  const { data, ...rest } = useCompanyControllerGetVerification({
    query: { enabled, staleTime: 30_000 },
  });
  return { data: data as CompanyVerification | undefined, ...rest };
}

export function CompanyProfileProvider({ children }: { children: React.ReactNode }) {
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
  const onProfilePage = pathname.startsWith("/company/profile");
  const loginRedirect = pathname.startsWith("/company/") ? "/company/login" : "/login";
  if (isError && !onAuthPage) {
    router.replace(loginRedirect);
  }

  // Profile-completeness gate: redirect to profile if not yet filled in.
  const { data: verification } = useCompanyVerification(!onAuthPage && !isError && !isLoading);
  if (!onAuthPage && !onProfilePage && !isError && !isLoading && verification?.status === "incomplete") {
    router.replace("/company/profile");
  }

  return (
    <CompanyProfileContext.Provider value={{ company: (data?.company as CompanyProfile) ?? null, isLoading }}>
      {children}
    </CompanyProfileContext.Provider>
  );
}
