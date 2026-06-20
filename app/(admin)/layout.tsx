import { QueryProvider } from "@/app/providers/query-provider";
import { AdminProfileProvider } from "@/app/providers/admin-profile.provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AdminProfileProvider>
        {children}
      </AdminProfileProvider>
    </QueryProvider>
  );
}
