import { QueryProvider } from "@/app/providers/query-provider";
import { UniversityProfileProvider } from "@/app/providers/university-profile.provider";

export default function UniversityLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <UniversityProfileProvider>
        {children}
      </UniversityProfileProvider>
    </QueryProvider>
  );
}
