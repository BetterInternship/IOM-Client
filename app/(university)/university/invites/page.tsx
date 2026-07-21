"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import {
  UniversityInvitesTable,
  type CompanyInvite,
} from "@/components/university/university-invites-table";
import {
  UniversityRenewalsTable,
  type UniversityRenewal,
} from "@/components/university/university-renewals-table";
import Link from "next/link";
import { Plus } from "lucide-react";

interface AvailableTemplate {
  id: string;
  template: { id: string; name: string };
  is_available: boolean;
}

export default function InvitesPage() {
  const { account } = useUniversityProfile();
  const { openModal, closeModal } = useModal();
  const modal = useIomModalRegistry();
  const [activeTab, setActiveTab] = useState<"listing" | "moa" | "renewals">("moa");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["university-invites"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/invites")
        .then((r) => r.data as { invites: CompanyInvite[] }),
    enabled: !!account,
  });

  const { data: renewalsData, isLoading: isRenewalsLoading } = useQuery({
    queryKey: ["university-renewals"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/renewals")
        .then((r) => r.data as { renewals: UniversityRenewal[] }),
    enabled: !!account,
  });

  const { data: templatesData } = useQuery({
    queryKey: ["university-templates-for-invite"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/templates")
        .then((r) => r.data as { templates: AvailableTemplate[] }),
    enabled: !!account,
  });
  const availableTemplates = (templatesData?.templates ?? []).filter(
    (t) => t.is_available,
  );

  // Blank invites (no specific company row context) are moa-only — listing
  // invites only ever originate from a Partners-page row — so this button
  // still needs an active template to have anything to invite with.
  const handleInviteClick = () => {
    if (availableTemplates.length === 0) {
      openModal(
        "no-templates",
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You need at least one active MOA template before you can invite
            companies. Go to your templates page to activate one.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => closeModal("no-templates")}
            >
              Cancel
            </Button>
            <Button asChild>
              <Link href="/templates">Go to Templates</Link>
            </Button>
          </div>
        </div>,
        {
          title: "No active templates",
          panelClassName: "!w-full sm:!max-w-sm",
        },
      );
    } else {
      modal.inviteCompany.open({ onSent: () => refetch() });
    }
  };

  const invites = data?.invites ?? [];
  const listingInvites = invites.filter((invite) => invite.kind === "listing");
  const moaInvites = invites.filter((invite) => invite.kind === "moa");

  if (!account) return null;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Company Invites"
        description="Track and manage invitations sent to companies."
      >
        <Button onClick={handleInviteClick}>
          <Plus /> Invite company
        </Button>
      </PageHeader>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "listing" | "moa" | "renewals")}
      >
        <TabsList>
          <TabsTrigger value="moa">
            <span className="hidden sm:inline">invites to sign MOA</span>
            <span className="sm:hidden">MOA invites</span>
          </TabsTrigger>
          <TabsTrigger value="listing">
            <span className="hidden sm:inline">invites to post internship</span>
            <span className="sm:hidden">Listing invites</span>
          </TabsTrigger>
          <TabsTrigger value="renewals">Renewals</TabsTrigger>
        </TabsList>
        <TabsContent value="moa">
          <UniversityInvitesTable invites={moaInvites} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="listing">
          <UniversityInvitesTable invites={listingInvites} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="renewals">
          <UniversityRenewalsTable
            renewals={renewalsData?.renewals ?? []}
            isLoading={isRenewalsLoading}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
