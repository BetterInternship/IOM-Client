import { CompanyProfileProvider } from "@/app/providers/company-profile.provider";
import { PortalDocumentTitle } from "@/components/portal-document-title";
import { CompanyHeader } from "./company-header";
import { CompanyLandingGuard } from "./company-landing-guard";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CompanyProfileProvider>
      <PortalDocumentTitle portal="Company" />
      <CompanyLandingGuard />
      <div className="flex min-h-screen flex-col">
        <CompanyHeader />
        {children}
      </div>
    </CompanyProfileProvider>
  );
}
