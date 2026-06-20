"use client";
import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { preconfiguredAxios } from "@/preconfig.axios";

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

  const { data, isLoading, isError } = useQuery({
    queryKey: ["university-me"],
    queryFn: async () => {
      const res = await preconfiguredAxios.get("/api/university/me");
      return res.data.account as UniversityAccount;
    },
    retry: false,
    staleTime: Infinity,
  });

  if (isError && !pathname.startsWith("/university/login") && !pathname.startsWith("/university/accept-invite")) {
    router.replace("/university/login");
  }

  return (
    <UniversityProfileContext.Provider
      value={{ account: data ?? null, isLoading, isSuperadmin: data?.role === "superadmin" }}
    >
      {children}
    </UniversityProfileContext.Provider>
  );
}
