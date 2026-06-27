import { QueryProvider } from "@/app/providers/query-provider";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
