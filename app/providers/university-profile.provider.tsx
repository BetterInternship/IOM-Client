"use client";
import { createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUniversityControllerMe } from "@/app/api";
import { universitySignatoriesComplete } from "@/lib/profile-validation";

interface UniversityAccount {
  id: string;
  university_id: string;
  email: string;
  display_name: string;
  role: "superadmin" | "admin" | "staff";
  is_deactivated: boolean | null;
  university: {
    id: string;
    registered_name: string;
    logo_url: string | null;
    address: string | null;
    signatories: UniversitySignatoryFields[] | null;
    account_holder_name: string | null;
    account_holder_title: string | null;
  };
}
interface UniversitySignatoryFields {
  id: string;
  name: string;
  title: string;
  signatureUrl?: string;
  signatureText?: string;
  signatureType?: string;
  email?: string;
}

interface UniversityProfileCtx {
  account: UniversityAccount | null;
  isLoading: boolean;
  isSuperadmin: boolean;
  canManageUniversity: boolean;
  isSetupComplete: boolean;
}

const UniversityProfileContext = createContext<UniversityProfileCtx>({
  account: null,
  isLoading: true,
  isSuperadmin: false,
  canManageUniversity: false,
  isSetupComplete: false,
});

type UniversitySetupFields = {
  registered_name: string | null | undefined;
  address: string | null | undefined;
  signatories: UniversitySignatoryFields[] | null | undefined;
};

export function isUniversitySetupComplete(
  university: UniversitySetupFields | null | undefined,
) {
  const signatoriesComplete = universitySignatoriesComplete(
    university?.signatories,
  );
  return Boolean(
    university?.registered_name?.trim() &&
    university.address?.trim() &&
    signatoriesComplete,
  );
}

export function useUniversityProfile() {
  return useContext(UniversityProfileContext);
}

export function UniversityProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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
  const onCompleteProfilePage =
    pathname.startsWith("/university/complete-profile") ||
    pathname === "/complete-profile";
  const loginRedirect = "/login";
  const account = (data?.account as UniversityAccount) ?? null;
  const isSuperadmin = account?.role === "superadmin";
  const canManageUniversity =
    account?.role === "superadmin" || account?.role === "admin";
  const isSetupComplete = isUniversitySetupComplete(account?.university);
  const completeProfileRedirect = "/complete-profile";

  useEffect(() => {
    if (isError && !onAuthPage) router.replace(loginRedirect);
  }, [isError, loginRedirect, onAuthPage, router]);

  useEffect(() => {
    if (
      !onAuthPage &&
      !onCompleteProfilePage &&
      !isError &&
      !isLoading &&
      canManageUniversity &&
      !isSetupComplete
    ) {
      router.replace(completeProfileRedirect);
    }
  }, [
    completeProfileRedirect,
    isError,
    isLoading,
    isSetupComplete,
    canManageUniversity,
    onAuthPage,
    onCompleteProfilePage,
    router,
  ]);

  return (
    <UniversityProfileContext.Provider
      value={{ account, isLoading, isSuperadmin, canManageUniversity, isSetupComplete }}
    >
      {children}
    </UniversityProfileContext.Provider>
  );
}
