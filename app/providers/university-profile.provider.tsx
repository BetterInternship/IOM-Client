"use client";
import { createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUniversityControllerMe } from "@/app/api";

interface UniversityAccount {
  id: string;
  university_id: string;
  email: string;
  display_name: string;
  role: "superadmin" | "staff";
  is_deactivated: boolean | null;
  university: {
    id: string;
    registered_name: string;
    logo_url: string | null;
    address: string | null;
    rep_name: string | null;
    rep_title: string | null;
    rep_signature_url: string | null;
  };
}

interface UniversityProfileCtx {
  account: UniversityAccount | null;
  isLoading: boolean;
  isSuperadmin: boolean;
}

const UniversityProfileContext = createContext<UniversityProfileCtx>({
  account: null,
  isLoading: true,
  isSuperadmin: false,
});

export function useUniversityProfile() {
  return useContext(UniversityProfileContext);
}

export function UniversityProfileProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { data, isLoading, isError } = useUniversityControllerMe({
    query: { retry: false, staleTime: Infinity },
  });

  // pathname is the browser URL path — on subdomain routing it won't carry the /university prefix.
  const onAuthPage =
    pathname.startsWith("/university/login") ||
    pathname.startsWith("/university/accept-invite") ||
    pathname === "/login" ||
    pathname === "/accept-invite";
  const loginRedirect = pathname.startsWith("/university/") ? "/university/login" : "/login";
  if (isError && !onAuthPage) {
    router.replace(loginRedirect);
  }

  return (
    <UniversityProfileContext.Provider
      value={{ account: (data?.account as UniversityAccount) ?? null, isLoading, isSuperadmin: data?.account?.role === "superadmin" }}
    >
      {children}
    </UniversityProfileContext.Provider>
  );
}
