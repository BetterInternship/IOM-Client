"use client";
import { createContext, useContext, useEffect } from "react";
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
    signatories: UniversitySignatoryFields[] | null;
  };
}

interface UniversitySignatoryFields {
  id: string;
  name: string;
  title: string;
  signatureUrl?: string;
}

interface UniversityProfileCtx {
  account: UniversityAccount | null;
  isLoading: boolean;
  isSuperadmin: boolean;
  isSetupComplete: boolean;
}

const UniversityProfileContext = createContext<UniversityProfileCtx>({
  account: null,
  isLoading: true,
  isSuperadmin: false,
  isSetupComplete: false,
});

type UniversitySetupFields = {
  registered_name: string | null | undefined;
  address: string | null | undefined;
  rep_name: string | null | undefined;
  rep_title: string | null | undefined;
  rep_signature_url: string | null | undefined;
  signatories: UniversitySignatoryFields[] | null | undefined;
};

const MIN_SIGNATORIES = 2;
const MAX_SIGNATORIES = 5;

export function isUniversitySetupComplete(
  university: UniversitySetupFields | null | undefined,
) {
  const signatories = Array.isArray(university?.signatories)
    ? university!.signatories
    : [];
  const signatoriesComplete =
    signatories.length >= MIN_SIGNATORIES &&
    signatories.length <= MAX_SIGNATORIES &&
    signatories.every(
      (s) =>
        !!s?.id &&
        !!s?.name?.trim() &&
        !!s?.title?.trim() &&
        !!s?.signatureUrl?.trim(),
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
      isSuperadmin &&
      !isSetupComplete
    ) {
      router.replace(completeProfileRedirect);
    }
  }, [
    completeProfileRedirect,
    isError,
    isLoading,
    isSetupComplete,
    isSuperadmin,
    onAuthPage,
    onCompleteProfilePage,
    router,
  ]);

  return (
    <UniversityProfileContext.Provider
      value={{ account, isLoading, isSuperadmin, isSetupComplete }}
    >
      {children}
    </UniversityProfileContext.Provider>
  );
}
