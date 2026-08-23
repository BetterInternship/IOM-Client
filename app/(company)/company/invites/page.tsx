"use client";
import { useRouter } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { useCompanyControllerListPendingInvites } from "@/app/api";
import {
  PageContainer,
  PageHeader,
  EmptyState,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyProfileStatusNotice } from "@/components/company/company-profile-status-notice";
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
  const router = useRouter();
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: verificationLoading } =
    useCompanyVerification(!!company);
  const status = verification?.status;

  const { data, isLoading: invitesLoading } =
    useCompanyControllerListPendingInvites({
      query: { enabled: !!company },
    });

  const invites = (data?.invites ?? []).filter(
    (inv) => inv.university !== null,
  );

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
        title="Incoming MOA Invitations"
        description="MOA invitations from universities for your company to sign."
      />

      {/* "Incomplete" already has a persistent notice in the header on
          every page — showing it again here would duplicate it. "Pending"
          has no header equivalent, so it still belongs here. */}
      {status === "pending" && (
        <CompanyProfileStatusNotice status="pending" compactAttention />
      )}

      {invitesLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : invites.length === 0 ? (
        <EmptyState
          title="No incoming MOA invitations"
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
                  onClick={() =>
                    router.push(`/invite/continue?invite_id=${invite.id}`)
                  }
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
