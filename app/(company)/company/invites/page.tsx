"use client";
import Link from "next/link";
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
import { RequestDialog } from "@/components/moa-request-dialog";
import { ArrowRight } from "lucide-react";

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
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: verificationLoading } =
    useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const canRequestMoa = verified || verification?.status === "pending";
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

  if (!canRequestMoa) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          title="Invitations"
          description="Universities that have invited your company to sign a MOA."
        />
        <Card className="border-warning/30 bg-warning/10 p-4 text-sm text-gray-700">
          {verification?.status === "expired"
            ? "Your verification has expired. Replace a required document and submit it for approval before requesting an MOA."
            : verification?.rejectionReason ||
              "Your company must be approved before requesting an MOA."}
          {(verification?.status === "expired" ||
            verification?.status === "rejected") && (
            <Link
              href="/profile#documents"
              className="text-primary ml-1 underline"
            >
              Update documents
            </Link>
          )}
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Invitations"
        description="Universities that have invited your company to sign a MOA."
      />

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
