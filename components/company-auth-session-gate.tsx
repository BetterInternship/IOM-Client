"use client";

import { type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import { AuthShell } from "@/components/auth-shell";

export function CompanyAuthSessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { company, isLoading } = useCompanyProfile();

  useEffect(() => {
    if (company && !isLoading) router.replace("/company/dashboard");
  }, [company, isLoading, router]);

  if (isLoading || company) {
    return (
      <AuthShell
        portal="Company"
        title="Opening Partners"
        variant="split"
        splitFlush
        description="Checking your existing session."
      >
        <div className="flex justify-center py-4">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      </AuthShell>
    );
  }

  return children;
}
