"use client";
import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { preconfiguredAxios } from "@/preconfig.axios";

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

  const { isLoading, isError, isSuccess } = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => {
      const res = await preconfiguredAxios.get("/api/admin/overview");
      return res.data;
    },
    retry: false,
    staleTime: Infinity,
  });

  if (isError && !pathname.startsWith("/admin/login")) {
    router.replace("/admin/login");
  }

  return (
    <AdminProfileContext.Provider value={{ isAuthenticated: isSuccess, isLoading }}>
      {children}
    </AdminProfileContext.Provider>
  );
}
