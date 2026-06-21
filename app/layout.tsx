import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SonnerToaster } from "@/components/sonner-toaster";

export const metadata: Metadata = {
  title: "BetterInternship IOM",
  description: "MOA management between companies and universities",
  icons: {
    icon: [{ url: "/BetterInternshipLogo.ico", sizes: "any" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
        <SonnerToaster />
      </body>
    </html>
  );
}
