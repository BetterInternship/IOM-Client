"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PAGE_NAMES: Record<string, string> = {
  "": "Home",
  dashboard: "Dashboard",
  partners: "Partners",
  universities: "Universities",
  companies: "Companies",
  invites: "Invites",
  templates: "MOA Templates",
  accounts: "Accounts",
  "activity-log": "Activity Log",
  profile: "Profile",
  reviews: "Company Reviews",
  login: "Sign In",
  register: "Register",
  "accept-invite": "Accept Invite",
};

function resolvePageName(pathname: string, portal: string) {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => !["company", "university", "admin"].includes(segment));

  if (segments.includes("moas") && segments.length > 1) return "MOA Details";
  if (segments.includes("review")) return "Company Review";
  if (segments.includes("legacy")) return "Imported Partner";
  if (segments.includes("registered")) return "Partner Details";
  if (segments[0] === "templates" && segments.length > 1)
    return "Template Editor";
  if (segments[0] === "companies" && segments.length > 1)
    return "Company Details";
  if (segments[0] === "universities" && segments.length > 1)
    return "University Details";

  return PAGE_NAMES[segments[0] ?? ""] ?? portal;
}

export function PortalDocumentTitle({ portal }: { portal: string }) {
  const pathname = usePathname() ?? "";
  const title = `${resolvePageName(pathname, portal)} · Partners | ${portal}`;

  useEffect(() => {
    const applyTitle = () => {
      if (document.title !== title) document.title = title;
    };

    applyTitle();
    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [title]);

  return null;
}
