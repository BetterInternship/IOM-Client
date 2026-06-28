"use client";
import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { preconfiguredAxios } from "@/preconfig.axios";

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
}

/** Shared platform-verification state for the company (banner + request gate). */
export function useCompanyVerification(enabled = true) {
  return useQuery({
    queryKey: ["company-verification"],
    queryFn: async () => {
      const res = await preconfiguredAxios.get("/api/company/verification");
      return res.data as CompanyVerification;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function CompanyProfileProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["company-me"],
    queryFn: async () => {
      const res = await preconfiguredAxios.get("/api/company/me");
      return res.data.company as CompanyProfile;
    },
    retry: false,
    staleTime: Infinity,
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
    <CompanyProfileContext.Provider value={{ company: data ?? null, isLoading }}>
      {children}
    </CompanyProfileContext.Provider>
  );
}
