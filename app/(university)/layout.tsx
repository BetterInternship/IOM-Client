import { QueryProvider } from "@/app/providers/query-provider";
import { UniversityProfileProvider } from "@/app/providers/university-profile.provider";
import { UniversityHeader } from "./university-header";

export default function UniversityLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <UniversityProfileProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <UniversityHeader />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </UniversityProfileProvider>
    </QueryProvider>
  );
}
