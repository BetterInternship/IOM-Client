"use client";
import { createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAdminControllerOverview } from "@/app/api";

interface AdminProfileCtx {
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AdminProfileContext = createContext<AdminProfileCtx>({ isAuthenticated: false, isLoading: true });

export function useAdminProfile() {
  return useContext(AdminProfileContext);
}

export function AdminProfileProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { isLoading, isError, isSuccess } = useAdminControllerOverview({
    query: { retry: false, staleTime: Infinity },
  });

  // pathname is the browser URL path — on subdomain routing it won't carry the /admin prefix.
  const onAuthPage = pathname.startsWith("/admin/login") || pathname === "/login";
  const loginRedirect = pathname.startsWith("/admin/") ? "/admin/login" : "/login";
  if (isError && !onAuthPage) {
    router.replace(loginRedirect);
  }

  return (
    <AdminProfileContext.Provider value={{ isAuthenticated: isSuccess, isLoading }}>
      {children}
    </AdminProfileContext.Provider>
  );
}
