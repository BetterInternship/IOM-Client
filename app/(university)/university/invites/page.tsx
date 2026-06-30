"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Autocomplete } from "@/components/ui/autocomplete";
import Link from "next/link";
import { ChevronDown, Loader2, Plus } from "lucide-react";

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

interface RegisteredCompany {
  id: string;
  registered_name: string;
  email: string;
}

function InviteStatusBadge({ status }: { status: CompanyInvite["status"] }) {
  if (status === "accepted") return <Badge type="supportive">Accepted</Badge>;
  if (status === "used_waiting") return <Badge type="warning">Registered — awaiting MOA</Badge>;
  if (status === "expired") return <Badge type="destructive">Expired</Badge>;
  return <Badge type="default">Pending</Badge>;
}

function MorphHeight({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    prevHeightRef.current = inner.offsetHeight;

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "height") return;
      outer.style.height = "";
      outer.style.overflow = "";
      outer.style.transition = "";
    };
    outer.addEventListener("transitionend", onTransitionEnd);

    const ro = new ResizeObserver(() => {
      const newHeight = inner.offsetHeight;
      const prevHeight = prevHeightRef.current;
      if (newHeight === prevHeight) return;
      prevHeightRef.current = newHeight;
      outer.style.overflow = "hidden";
      outer.style.transition = "none";
      outer.style.height = `${prevHeight}px`;
      outer.offsetHeight; // force reflow so height snaps before we animate
      outer.style.transition = "height 200ms ease";
      outer.style.height = `${newHeight}px`;
    });
    ro.observe(inner);

    return () => {
      ro.disconnect();
      outer.removeEventListener("transitionend", onTransitionEnd);
    };
  }, []);

  return (
    <div ref={outerRef}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function InviteModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"registered" | "new">("registered");
  const [transitioningFrom, setTransitioningFrom] = useState<"registered" | "new" | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<RegisteredCompany | null>(null);

  function switchMode(next: "registered" | "new") {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    setTransitioningFrom(mode);
    setMode(next);
    transitionTimer.current = setTimeout(() => setTransitioningFrom(null), 200);
  }

  // Step 1 fields for 'new' mode
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  // Step 2 fields
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ["university-registered-companies"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/companies")
        .then((r) => r.data as { companies: RegisteredCompany[] }),
  });

  const { data: templatesData } = useQuery({
    queryKey: ["university-templates-for-invite"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/templates")
        .then((r) => r.data as { templates: AvailableTemplate[] }),
  });

  const availableTemplates = (templatesData?.templates ?? []).filter((t) => t.is_available);

  const companyOptions = useMemo(
    () => (companiesData?.companies ?? []).map((c) => ({ id: c.id, name: c.registered_name })),
    [companiesData],
  );

  const invitedEmail = mode === "registered" ? (selectedCompany?.email ?? "") : email.trim();
  const invitedName =
    mode === "registered" ? selectedCompany?.registered_name : companyName.trim() || undefined;

  const send = useMutation({
    mutationFn: () =>
      preconfiguredAxios
        .post("/api/university/invites", {
          invitedEmail,
          companyName: invitedName,
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

  const step1CanNext =
    mode === "registered" ? !!selectedCompany : !!companyName.trim() && !!email.trim();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a company</DialogTitle>
          <DialogDescription>Step {step} of 2</DialogDescription>
        </DialogHeader>

        <MorphHeight>
        {step === 1 && (
          <div className={`relative ${transitioningFrom !== null ? "overflow-hidden" : ""}`}>
            {transitioningFrom !== null && (
              <div className="animate-out fade-out-0 slide-out-to-bottom-2 fill-mode-forwards pointer-events-none absolute inset-x-0 top-0 space-y-3 duration-200">
                {transitioningFrom === "registered" ? (
                  <>
                    {companiesLoading ? (
                      <Skeleton className="h-9 w-full" />
                    ) : (
                      <Autocomplete
                        options={companyOptions}
                        value={selectedCompany?.id ?? null}
                        onChange={() => {}}
                        placeholder="Search companies…"
                      />
                    )}
                    <button type="button" className="text-primary text-sm">
                      Company not listed? Invite by email
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Company name</Label>
                      <Input value={companyName} readOnly placeholder="Acme Corporation" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Company email</Label>
                      <Input value={email} readOnly placeholder="rep@company.com" />
                    </div>
                    <button type="button" className="text-primary text-sm">
                      ← Search registered companies
                    </button>
                  </>
                )}
              </div>
            )}

            <div className={transitioningFrom !== null ? "animate-in fade-in-0 slide-in-from-top-2 duration-200 space-y-3" : "space-y-3"}>
              {mode === "registered" ? (
                <>
                  {companiesLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : (
                    <Autocomplete
                      options={companyOptions}
                      value={selectedCompany?.id ?? null}
                      onChange={(id) => {
                        const company = id
                          ? (companiesData?.companies ?? []).find((c) => c.id === id) ?? null
                          : null;
                        setSelectedCompany(company);
                      }}
                      placeholder="Search companies…"
                    />
                  )}
                  <button
                    type="button"
                    className="text-primary cursor-pointer text-sm hover:underline"
                    onClick={() => {
                      setSelectedCompany(null);
                      switchMode("new");
                    }}
                  >
                    Company not listed? Invite by email
                  </button>
                </>
              ) : (
                <>
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
                  <button
                    type="button"
                    className="text-primary cursor-pointer text-sm hover:underline"
                    onClick={() => {
                      setCompanyName("");
                      setEmail("");
                      switchMode("registered");
                    }}
                  >
                    ← Search registered companies
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-[0.33em] border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-muted-foreground text-xs">Inviting</p>
              {mode === "registered" && selectedCompany ? (
                <>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedCompany.registered_name}
                  </p>
                  <p className="text-muted-foreground text-xs">{selectedCompany.email}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900">{companyName}</p>
                  <p className="text-muted-foreground text-xs">{email}</p>
                </>
              )}
            </div>

            {availableTemplates.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="invite-template">MOA template to send (optional)</Label>
                <div className="relative">
                  <select
                    id="invite-template"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="border-input bg-background focus:ring-ring w-full appearance-none rounded-[0.33em] border py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-1"
                  >
                    <option value="">No specific template</option>
                    {availableTemplates.map((t) => (
                      <option key={t.template.id} value={t.template.id}>
                        {t.template.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
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
        )}
        </MorphHeight>

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)} disabled={!step1CanNext}>
                Next
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  setError("");
                  send.mutate();
                }}
                disabled={send.isPending}
              >
                {send.isPending && <Loader2 className="animate-spin" />}
                {send.isPending ? "Sending…" : "Send invite"}
              </Button>
            </>
          )}
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
  const { account } = useUniversityProfile();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNoTemplatesPrompt, setShowNoTemplatesPrompt] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["university-invites"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/invites")
        .then((r) => r.data as { invites: CompanyInvite[] }),
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
  const availableTemplates = (templatesData?.templates ?? []).filter((t) => t.is_available);

  const handleInviteClick = () => {
    if (availableTemplates.length === 0) {
      setShowNoTemplatesPrompt(true);
    } else {
      setShowInviteModal(true);
    }
  };

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
        <Button onClick={handleInviteClick}>
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
          onClose={() => setShowInviteModal(false)}
          onSent={() => refetch()}
        />
      )}

      {showNoTemplatesPrompt && (
        <Dialog open onOpenChange={(o) => !o && setShowNoTemplatesPrompt(false)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>No active templates</DialogTitle>
              <DialogDescription>
                You need at least one active MOA template before you can invite companies.
                Go to your templates page to activate one.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNoTemplatesPrompt(false)}>
                Cancel
              </Button>
              <Button asChild>
                <Link href="/templates">Go to Templates</Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageContainer>
  );
}
