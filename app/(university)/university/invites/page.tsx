"use client";
import { useState } from "react";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import {
  useUniversityControllerListInvites,
  useUniversityControllerListRenewals,
  useUniversityControllerListTemplates,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ChevronDown, FileText, Megaphone, Plus } from "lucide-react";

function mapInviteStatus(status: string): CompanyInvite["status"] {
  switch (status) {
    case "accepted":
    case "expired":
    case "used_waiting":
      return status;
    default:
      return "pending";
  }
}

function InviteTabs({
  moaCount,
  listingCount,
  renewalCount,
}: {
  moaCount: number;
  listingCount: number;
  renewalCount: number;
}) {
  return (
    <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-none border-0 border-b border-gray-200 bg-transparent">
      <TabsTrigger
        value="moa"
        className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
      >
        MOA invites
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 group-data-[state=active]:bg-supportive group-data-[state=active]:text-supportive-foreground">
          {moaCount}
        </span>
      </TabsTrigger>
      <TabsTrigger
        value="renewals"
        className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
      >
        MOA Renewals
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 group-data-[state=active]:bg-supportive group-data-[state=active]:text-supportive-foreground">
          {renewalCount}
        </span>
      </TabsTrigger>
      <TabsTrigger
        value="listing"
        className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
      >
        Listing invites
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 group-data-[state=active]:bg-supportive group-data-[state=active]:text-supportive-foreground">
          {listingCount}
        </span>
      </TabsTrigger>
    </TabsList>
  );
}

export default function InvitesPage() {
  const { account } = useUniversityProfile();
  const { openModal, closeModal } = useModal();
  const modal = useIomModalRegistry();
  const [activeTab, setActiveTab] = useState<"listing" | "moa" | "renewals">(
    "moa",
  );

  const { data, isLoading, refetch } = useUniversityControllerListInvites({
    query: { enabled: !!account },
  });

  const { data: renewalsData, isLoading: isRenewalsLoading } =
    useUniversityControllerListRenewals({ query: { enabled: !!account } });

  const { data: templatesData } = useUniversityControllerListTemplates({
    query: { enabled: !!account },
  });
  const availableTemplates = (templatesData?.templates ?? []).filter(
    (t) => t.is_available,
  );

  // Blank invites (no specific company row context) are moa-only — listing
  // invites only ever originate from a Partners-page row — so this button
  // still needs an active template to have anything to invite with.
  const handleInviteClick = (kind: "moa" | "listing") => {
    if (kind === "moa" && availableTemplates.length === 0) {
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
      modal.inviteCompany.open({
        onSent: () => refetch(),
        initialKind: kind,
      });
    }
  };

  const invites: CompanyInvite[] = (data?.invites ?? []).map((invite) => ({
    ...invite,
    status: mapInviteStatus(invite.status),
  }));
  const listingInvites = invites.filter((invite) => invite.kind === "listing");
  const moaInvites = invites.filter((invite) => invite.kind === "moa");
  const renewals = renewalsData?.renewals ?? [];
  const inviteTabs = (
    <InviteTabs
      moaCount={moaInvites.length}
      listingCount={listingInvites.length}
      renewalCount={renewals.length}
    />
  );

  if (!account) return null;

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="Company Invites"
        description="Track and manage invitations sent to companies."
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus /> Invite company
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5">
            <DropdownMenuItem
              className="cursor-pointer items-start gap-3 px-3 py-2"
              onSelect={() => handleInviteClick("moa")}
            >
              <FileText className="mt-0.5 size-4 text-primary" />
              <span>
                <span className="block text-sm font-semibold text-gray-900">
                  Invite to sign a MOA
                </span>
                <span className="text-muted-foreground block text-xs">
                  Send an invitation to begin an MOA partnership
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer items-start gap-3 px-3 py-2"
              onSelect={() => handleInviteClick("listing")}
            >
              <Megaphone className="mt-0.5 size-4 text-primary" />
              <span>
                <span className="block text-sm font-semibold text-gray-900">
                  Invite to post an internship listing
                </span>
                <span className="text-muted-foreground block text-xs">
                  Send an invitation to post internship opportunities
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "listing" | "moa" | "renewals")
        }
      >
        <TabsContent value="moa">
          <UniversityInvitesTable
            invites={moaInvites}
            isLoading={isLoading}
            toolbarStart={inviteTabs}
          />
        </TabsContent>
        <TabsContent value="renewals">
          <UniversityRenewalsTable
            renewals={renewals}
            isLoading={isRenewalsLoading}
            toolbarStart={inviteTabs}
          />
        </TabsContent>
        <TabsContent value="listing">
          <UniversityInvitesTable
            invites={listingInvites}
            isLoading={isLoading}
            toolbarStart={inviteTabs}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
