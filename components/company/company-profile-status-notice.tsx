"use client";

import type { KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ClipboardList, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusNotice } from "@/components/ui/status-notice";

type CompanyProfileNoticeStatus =
  | "incomplete"
  | "pending"
  | "rejected"
  | "expired";

function CompanyProfileStatusNotice({
  status,
  rejectionReason,
  compactAttention = false,
}: {
  status: CompanyProfileNoticeStatus;
  rejectionReason?: string | null;
  compactAttention?: boolean;
}) {
  const router = useRouter();
  const profileHref =
    status === "incomplete" ? "/complete-profile" : "/profile";
  const navigateToProfile = () => router.push(profileHref);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToProfile();
    }
  };

  if (status === "incomplete") {
    return (
      <StatusNotice
        icon={ClipboardList}
        title="Finish setting up your account"
        description="You can sign and queue MOA requests now, but they won't be issued until you complete your profile and the platform team approves your company."
        variant="warning"
        role="alert"
        tabIndex={0}
        className="cursor-pointer"
        onClick={navigateToProfile}
        onKeyDown={handleKeyDown}
        actionClassName="sm:flex sm:w-52 sm:justify-end"
        action={
          <Button asChild variant="outline" scheme="primary" expandIcon>
            <Link
              href="/complete-profile"
              onClick={(event) => event.stopPropagation()}
            >
              <ClipboardList aria-hidden="true" />
              <span className="button-label">Complete profile</span>
            </Link>
          </Button>
        }
      />
    );
  }

  if (status === "pending") {
    return (
      <StatusNotice
        icon={Clock}
        title="Pending approval"
        description="You can submit MOA requests now. They'll be queued and issued automatically once the platform team verifies your company."
        variant="warning"
        role="alert"
        tabIndex={0}
        className="cursor-pointer"
        onClick={navigateToProfile}
        onKeyDown={handleKeyDown}
      />
    );
  }

  const expired = status === "expired";
  return (
    <StatusNotice
      compact={compactAttention}
      icon={AlertCircle}
      title={expired ? "Verification expired" : "Verification needs attention"}
      description={
        <>
          {expired
            ? "Your company verification has expired."
            : rejectionReason ||
              "Your company could not be verified. Please review your profile and documents."}{" "}
          New MOA requests will stay queued until you are approved.{" "}
          <Link
            href="/profile#documents"
            className="text-primary underline"
            onClick={(event) => event.stopPropagation()}
          >
            Update profile
          </Link>
          .
        </>
      }
      variant="destructive"
      role="alert"
      tabIndex={compactAttention ? undefined : 0}
      className={compactAttention ? undefined : "cursor-pointer"}
      onClick={compactAttention ? undefined : navigateToProfile}
      onKeyDown={compactAttention ? undefined : handleKeyDown}
    />
  );
}

export { CompanyProfileStatusNotice, type CompanyProfileNoticeStatus };
