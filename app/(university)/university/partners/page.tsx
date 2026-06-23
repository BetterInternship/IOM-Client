"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { SideTabs, type SideTab } from "@/components/side-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { MoaStatusBadge } from "@/components/status-badge";
import { formatDateWithoutTime } from "@/lib/utils";
import { ArrowLeft, Ban, ClipboardCheck, Loader2, Users2 } from "lucide-react";

interface MoaSummary {
  id: string;
  created_at: string;
  company: { id: string; display_name: string; registered_name: string | null };
  template: { name: string };
}

interface Partner {
  company: {
    id: string;
    display_name: string;
    registered_name: string | null;
    company_type: string | null;
  };
  latestMoaId: string;
  detailsChanged: boolean;
}

interface BlacklistEntry {
  id: string;
  company_id: string;
  reason: string | null;
  created_at: string;
  actor_email: string | null;
  company: { id: string; display_name: string; registered_name: string | null };
}

interface PartnerMoaEntry {
  id: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  effective_date: string;
  expiry_date: string;
  rejection_reason: string | null;
  is_expired: boolean | null;
  template: { name: string } | null;
}

const HASH_TO_TAB: Record<string, string> = {
  "#review-queue": "review",
  "#active-partners": "active",
  "#blacklist": "blacklist",
};

const TAB_TO_HASH: Record<string, string> = {
  review: "#review-queue",
  active: "#active-partners",
  blacklist: "#blacklist",
};

const reviewQueueColumns: ColumnDef<MoaSummary>[] = [
  {
    id: "company",
    header: "Company",
    accessorFn: (row) => row.company.display_name,
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-gray-900">{row.original.company.display_name}</p>
        {row.original.company.registered_name &&
          row.original.company.registered_name !== row.original.company.display_name && (
            <p className="text-muted-foreground text-xs">{row.original.company.registered_name}</p>
          )}
      </div>
    ),
  },
  {
    id: "template",
    header: "Template",
    accessorFn: (row) => row.template.name,
  },
  {
    id: "requested",
    header: "Requested",
    accessorFn: (row) => row.created_at,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDateWithoutTime(row.original.created_at)}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: () => <Badge type="warning">Pending</Badge>,
  },
];

// ── Review queue ─────────────────────────────────────────────────────────────
function ReviewQueuePanel() {
  const { account } = useUniversityProfile();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["university-review-queue"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/review-queue")
        .then((r) => r.data as { moas: MoaSummary[] }),
    enabled: !!account,
    refetchInterval: 30_000,
  });

  const moas = data?.moas ?? [];

  if (isLoading)
    return (
      <div className="space-y-1">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );

  return (
    <DataTable
      id="review-queue"
      columns={reviewQueueColumns}
      data={moas}
      searchKey="company"
      searchPlaceholder="Search by company or template..."
      rowLabelSingular="request"
      rowLabelPlural="requests"
      onRowClick={(moa) => router.push(`/university/moas/${moa.id}`)}
    />
  );
}

