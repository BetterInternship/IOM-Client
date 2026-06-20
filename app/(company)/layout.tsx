import { QueryProvider } from "@/app/providers/query-provider";
import { CompanyProfileProvider } from "@/app/providers/company-profile.provider";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <CompanyProfileProvider>
        {children}
      </CompanyProfileProvider>
    </QueryProvider>
  );
}
