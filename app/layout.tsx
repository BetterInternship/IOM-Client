import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SonnerToaster } from "@/components/sonner-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Institutional MOA Platform",
  description: "MOA management between companies and universities",
  icons: { icon: "/BetterInternshipLogo.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TooltipProvider>
          <ThemeProvider>{children}</ThemeProvider>
          <SonnerToaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
