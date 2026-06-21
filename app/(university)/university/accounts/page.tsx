"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { SideTabs, type SideTab } from "@/components/side-tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FormError } from "@/components/auth-shell";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import { Loader2, Plus, ScrollText, Users2 } from "lucide-react";

interface StaffAccount {
  id: string;
  email: string;
  display_name: string;
  role: "superadmin" | "staff";
  is_deactivated: boolean | null;
  created_at: string;
}

interface AuditEvent {
  id: string;
  event_type: string;
  actor_email: string | null;
  detail: string | null;
  created_at: string;
  company?: { display_name: string } | null;
  moa?: { id: string } | null;
}

// ── Managed accounts (superadmin) ────────────────────────────────────────────
function InviteStaffDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const createStaff = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/university/accounts", {
        email,
        display_name: name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-accounts"] });
      toast.success("Invitation sent");
      setEmail("");
      setName("");
      setError("");
      setOpen(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError("");
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> Invite staff
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite staff member</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email to set their password and join your
            institution.
          </DialogDescription>
        </DialogHeader>
        <form
          id="invite-staff"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            createStaff.mutate();
          }}
          className="space-y-4"
        >
          <FormError>{error}</FormError>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="staff@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              placeholder="Juan Dela Cruz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="invite-staff"
            disabled={!email || !name || createStaff.isPending}
          >
            {createStaff.isPending && <Loader2 className="animate-spin" />}
            {createStaff.isPending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManagedAccountsPanel() {
  const { account } = useUniversityProfile();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["university-accounts"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/accounts")
        .then((r) => r.data as { accounts: StaffAccount[] }),
    enabled: !!account,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["university-accounts"] });

  const deactivate = useMutation({
    mutationFn: (id: string) =>
      preconfiguredAxios.patch(`/api/university/accounts/${id}/deactivate`),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const reactivate = useMutation({
    mutationFn: (id: string) =>
      preconfiguredAxios.patch(`/api/university/accounts/${id}/reactivate`),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const resendInvite = useMutation({
    mutationFn: (id: string) =>
      preconfiguredAxios.post(`/api/university/accounts/${id}/resend-invite`),
    onSuccess: () => toast.success("Invitation resent"),
    onError: (e: Error) => toast.error(e.message),
  });

  const staff = (data?.accounts ?? []).filter((a) => a.role === "staff");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <InviteStaffDialog />
      </div>
      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          title="No staff accounts yet"
          description="Invite your first staff member to help review requests."
        />
      ) : (
        <div className="space-y-2.5">
          {staff.map((a) => (
            <Card
              key={a.id}
              className="flex-row items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {a.display_name}
                  </p>
                  {a.is_deactivated && (
                    <Badge type="destructive" strength="medium">
                      Deactivated
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {a.email}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resendInvite.mutate(a.id)}
                  disabled={resendInvite.isPending}
                >
                  Resend invite
                </Button>
                {a.is_deactivated ? (
                  <Button
                    variant="outline"
                    scheme="supportive"
                    size="sm"
                    onClick={() => reactivate.mutate(a.id)}
                    disabled={reactivate.isPending}
                  >
                    Reactivate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    scheme="destructive"
                    size="sm"
                    onClick={() => deactivate.mutate(a.id)}
                    disabled={deactivate.isPending}
                  >
                    Deactivate
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity log (formerly Audit) ────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  request_received: "MOA request received",
  moa_confirmed: "MOA confirmed",
  moa_rejected: "MOA rejected",
  partner_details_changed: "Partner details changed",
  moa_revoked: "MOA revoked",
  company_blacklisted: "Company blacklisted",
  company_unblacklisted: "Company removed from blacklist",
};

const EVENT_TYPES: Record<string, BadgeProps["type"]> = {
  request_received: "primary",
  moa_confirmed: "supportive",
  moa_rejected: "destructive",
  partner_details_changed: "warning",
  moa_revoked: "destructive",
  company_blacklisted: "destructive",
  company_unblacklisted: "default",
};

function ActivityLogPanel() {
  const { account } = useUniversityProfile();
  const { data, isLoading } = useQuery({
    queryKey: ["university-audit"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/audit?limit=100")
        .then((r) => r.data as { logs: AuditEvent[] }),
    enabled: !!account,
  });

  const events = data?.logs ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (events.length === 0) {
    return <EmptyState title="No activity yet" />;
  }
  return (
    <div className="space-y-2.5">
      {events.map((ev) => (
        <Card key={ev.id} className="gap-1.5 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <Badge type={EVENT_TYPES[ev.event_type] ?? "default"}>
              {EVENT_LABELS[ev.event_type] ?? ev.event_type}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {formatDateTime(ev.created_at)}
            </span>
          </div>
          {ev.company && (
            <p className="text-sm text-gray-800">{ev.company.display_name}</p>
          )}
          {ev.detail && (
            <p className="text-muted-foreground text-xs">{ev.detail}</p>
          )}
          {ev.actor_email && (
            <p className="text-muted-foreground text-xs">By {ev.actor_email}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

const HASH_TO_TAB: Record<string, string> = {
  "#managed-accounts": "managed",
  "#activity-log": "activity",
};

const TAB_TO_HASH: Record<string, string> = {
  managed: "#managed-accounts",
  activity: "#activity-log",
};

export default function AccountsPage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const [tab, setTab] = useState("managed");

  useEffect(() => {
    const matched = HASH_TO_TAB[window.location.hash];
    if (matched) setTab(matched);
  }, []);

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    window.history.replaceState(null, "", TAB_TO_HASH[newTab] ?? "");
  };

  if (isLoading || !account) return null;

  if (!isSuperadmin) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          title="Activity Log"
          description="Review your institution's activity."
        />
        <ActivityLogPanel />
      </PageContainer>
    );
  }

  const tabs: SideTab[] = [
    { key: "managed", label: "Managed Accounts", icon: Users2 },
    { key: "activity", label: "Activity Log", icon: ScrollText },
  ];
  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Manage staff accounts and review your institution's activity."
      />
      <SideTabs tabs={tabs} active={active} onChange={handleTabChange}>
        {active === "managed" && <ManagedAccountsPanel />}
        {active === "activity" && <ActivityLogPanel />}
      </SideTabs>
    </PageContainer>
  );
}
