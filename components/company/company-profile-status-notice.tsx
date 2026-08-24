"use client";

import type { KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ClipboardList, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusNotice } from "@/components/ui/status-notice";
import { documentLabel } from "@/lib/document-types";

// Rejected and expired are reasons attached to "incomplete" now, not
// separate statuses (flow spec §1) — this is the same state wearing a
// different banner.
type CompanyProfileNoticeStatus = "incomplete" | "pending";

function CompanyProfileStatusNotice({
  status,
  reason,
  documentRejections,
  expiredDocument,
  compactAttention = false,
}: {
  status: CompanyProfileNoticeStatus;
  reason?: "rejected" | "expired" | null;
  documentRejections?: Record<string, string> | null;
  expiredDocument?: string | null;
  compactAttention?: boolean;
}) {
  const router = useRouter();
  // Pending: documents are already complete, nothing to upload — send them
  // to the read-only profile instead of the verification gate.
  const navigateToProfile = () => router.push("/profile");
  const navigateToVerification = () => router.push("/verification");
  const keyDownTo = (navigate: () => void) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate();
    }
  };

  if (status === "pending") {
    return (
      <StatusNotice
        icon={Clock}
        title="Pending approval"
        description="You can request MOAs now — they'll issue automatically once the platform team verifies your company."
        variant="warning"
        role="alert"
        tabIndex={0}
        className="cursor-pointer"
        onClick={navigateToProfile}
        onKeyDown={keyDownTo(navigateToProfile)}
      />
    );
  }

  // status === "incomplete"
  if (reason === "rejected") {
    const entries = Object.entries(documentRejections ?? {});
    return (
      <StatusNotice
        compact={compactAttention}
        icon={AlertCircle}
        title="Verification needs attention"
        description={
          entries.length ? (
            <ul className="space-y-1">
              {entries.map(([type, docReason]) => (
                <li key={type}>
                  <span className="font-medium text-gray-800">
                    {documentLabel(type)}:
                  </span>{" "}
                  {docReason}
                </li>
              ))}
            </ul>
          ) : (
            "Your company could not be verified. Please review your documents."
          )
        }
        action={
          <Button
            asChild
            variant="outline"
            scheme="destructive"
            expandIcon
            className="w-full bg-transparent sm:bg-background"
          >
            <Link
              href="/verification"
              onClick={(event) => event.stopPropagation()}
            >
              <ClipboardList aria-hidden="true" />
              <span className="button-label">Update documents</span>
            </Link>
          </Button>
        }
        variant="destructive"
        role="alert"
        tabIndex={compactAttention ? undefined : 0}
        className={compactAttention ? undefined : "cursor-pointer"}
        onClick={compactAttention ? undefined : navigateToVerification}
        onKeyDown={compactAttention ? undefined : keyDownTo(navigateToVerification)}
      />
    );
  }

  if (reason === "expired") {
    return (
      <StatusNotice
        compact={compactAttention}
        icon={AlertCircle}
        title="Verification lapsed"
        description={
          expiredDocument
            ? `Your ${documentLabel(expiredDocument)} expired. Upload a current one to restore verification.`
            : "A document on file has expired. Upload a current one to restore verification."
        }
        action={
          <Button
            asChild
            variant="outline"
            scheme="destructive"
            expandIcon
            className="w-full bg-transparent sm:bg-background"
          >
            <Link
              href="/verification"
              onClick={(event) => event.stopPropagation()}
            >
              <ClipboardList aria-hidden="true" />
              <span className="button-label">Update documents</span>
            </Link>
          </Button>
        }
        variant="destructive"
        role="alert"
        tabIndex={compactAttention ? undefined : 0}
        className={compactAttention ? undefined : "cursor-pointer"}
        onClick={compactAttention ? undefined : navigateToVerification}
        onKeyDown={compactAttention ? undefined : keyDownTo(navigateToVerification)}
      />
    );
  }

  // reason absent — first run, nothing uploaded yet
  return (
    <StatusNotice
      icon={ClipboardList}
      title="Finish setting up your account"
      description="Upload your three required documents to start requesting MOAs."
      variant="warning"
      role="alert"
      tabIndex={0}
      className="cursor-pointer"
      onClick={navigateToVerification}
      onKeyDown={keyDownTo(navigateToVerification)}
      actionClassName="sm:flex sm:w-52 sm:justify-end"
      action={
        <Button
          asChild
          variant="outline"
          scheme="primary"
          expandIcon
          className="w-full bg-transparent sm:bg-background"
        >
          <Link
            href="/verification"
            onClick={(event) => event.stopPropagation()}
          >
            <ClipboardList aria-hidden="true" />
            <span className="button-label">Upload documents</span>
          </Link>
        </Button>
      }
    />
  );
}

export { CompanyProfileStatusNotice, type CompanyProfileNoticeStatus };
