"use client";
import { useState } from "react";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { useCompanyControllerListPendingInvites } from "@/app/api";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestDialog } from "@/components/moa-request-dialog";

interface DialogState {
  universityId: string;
  templateId: string | null;
  inviteId: string;
}

export default function CompanyInvitesPage() {
  const { company, isLoading } = useCompanyProfile();
  const { data: verification } = useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  const { data, isLoading: invitesLoading } = useCompanyControllerListPendingInvites({
    query: { enabled: !!company },
  });

  const invites = (data?.invites ?? []).filter((inv) => inv.university !== null);

  if (isLoading) {
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

      {invitesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : invites.length === 0 ? (
        <EmptyState
          title="No pending invitations"
          description="When a university invites you to sign a MOA, it will appear here."
        />
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <Card
              key={invite.id}
              className="gap-2 border-primary/30 bg-primary/5 px-5 py-4"
            >
              <p className="text-sm font-medium text-gray-900">
                MOA invitation from {invite.university!.registered_name}
              </p>
              {invite.template && (
                <p className="text-muted-foreground text-sm">
                  Template: {invite.template.name}
                </p>
              )}
              <div className="pt-1">
                <Button
                  size="sm"
                  onClick={() =>
                    setDialogState({
                      universityId: invite.university!.id,
                      templateId: invite.template?.id ?? null,
                      inviteId: invite.id,
                    })
                  }
                >
                  Sign MOA
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {dialogState && (
        <RequestDialog
          universityId={dialogState.universityId}
          defaultTemplateId={dialogState.templateId}
          inviteId={dialogState.inviteId}
          verified={verified}
          onClose={() => setDialogState(null)}
        />
      )}
    </PageContainer>
  );
}