// ── Active partners ──────────────────────────────────────────────────────────
function ActivePartnersPanel() {
  const { account } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [blacklistTarget, setBlacklistTarget] = useState<Partner | null>(null);
  const [reason, setReason] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const { data: partnersData, isLoading } = useQuery({
    queryKey: ["university-partners"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/partners")
        .then((r) => r.data as { partners: Partner[] }),
    enabled: !!account,
  });

  const { data: blacklistData } = useQuery({
    queryKey: ["university-blacklist"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/blacklist")
        .then((r) => r.data as { blacklist: BlacklistEntry[] }),
    enabled: !!account,
  });

  const { data: partnerMoasData, isLoading: isMoasLoading } = useQuery({
    queryKey: ["university-partner-moas", selectedCompanyId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/university/partners/${selectedCompanyId}/moas`)
        .then(
          (r) => r.data as { company: Partner["company"]; moas: PartnerMoaEntry[] },
        ),
    enabled: !!selectedCompanyId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["university-partners"] });
    queryClient.invalidateQueries({ queryKey: ["university-blacklist"] });
    queryClient.invalidateQueries({ queryKey: ["university-review-queue"] });
    queryClient.invalidateQueries({ queryKey: ["university-audit"] });
  };

  const blacklistMutation = useMutation({
    mutationFn: ({ companyId, reason }: { companyId: string; reason: string }) =>
      preconfiguredAxios.post("/api/university/blacklist", {
        companyId,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      refresh();
      setBlacklistTarget(null);
      setReason("");
      setSelectedCompanyId(null);
    },
  });

  const blacklistedIds = new Set((blacklistData?.blacklist ?? []).map((b) => b.company_id));
  const partners = (partnersData?.partners ?? []).filter(
    (p) => !blacklistedIds.has(p.company.id),
  );

  const listColumns = useMemo<ColumnDef<Partner>[]>(
    () => [
      {
        id: "company",
        header: "Company",
        accessorFn: (row) => row.company.display_name,
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{row.original.company.display_name}</p>
              {row.original.detailsChanged && (
                <Badge type="warning" strength="medium">
                  Details changed
                </Badge>
              )}
            </div>
            {row.original.company.registered_name && (
              <p className="text-muted-foreground text-xs">
                {row.original.company.registered_name}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => row.company.company_type?.replace(/_/g, " ") ?? "—",
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableResizing: false,
        size: 120,
        cell: ({ row }) => (
          <Button
            variant="outline"
            scheme="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setBlacklistTarget(row.original);
            }}
          >
            Blacklist
          </Button>
        ),
      },
    ],
    [setBlacklistTarget],
  );

  const moaHistoryColumns = useMemo<ColumnDef<PartnerMoaEntry>[]>(
    () => [
      {
        id: "template",
        header: "Template",
        accessorFn: (row) => row.template?.name ?? "—",
        cell: ({ row }) => (
          <span className="font-medium text-gray-900">{row.original.template?.name ?? "—"}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="whitespace-normal">
            {row.original.status === "active" && !row.original.reviewed_at ? (
              <Badge type="warning">Pending review</Badge>
            ) : (
              <MoaStatusBadge status={row.original.status} isExpired={row.original.is_expired} />
            )}
            {row.original.rejection_reason && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {row.original.rejection_reason}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "requested",
        header: "Requested",
        accessorFn: (row) => row.created_at,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDateWithoutTime(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "period",
        header: "Period",
        accessorFn: (row) => row.effective_date ?? "",
        cell: ({ row }) =>
          row.original.effective_date ? (
            <span className="text-muted-foreground">
              {formatDateWithoutTime(row.original.effective_date)} –{" "}
              {formatDateWithoutTime(row.original.expiry_date)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  const BlacklistDialog = (
    <Dialog
      open={!!blacklistTarget}
      onOpenChange={(o) => {
        if (!o) {
          setBlacklistTarget(null);
          setReason("");
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Blacklist company</DialogTitle>
          <DialogDescription>{blacklistTarget?.company.display_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="border-destructive/30 bg-destructive/5 text-destructive space-y-1 rounded-[0.33em] border p-3 text-sm">
            <p>
              This immediately <strong>revokes all active MOAs</strong> with this company and blocks
              new requests.
            </p>
            <p className="text-destructive/80 text-xs">
              Revoked MOAs cannot be restored. The company is not notified. This action is logged
              under your name.
            </p>
          </div>
          <Textarea
            rows={2}
            placeholder="Internal reason (optional — never shown to the company)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setBlacklistTarget(null);
              setReason("");
            }}
          >
            Cancel
          </Button>
          <Button
            scheme="destructive"
            disabled={blacklistMutation.isPending}
            onClick={() =>
              blacklistTarget &&
              blacklistMutation.mutate({ companyId: blacklistTarget.company.id, reason })
            }
          >
            {blacklistMutation.isPending && <Loader2 className="animate-spin" />}
            {blacklistMutation.isPending ? "Blacklisting…" : "Blacklist company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selectedCompanyId) {
    const company = partnerMoasData?.company;
    const moas = partnerMoasData?.moas ?? [];
    const partner = partners.find((p) => p.company.id === selectedCompanyId);

    return (
      <div
        key={selectedCompanyId}
        className="animate-in slide-in-from-right duration-200 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setSelectedCompanyId(null)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Active Partners
          </button>
          {partner && (
            <Button
              variant="outline"
              scheme="destructive"
              size="sm"
              onClick={() => setBlacklistTarget(partner)}
            >
              Blacklist
            </Button>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-gray-900">{company?.display_name ?? "—"}</h3>
          {(company?.registered_name || company?.company_type) && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {company.registered_name}
              {company.company_type && ` · ${company.company_type.replace(/_/g, " ")}`}
            </p>
          )}
        </div>

        {isMoasLoading ? (
          <div className="space-y-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <DataTable
            id={`partner-moas-${selectedCompanyId}`}
            columns={moaHistoryColumns}
            data={moas}
            searchKey="template"
            searchPlaceholder="Search MOAs..."
            rowLabelSingular="MOA"
            rowLabelPlural="MOAs"
            onRowClick={(moa) => router.push(`/university/moas/${moa.id}`)}
          />
        )}

        {BlacklistDialog}
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <>
      {isLoading ? (
        <div className="space-y-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          id="active-partners"
          columns={listColumns}
          data={partners}
          searchKey="company"
          searchPlaceholder="Search by company..."
          rowLabelSingular="partner"
          rowLabelPlural="partners"
          onRowClick={(partner) => setSelectedCompanyId(partner.company.id)}
        />
      )}
      {BlacklistDialog}
    </>
  );
}

// ── Blacklist ────────────────────────────────────────────────────────────────
function BlacklistPanel() {
  const { account } = useUniversityProfile();
  const queryClient = useQueryClient();
  const [unblacklistTarget, setUnblacklistTarget] = useState<BlacklistEntry | null>(null);

  const { data: blacklistData, isLoading } = useQuery({
    queryKey: ["university-blacklist"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/blacklist")
        .then((r) => r.data as { blacklist: BlacklistEntry[] }),
    enabled: !!account,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["university-partners"] });
    queryClient.invalidateQueries({ queryKey: ["university-blacklist"] });
    queryClient.invalidateQueries({ queryKey: ["university-review-queue"] });
    queryClient.invalidateQueries({ queryKey: ["university-audit"] });
  };

  const unblacklistMutation = useMutation({
    mutationFn: (companyId: string) =>
      preconfiguredAxios.delete(`/api/university/blacklist/${companyId}`),
    onSuccess: () => {
      refresh();
      setUnblacklistTarget(null);
    },
  });

  const blacklist = blacklistData?.blacklist ?? [];

  const blacklistColumns = useMemo<ColumnDef<BlacklistEntry>[]>(
    () => [
      {
        id: "company",
        header: "Company",
        accessorFn: (row) => row.company.display_name,
        cell: ({ row }) => (
          <span className="font-medium text-gray-900">{row.original.company.display_name}</span>
        ),
      },
      {
        id: "reason",
        header: "Reason",
        accessorFn: (row) => row.reason ?? "—",
      },
      {
        id: "by",
        header: "Blacklisted by",
        accessorFn: (row) => row.actor_email ?? "—",
      },
      {
        id: "date",
        header: "Date",
        accessorFn: (row) => row.created_at,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDateWithoutTime(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableResizing: false,
        size: 120,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setUnblacklistTarget(row.original);
            }}
          >
            Un-blacklist
          </Button>
        ),
      },
    ],
    [setUnblacklistTarget],
  );

  return (
    <>
      {isLoading ? (
        <div className="space-y-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          id="blacklist"
          columns={blacklistColumns}
          data={blacklist}
          searchKey="company"
          searchPlaceholder="Search by company..."
          rowLabelSingular="entry"
          rowLabelPlural="entries"
        />
      )}

      <AlertDialog
        open={!!unblacklistTarget}
        onOpenChange={(o) => !o && setUnblacklistTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {unblacklistTarget?.company.display_name} from the blacklist?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This re-enables future requests from this company. Previously revoked MOAs will not be
              restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                unblacklistTarget && unblacklistMutation.mutate(unblacklistTarget.company_id)
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function PartnersPage() {
  const { account, isLoading } = useUniversityProfile();
  const [tab, setTab] = useState("review");

  useEffect(() => {
    const matched = HASH_TO_TAB[window.location.hash];
    if (matched) setTab(matched);
  }, []);

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    window.history.replaceState(null, "", TAB_TO_HASH[newTab] ?? "");
  };

  const { data: queueData } = useQuery({
    queryKey: ["university-review-queue"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/review-queue")
        .then((r) => r.data as { moas: MoaSummary[] }),
    enabled: !!account,
    refetchInterval: 30_000,
  });
  const pending = queueData?.moas?.length ?? 0;

  if (isLoading || !account) return null;

  const tabs: SideTab[] = [
    {
      key: "review",
      label: "Review Queue",
      icon: ClipboardCheck,
      badge: pending ? (
        <Badge type="warning" strength="medium">
          {pending}
        </Badge>
      ) : undefined,
    },
    { key: "active", label: "Active Partners", icon: Users2 },
    { key: "blacklist", label: "Blacklist", icon: Ban },
  ];

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Partners"
        description="Review requests, manage active partners, and control your blacklist."
      />
      <SideTabs tabs={tabs} active={tab} onChange={handleTabChange}>
        {tab === "review" && <ReviewQueuePanel />}
        {tab === "active" && <ActivePartnersPanel />}
        {tab === "blacklist" && <BlacklistPanel />}
      </SideTabs>
    </PageContainer>
  );
}
