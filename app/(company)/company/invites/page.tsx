"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { useModal } from "@/app/providers/modal-provider";
import { useCompanyControllerListPendingInvites } from "@/app/api";
import {
  PageContainer,
  PageHeader,
  EmptyState,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusNotice } from "@/components/ui/status-notice";
import { RequestDialog } from "@/components/moa-request-dialog";
import { AlertCircle, ArrowRight, ClipboardList, Clock } from "lucide-react";

function universityInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function CompanyInvitesPage() {
  const router = useRouter();
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: verificationLoading } =
    useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const status = verification?.status;
  const { openModal, closeModal } = useModal();

  const { data, isLoading: invitesLoading } =
    useCompanyControllerListPendingInvites({
      query: { enabled: !!company },
    });

  const invites = (data?.invites ?? []).filter(
    (inv) => inv.university !== null,
  );

  const openInviteDialog = (invite: (typeof invites)[number]) => {
    openModal(
      "request-moa",
      <RequestDialog
        universityId={invite.university!.id}
        defaultTemplateId={invite.template?.id ?? null}
        inviteId={invite.id}
        verified={verified}
        onClose={() => closeModal("request-moa")}
      />,
      {
        title: (
          <h2 className="text-2xl leading-snug font-semibold tracking-tight">
            Signing a MOA with{" "}
            <span className="text-primary">
              {invite.university!.registered_name}
            </span>
          </h2>
        ),
        panelClassName: "sm:!max-w-none",
        headerClassName: "request-moa-header",
        exitAnimation: "fade",
      },
    );
  };

  if (isLoading || verificationLoading) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </PageContainer>
    );
  }
  if (!company) return null;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Invitations"
        description="Universities that have invited your company to sign a MOA."
      />

      {!verified && status === "incomplete" && (
        <StatusNotice
          icon={ClipboardList}
          title="Finish setting up your account"
          description="You can sign and queue MOA requests now, but they won't be issued until you complete your profile and the platform team approves your company."
          variant="warning"
          role="alert"
          tabIndex={0}
          className="cursor-pointer"
          onClick={() => router.push("/complete-profile")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push("/complete-profile");
            }
          }}
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
      )}

      {!verified && status === "pending" && (
        <StatusNotice
          icon={Clock}
          title="Pending approval"
          description="You can submit MOA requests now. They'll be queued and issued automatically once the platform team verifies your company."
          variant="warning"
          role="alert"
          tabIndex={0}
          className="cursor-pointer"
          onClick={() => router.push("/profile")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push("/profile");
            }
          }}
        />
      )}

      {!verified &&
        status &&
        status !== "incomplete" &&
        status !== "pending" && (
        <StatusNotice
          compact
          icon={AlertCircle}
          title={
            status === "expired"
              ? "Verification expired"
              : "Verification needs attention"
          }
          description={
            <>
              You can sign and queue this MOA now. It will be issued after your
              company is approved.{" "}
              <Link
                href="/profile#documents"
                className="text-primary underline"
              >
                Update profile
              </Link>
              .
            </>
          }
          variant="destructive"
        />
        )}

      {invitesLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : invites.length === 0 ? (
        <EmptyState
          title="No pending invitations"
          description="When a university invites you to sign a MOA, it will appear here."
        />
      ) : (
        <div className="space-y-4">
          {invites.map((invite) => (
            <Card
              key={invite.id}
              className="grid gap-6 border-gray-200 bg-white p-6 transition-colors hover:border-gray-300 hover:bg-gray-50/40 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="flex min-w-0 items-center gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[0.33em] border border-gray-200 bg-gray-50 text-lg font-semibold text-gray-600 sm:h-20 sm:w-20">
                  <span aria-hidden="true">
                    {universityInitials(invite.university!.registered_name)}
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
                    {invite.university!.registered_name}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Invited your company to sign a{" "}
                    {invite.template?.name ?? "MOA"}
                  </p>
                </div>
              </div>

              <div className="md:justify-self-end">
                <Button
                  size="md"
                  className="w-full md:w-auto"
                  onClick={() => openInviteDialog(invite)}
                >
                  Sign MOA
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
