"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { formatDateWithoutTime } from "@/lib/utils";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { Loader2, Plus } from "lucide-react";

interface CompanyInvite {
  id: string;
  invited_email: string;
  company_name: string | null;
  template_id: string | null;
  template_name: string | null;
  personal_message: string | null;
  status: "pending" | "accepted" | "expired" | "used_waiting";
  created_at: string;
  expires_at: string;
  registered_company: { registered_name: string } | null;
}

interface AvailableTemplate {
  id: string;
  template: { id: string; name: string };
  is_available: boolean;
}

function InviteStatusBadge({ status }: { status: CompanyInvite["status"] }) {
  if (status === "accepted") return <Badge type="supportive">Accepted</Badge>;
  if (status === "used_waiting") return <Badge type="warning">Registered — awaiting MOA</Badge>;
  if (status === "expired") return <Badge type="destructive">Expired</Badge>;
  return <Badge type="default">Pending</Badge>;
}

function InviteModal({
  isSuperadmin,
  onClose,
  onSent,
}: {
  isSuperadmin: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data: templatesData } = useQuery({
    queryKey: ["university-templates-for-invite"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/templates")
        .then((r) => r.data as { templates: AvailableTemplate[] }),
    enabled: isSuperadmin,
  });

  const availableTemplates = (templatesData?.templates ?? []).filter((t) => t.is_available);

  const send = useMutation({
    mutationFn: () =>
      preconfiguredAxios
        .post("/api/university/invites", {
          invitedEmail: email.trim(),
          companyName: companyName.trim() || undefined,
          templateId: templateId || undefined,
          personalMessage: message.trim() || undefined,
        })
        .then((r) => r.data as { superseded: boolean; message: string }),
    onSuccess: (res) => {
      toast(
        res.superseded
          ? "Invite sent. A previous pending invite to this email was superseded."
          : "Invite sent.",
        toastPresets.success,
      );
      onSent();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a company</DialogTitle>
          <DialogDescription>
            The company will receive an email with a link to register and sign a MOA with your
            university.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-company-name">Company name</Label>
            <Input
              id="invite-company-name"
              placeholder="Acme Corporation"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Company email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              spellCheck={false}
              placeholder="rep@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {isSuperadmin && availableTemplates.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="invite-template">MOA template (optional)</Label>
              <select
                id="invite-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="border-input bg-background focus:ring-ring w-full rounded-[0.33em] border px-3 py-2 text-sm focus:outline-none focus:ring-1"
              >
                <option value="">No specific template</option>
                {availableTemplates.map((t) => (
                  <option key={t.template.id} value={t.template.id}>
                    {t.template.name}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                If specified, the company will be directed to this template.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="invite-message">Personal message (optional)</Label>
            <Textarea
              id="invite-message"
              rows={3}
              placeholder="Add a note to the company…"
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-muted-foreground text-right text-xs">{message.length}/500</p>
          </div>

          {error && (
            <p className="text-destructive rounded-[0.33em] bg-red-50 px-3 py-2 text-sm">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setError("");
              send.mutate();
            }}
            disabled={!companyName.trim() || !email.trim() || send.isPending}
          >
            {send.isPending && <Loader2 className="animate-spin" />}
            {send.isPending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function resolveDisplayName(invite: CompanyInvite): string {
  const registeredName =
    (invite.status === "accepted" || invite.status === "used_waiting") &&
    invite.registered_company
      ? invite.registered_company.registered_name
      : null;
  if (registeredName) {
    return invite.company_name && invite.company_name !== registeredName
      ? `${registeredName} (${invite.company_name})`
      : registeredName;
  }
  return invite.company_name ?? invite.invited_email;
}

export default function InvitesPage() {
  const { account, isSuperadmin } = useUniversityProfile();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["university-invites"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/invites")
        .then((r) => r.data as { invites: CompanyInvite[] }),
    enabled: !!account,
  });

  const invites = data?.invites ?? [];

  const columns = useMemo<ColumnDef<CompanyInvite>[]>(
    () => [
      {
        id: "company",
        header: "Company",
        accessorFn: resolveDisplayName,
        cell: ({ row }) => {
          const name = resolveDisplayName(row.original);
          const showEmail = name !== row.original.invited_email;
          return (
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">{name}</p>
              {showEmail && (
                <p className="text-muted-foreground truncate text-xs">{row.original.invited_email}</p>
              )}
            </div>
          );
        },
      },
      {
        id: "template",
        header: "Template",
        accessorFn: (row) => row.template_name ?? "—",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.template_name ?? "—"}
          </span>
        ),
      },
      {
        id: "validity",
        header: "Validity",
        accessorFn: (row) => `${formatDateWithoutTime(row.created_at)} – ${formatDateWithoutTime(row.expires_at)}`,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDateWithoutTime(row.original.created_at)} – {formatDateWithoutTime(row.original.expires_at)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => <InviteStatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  if (!account) return null;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Company Invites"
        description="Track and manage invitations sent to companies."
      >
        <Button onClick={() => setShowInviteModal(true)}>
          <Plus /> Invite company
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          id="invites"
          columns={columns}
          data={invites}
          searchKey="company"
          searchPlaceholder="Search by company…"
          rowLabelSingular="invite"
          rowLabelPlural="invites"
        />
      )}

      {showInviteModal && (
        <InviteModal
          isSuperadmin={isSuperadmin}
          onClose={() => setShowInviteModal(false)}
          onSent={() => refetch()}
        />
      )}
    </PageContainer>
  );
}
