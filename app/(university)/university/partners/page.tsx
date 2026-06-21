"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { SideTabs, type SideTab } from "@/components/side-tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatDateWithoutTime } from "@/lib/utils";
import { Ban, Building2, ChevronRight, ClipboardCheck, Loader2, Users2 } from "lucide-react";

interface MoaSummary {
  id: string;
  created_at: string;
  effective_date: string;
  expiry_date: string;
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

// ── Review queue ─────────────────────────────────────────────────────────────
function ReviewQueuePanel() {
  const { account } = useUniversityProfile();
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

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (moas.length === 0) {
    return (
      <EmptyState
        title="All caught up"
        description="There are no pending MOA requests to review."
      />
    );
  }
  return (
    <div className="space-y-2.5">
      {moas.map((moa) => (
        <Link key={moa.id} href={`/university/moas/${moa.id}`} className="block">
          <Card className="flex-row items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-gray-50">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {moa.company.display_name}
                {moa.company.registered_name &&
                  moa.company.registered_name !== moa.company.display_name && (
                    <span className="text-muted-foreground ml-1 font-normal">
                      ({moa.company.registered_name})
                    </span>
                  )}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {moa.template.name} &middot; requested{" "}
                {formatDateWithoutTime(moa.created_at)}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              <Badge type="warning">Pending</Badge>
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// ── Active partners ──────────────────────────────────────────────────────────
function ActivePartnersPanel() {
  const { account } = useUniversityProfile();
  const { data, isLoading } = useQuery({
    queryKey: ["university-partners"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/partners")
        .then((r) => r.data as { partners: Partner[] }),
    enabled: !!account,
  });

  const partners = data?.partners ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (partners.length === 0) {
    return (
      <EmptyState
        title="No active partners yet"
        description="Confirmed MOAs will list the partner company here."
      />
    );
  }
  return (
    <div className="space-y-2.5">
      {partners.map(({ company, latestMoaId, detailsChanged }) => (
        <Link key={company.id} href={`/university/moas/${latestMoaId}`} className="block">
          <Card className="flex-row items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-gray-50">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-muted text-muted-foreground flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.33em]">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {company.display_name}
                  </p>
                  {detailsChanged && (
                    <Badge type="warning" strength="medium">
                      Details changed
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {company.registered_name}
                  {company.company_type &&
                    ` · ${company.company_type.replace(/_/g, " ")}`}
                </p>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          </Card>
        </Link>
      ))}
    </div>
  );
}

// ── Blacklist ────────────────────────────────────────────────────────────────
function BlacklistPanel() {
  const { account } = useUniversityProfile();
  const queryClient = useQueryClient();
  const [blacklistTarget, setBlacklistTarget] = useState<Partner | null>(null);
  const [reason, setReason] = useState("");
  const [unblacklistTarget, setUnblacklistTarget] =
    useState<BlacklistEntry | null>(null);

  const { data: partnersData } = useQuery({
    queryKey: ["university-partners"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/partners")
        .then((r) => r.data as { partners: Partner[] }),
    enabled: !!account,
  });

  const { data: blacklistData, isLoading: blLoading } = useQuery({
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
    },
  });

  const unblacklistMutation = useMutation({
    mutationFn: (companyId: string) =>
      preconfiguredAxios.delete(`/api/university/blacklist/${companyId}`),
    onSuccess: () => {
      refresh();
      setUnblacklistTarget(null);
    },
  });

  const partners = partnersData?.partners ?? [];
  const blacklist = blacklistData?.blacklist ?? [];
  const blacklistedIds = new Set(blacklist.map((b) => b.company_id));
  const eligiblePartners = partners.filter(
    (p) => !blacklistedIds.has(p.company.id)
  );

  return (
    <div className="space-y-8">
      {eligiblePartners.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Current partners
          </h2>
          <div className="space-y-2.5">
            {eligiblePartners.map(({ company }) => (
              <Card
                key={company.id}
                className="flex-row items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {company.display_name}
                  </p>
                  {company.registered_name && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {company.registered_name}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  scheme="destructive"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() =>
                    setBlacklistTarget({
                      company,
                      latestMoaId: "",
                      detailsChanged: false,
                    })
                  }
                >
                  Blacklist
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {blLoading && <Skeleton className="h-20 w-full" />}

      {!blLoading && blacklist.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Blacklisted ({blacklist.length})
          </h2>
          <div className="space-y-2.5">
            {blacklist.map((entry) => (
              <Card
                key={entry.id}
                className="border-destructive/20 bg-destructive/5 flex-row items-start justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {entry.company.display_name}
                  </p>
                  {entry.reason && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Reason: {entry.reason}
                    </p>
                  )}
                  {entry.actor_email && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      By {entry.actor_email} &middot;{" "}
                      {formatDateWithoutTime(entry.created_at)}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => setUnblacklistTarget(entry)}
                >
                  Un-blacklist
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {!blLoading && blacklist.length === 0 && eligiblePartners.length === 0 && (
        <EmptyState title="No companies to manage here yet" />
      )}

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
            <DialogDescription>
              {blacklistTarget?.company.display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="border-destructive/30 bg-destructive/5 text-destructive space-y-1 rounded-[0.33em] border p-3 text-sm">
              <p>
                This immediately <strong>revokes all active MOAs</strong> with this
                company and blocks new requests.
              </p>
              <p className="text-destructive/80 text-xs">
                Revoked MOAs cannot be restored. The company is not notified. This
                action is logged under your name.
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
                blacklistMutation.mutate({
                  companyId: blacklistTarget.company.id,
                  reason,
                })
              }
            >
              {blacklistMutation.isPending && <Loader2 className="animate-spin" />}
              {blacklistMutation.isPending ? "Blacklisting…" : "Blacklist company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              This re-enables future requests from this company. Previously revoked
              MOAs will not be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                unblacklistTarget &&
                unblacklistMutation.mutate(unblacklistTarget.company_id)
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PartnersPage() {
  const { account, isLoading } = useUniversityProfile();
  const [tab, setTab] = useState("review");

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
      <SideTabs tabs={tabs} active={tab} onChange={setTab}>
        {tab === "review" && <ReviewQueuePanel />}
        {tab === "active" && <ActivePartnersPanel />}
        {tab === "blacklist" && <BlacklistPanel />}
      </SideTabs>
    </PageContainer>
  );
}
