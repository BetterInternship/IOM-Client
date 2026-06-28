"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  DialogBottomSheet,
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
import { formatDateWithoutTime, cn } from "@/lib/utils";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { ArrowLeft, Eye, Loader2, Mail, Plus, ShieldCheck } from "lucide-react";

interface Partner {
  company: {
    id: string;
    display_name: string;
    registered_name: string | null;
    company_type: string | null;
  };
  latestMoaId: string;
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
  effective_date: string;
  expiry_date: string;
  is_expired: boolean | null;
  template: { name: string } | null;
}

type DocReviewDetails = Record<string, { type?: string; document?: string; value: string }>;

interface CompanyDoc {
  type: string;
  filename: string;
  url: string | null;
}

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  sec_dti_registration: "SEC/DTI Registration",
};

function VerifiedDocumentDetails({ details }: { details: DocReviewDetails }) {
  const entries = Object.entries(details).filter(([, v]) => v.value);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-0 rounded-[0.33em] border border-gray-200">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-700">
        <ShieldCheck className="h-3.5 w-3.5 text-supportive" />
        Verified details
      </div>
      <div className="divide-y divide-gray-100">
        {entries.map(([key, field]) => (
          <div key={key} className="flex items-center gap-4 px-3 py-2">
            <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">{key}</p>
            <p className="text-sm font-medium text-gray-900">{field.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsSection({ documents }: { documents: CompanyDoc[] }) {
  const [previewDoc, setPreviewDoc] = useState<CompanyDoc | null>(null);
  if (documents.length === 0) return null;
  const isImage = (filename: string) => /\.(png|jpe?g|gif|webp)$/i.test(filename);
  return (
    <>
      <div className="divide-y divide-gray-100 rounded-[0.33em] border border-gray-200">
        {documents.map((doc) => (
          <button
            key={doc.type}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-50"
            onClick={() => setPreviewDoc(doc)}
            disabled={!doc.url}
          >
            <Eye className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900">
              View {DOC_LABELS[doc.type] ?? doc.type.replace(/_/g, " ")}
            </span>
            {!doc.url && (
              <span className="text-muted-foreground ml-auto text-xs">Unavailable</span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogBottomSheet className="flex h-[88vh] flex-col p-0">
          <div className="flex items-center border-b border-gray-100 px-5 py-3.5 pr-14">
            <DialogTitle className="text-sm font-medium text-gray-900">
              {previewDoc
                ? (DOC_LABELS[previewDoc.type] ?? previewDoc.type.replace(/_/g, " "))
                : ""}
            </DialogTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {previewDoc?.url &&
              (isImage(previewDoc.filename) ? (
                <img
                  src={previewDoc.url}
                  alt={DOC_LABELS[previewDoc.type] ?? previewDoc.type}
                  className="h-full w-full object-contain"
                />
              ) : (
                <iframe
                  src={previewDoc.url}
                  className="h-full w-full border-none"
                  title={DOC_LABELS[previewDoc.type] ?? previewDoc.type}
                />
              ))}
          </div>
        </DialogBottomSheet>
      </Dialog>
    </>
  );
}

interface CombinedEntry {
  company: {
    id: string;
    display_name: string;
    registered_name: string | null;
    company_type: string | null;
  };
  latestMoaId: string | null;
  isBlacklisted: boolean;
  blacklistEntry: BlacklistEntry | null;
}

interface CompanyInvite {
  id: string;
  invited_email: string;
  company_name: string | null;
  status: "pending" | "accepted" | "expired";
  expires_at: string;
  template_id: string | null;
  personal_message: string | null;
  created_at: string;
}

interface AvailableTemplate {
  id: string;
  template: { id: string; name: string };
  is_available: boolean;
}

function InviteStatusBadge({ status }: { status: CompanyInvite["status"] }) {
  if (status === "accepted") return <Badge type="supportive">Accepted</Badge>;
  if (status === "expired") return <Badge type="destructive">Expired — not used</Badge>;
  return <Badge type="warning">Pending</Badge>;
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
      if (res.superseded) {
        toast(
          "Invite sent. A previous pending invite to this email was superseded.",
          toastPresets.success,
        );
      } else {
        toast("Invite sent.", toastPresets.success);
      }
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

// "list" and "detail" are stable states; "to-detail" / "to-list" are mid-transition.
type Phase = "list" | "to-detail" | "detail" | "to-list";

const ANIM_DURATION = 200;

export default function PartnersPage() {
  const { account, isLoading: profileLoading } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("list");
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [blacklistTarget, setBlacklistTarget] = useState<CombinedEntry | null>(null);
  const [unblacklistTarget, setUnblacklistTarget] = useState<CombinedEntry | null>(null);
  const [reason, setReason] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);

  const isSuperadmin = account?.role === "superadmin";

  const { data: invitesData, refetch: refetchInvites } = useQuery({
    queryKey: ["university-invites"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/invites")
        .then((r) => r.data as { invites: CompanyInvite[] }),
    enabled: !!account,
  });

  // Clean up timer on unmount.
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const { data: partnersData, isLoading: isPartnersLoading } = useQuery({
    queryKey: ["university-partners"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/partners")
        .then((r) => r.data as { partners: Partner[] }),
    enabled: !!account,
  });

  const { data: blacklistData, isLoading: isBlacklistLoading } = useQuery({
    queryKey: ["university-blacklist"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/blacklist")
        .then((r) => r.data as { blacklist: BlacklistEntry[] }),
    enabled: !!account,
  });

  const { data: partnerMoasData, isLoading: isMoasLoading } = useQuery({
    queryKey: ["university-partner-moas", currentCompanyId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/university/partners/${currentCompanyId}/moas`)
        .then((r) => r.data as { company: Partner["company"] & { document_review_details?: DocReviewDetails }; moas: PartnerMoaEntry[]; companyDocuments: CompanyDoc[] }),
    enabled: !!currentCompanyId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["university-partners"] });
    queryClient.invalidateQueries({ queryKey: ["university-blacklist"] });
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

  const combined = useMemo<CombinedEntry[]>(() => {
    const map = new Map<string, CombinedEntry>();
    for (const p of partnersData?.partners ?? []) {
      map.set(p.company.id, {
        company: p.company,
        latestMoaId: p.latestMoaId,
        isBlacklisted: false,
        blacklistEntry: null,
      });
    }
    for (const b of blacklistData?.blacklist ?? []) {
      const existing = map.get(b.company_id);
      if (existing) {
        existing.isBlacklisted = true;
        existing.blacklistEntry = b;
      } else {
        map.set(b.company_id, {
          company: { ...b.company, company_type: null },
          latestMoaId: null,
          isBlacklisted: true,
          blacklistEntry: b,
        });
      }
    }
    return [...map.values()];
  }, [partnersData, blacklistData]);

  const listColumns = useMemo<ColumnDef<CombinedEntry>[]>(
    () => [
      {
        id: "company",
        header: "Company",
        accessorFn: (row) => row.company.display_name,
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{row.original.company.display_name}</p>
              {row.original.isBlacklisted && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Blacklisted
                </span>
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
    ],
    [],
  );


  const navigateToDetail = (companyId: string) => {
    clearTimeout(timerRef.current);
    setCurrentCompanyId(companyId);
    setPhase("to-detail");
    timerRef.current = setTimeout(() => setPhase("detail"), ANIM_DURATION + 10);
  };

  const navigateToList = () => {
    clearTimeout(timerRef.current);
    setPhase("to-list");
    timerRef.current = setTimeout(() => {
      setPhase("list");
      setCurrentCompanyId(null);
    }, ANIM_DURATION + 10);
  };

  if (profileLoading || !account) return null;

  const isLoading = isPartnersLoading || isBlacklistLoading;
  const entry = combined.find((e) => e.company.id === currentCompanyId);
  const company = partnerMoasData?.company ?? entry?.company;
  const moas = partnerMoasData?.moas ?? [];

  // During "to-detail": list is in-flow (exiting left), detail is absolute (entering from right).
  // During "to-list":  detail is in-flow (exiting right), list is absolute (entering from left).
  const showList = phase !== "detail";
  const showDetail = phase !== "list";

  return (
    <PageContainer>
      {/* overflow-hidden clips the sliding panels; relative enables absolute children */}
      <div className="relative overflow-hidden">

        {/* ── List panel ───────────────────────────────────────────────────── */}
        {showList && (
          <div
            className={cn(
              "space-y-6",
              phase === "to-detail" &&
                `animate-out slide-out-to-left fade-out duration-${ANIM_DURATION}`,
              phase === "to-list" &&
                `absolute inset-x-0 top-0 animate-in slide-in-from-left fade-in duration-${ANIM_DURATION}`,
            )}
          >
            <PageHeader title="Partners" description="Manage your active partners and blacklist.">
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
                id="partners"
                columns={listColumns}
                data={combined}
                searchKey="company"
                searchPlaceholder="Search by company..."
                rowLabelSingular="partner"
                rowLabelPlural="partners"
                onRowClick={(e) => navigateToDetail(e.company.id)}
                getRowClassName={(row) => (row.isBlacklisted ? "bg-red-50" : undefined)}
              />
            )}

            {/* Invite history */}
            {(invitesData?.invites ?? []).length > 0 && (
              <div className="space-y-2 pt-4">
                <div className="flex items-center gap-2">
                  <Mail className="text-muted-foreground h-4 w-4" />
                  <h3 className="text-sm font-semibold text-gray-900">Company invites</h3>
                </div>
                <div className="divide-y divide-gray-100 overflow-hidden rounded-[0.33em] border border-gray-200">
                  {(invitesData?.invites ?? []).map((invite) => (
                    <div key={invite.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        {invite.company_name && (
                          <p className="truncate text-sm font-medium text-gray-900">
                            {invite.company_name}
                          </p>
                        )}
                        <p className={invite.company_name ? "text-muted-foreground truncate text-xs" : "truncate text-sm font-medium text-gray-900"}>
                          {invite.invited_email}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Sent {formatDateWithoutTime(invite.created_at)} · Expires{" "}
                          {formatDateWithoutTime(invite.expires_at)}
                        </p>
                      </div>
                      <InviteStatusBadge status={invite.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Detail panel ─────────────────────────────────────────────────── */}
        {showDetail && (
          <div
            className={cn(
              "space-y-4",
              phase === "to-detail" &&
                `absolute inset-x-0 top-0 animate-in slide-in-from-right fade-in duration-${ANIM_DURATION}`,
              phase === "to-list" &&
                `animate-out slide-out-to-right fade-out duration-${ANIM_DURATION}`,
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToList}
                className="text-muted-foreground hover:text-foreground gap-1.5 px-0"
              >
                <ArrowLeft className="h-4 w-4" /> Partners
              </Button>
              {entry &&
                (entry.isBlacklisted ? (
                  <Button variant="outline" size="sm" onClick={() => setUnblacklistTarget(entry)}>
                    Un-blacklist
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    scheme="destructive"
                    size="sm"
                    onClick={() => setBlacklistTarget(entry)}
                  >
                    Blacklist
                  </Button>
                ))}
            </div>

            <div>
              <h3 className="font-semibold text-gray-900">{company?.display_name ?? "—"}</h3>
              {(company?.registered_name || company?.company_type) && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {company?.registered_name}
                  {company?.company_type && ` · ${company.company_type.replace(/_/g, " ")}`}
                </p>
              )}
            </div>

            {entry?.isBlacklisted && entry.blacklistEntry && (
              <div className="border-destructive/30 bg-destructive/5 text-destructive space-y-1 rounded-[0.33em] border p-3 text-sm">
                <p>
                  This company is <strong>blacklisted</strong> — all active MOAs are revoked and
                  new requests are blocked.
                </p>
                {entry.blacklistEntry.reason && (
                  <p className="text-destructive/80 text-xs">
                    Reason: {entry.blacklistEntry.reason}
                  </p>
                )}
                <p className="text-destructive/60 text-xs">
                  Blacklisted on {formatDateWithoutTime(entry.blacklistEntry.created_at)}
                  {entry.blacklistEntry.actor_email && ` by ${entry.blacklistEntry.actor_email}`}
                </p>
              </div>
            )}

            {partnerMoasData?.company?.document_review_details && (
              <VerifiedDocumentDetails
                details={partnerMoasData.company.document_review_details}
              />
            )}
            {partnerMoasData?.companyDocuments && (
              <DocumentsSection documents={partnerMoasData.companyDocuments} />
            )}

            {isMoasLoading ? (
              <div className="space-y-1">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : moas.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 pr-4 font-medium text-gray-500">Status</th>
                    <th className="pb-2 pr-4 font-medium text-gray-500">Template</th>
                    <th className="pb-2 pr-4 font-medium text-gray-500">Requested</th>
                    <th className="pb-2 font-medium text-gray-500">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {moas.map((moa) => (
                    <tr
                      key={moa.id}
                      className="cursor-pointer align-top hover:bg-gray-50"
                      onClick={() => router.push(`/university/moas/${moa.id}`)}
                    >
                      <td className="py-2.5 pr-4">
                        <MoaStatusBadge status={moa.status} isExpired={moa.is_expired} />
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{moa.template?.name ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {formatDateWithoutTime(moa.created_at)}
                      </td>
                      <td className="py-2.5 text-gray-600">
                        {moa.effective_date
                          ? `${formatDateWithoutTime(moa.effective_date)} – ${formatDateWithoutTime(moa.expiry_date)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground text-sm">No MOA history.</p>
            )}
          </div>
        )}
      </div>

      {showInviteModal && (
        <InviteModal
          isSuperadmin={isSuperadmin}
          onClose={() => setShowInviteModal(false)}
          onSent={() => refetchInvites()}
        />
      )}

      {/* ── Blacklist dialog ─────────────────────────────────────────────── */}
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
                This immediately <strong>revokes all active MOAs</strong> with this company and
                blocks new requests.
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

      {/* ── Un-blacklist dialog ──────────────────────────────────────────── */}
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
                unblacklistTarget && unblacklistMutation.mutate(unblacklistTarget.company.id)
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
