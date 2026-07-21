"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  ShieldAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { toastPresets } from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BulkInviteAction } from "@/components/university/university-partners-table";

export interface BulkInviteTargetInput {
  type: "registered" | "legacy";
  companyId?: string;
  legacyCompanyId?: string;
  displayName: string;
}

interface TargetEcho {
  type: "registered" | "legacy";
  companyId?: string;
  legacyCompanyId?: string;
  displayName: string;
  email: string | null;
}

interface IssueEcho extends TargetEcho {
  reason: string;
}

interface CollapsedGroup {
  email: string;
  targets: TargetEcho[];
}

interface BulkInviteResponse {
  sent: boolean;
  willSend: TargetEcho[];
  blocked: IssueEcho[];
  skipped: IssueEcho[];
  collapsed: CollapsedGroup[];
  batchBlockers: string[];
  warnings: {
    supersedes: TargetEcho[];
    needsReverification: TargetEcho[];
    atMoaCap: TargetEcho[];
  };
}

interface AvailableTemplate {
  id: string;
  template: { id: string; name: string };
  is_available: boolean;
}

const ACTION_COPY: Record<BulkInviteAction, { title: string; verb: string }> = {
  listing: { title: "Invite to post a listing", verb: "invited to post a listing" },
  moa: { title: "Invite to sign an MOA", verb: "invited to sign an MOA" },
  renew: { title: "Invite to renew their MOA", verb: "sent a renewal ask" },
};

function IssueList({ title, issues }: { title: string; issues: IssueEcho[] }) {
  const [open, setOpen] = useState(false);
  if (issues.length === 0) return null;
  return (
    <div className="rounded-[0.33em] border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span>
          {title} ({issues.length})
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {issues.map((issue, index) => (
            <li key={`${issue.companyId ?? issue.legacyCompanyId ?? index}`} className="px-3 py-2 text-sm">
              <p className="font-medium text-gray-800">{issue.displayName}</p>
              <p className="text-muted-foreground text-xs">{issue.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WarningNote({ icon: Icon, children }: { icon: typeof AlertTriangle; children: React.ReactNode }) {
  return (
    <div className="border-warning/40 bg-warning/5 flex items-start gap-2 rounded-[0.33em] border p-3 text-sm text-gray-700">
      <Icon className="text-warning mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function BulkInviteSheet({
  action,
  targets,
  onSent,
  onClose,
}: {
  action: BulkInviteAction;
  targets: BulkInviteTargetInput[];
  onSent: () => void;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<BulkInviteResponse | null>(null);

  const wireTargets = targets.map((t) =>
    t.type === "registered"
      ? { type: "registered" as const, companyId: t.companyId }
      : { type: "legacy" as const, legacyCompanyId: t.legacyCompanyId },
  );

  const { data: templatesData } = useQuery({
    queryKey: ["university-templates-for-invite"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/templates")
        .then((r) => r.data as { templates: AvailableTemplate[] }),
    enabled: action === "moa",
  });
  const availableTemplates = (templatesData?.templates ?? []).filter((t) => t.is_available);

  const preflight = useMutation({
    mutationFn: () =>
      preconfiguredAxios
        .post("/api/university/invites/bulk", { action, dryRun: true, targets: wireTargets })
        .then((r) => r.data as BulkInviteResponse),
  });

  useEffect(() => {
    preflight.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useMutation({
    mutationFn: () =>
      preconfiguredAxios
        .post("/api/university/invites/bulk", {
          action,
          dryRun: false,
          targets: wireTargets,
          templateId: action === "moa" ? templateId || undefined : undefined,
          personalMessage: action === "renew" ? undefined : message.trim() || undefined,
        })
        .then((r) => r.data as BulkInviteResponse),
    onSuccess: (data) => {
      setResult(data);
      onSent();
      if (data.willSend.length > 0) {
        toast(`${data.willSend.length} ${data.willSend.length === 1 ? "company" : "companies"} ${ACTION_COPY[action].verb}.`, toastPresets.success);
      }
    },
    onError: (e: Error) => toast(e.message, toastPresets.destructive),
  });

  const preflightData = preflight.data;
  const canSend =
    !!preflightData &&
    preflightData.batchBlockers.length === 0 &&
    preflightData.willSend.length > 0;

  if (result) {
    return (
      <div className="space-y-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium text-gray-900">
            {result.willSend.length} of {targets.length} sent.
          </p>
          {result.blocked.length > 0 && (
            <p className="text-muted-foreground">{result.blocked.length} could not be sent.</p>
          )}
          {result.skipped.length > 0 && (
            <p className="text-muted-foreground">{result.skipped.length} skipped.</p>
          )}
        </div>
        <IssueList title="Not sent" issues={result.blocked} />
        <IssueList title="Skipped" issues={result.skipped} />
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {preflight.isPending ? (
        <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking recipients…
        </div>
      ) : !preflightData ? (
        <p className="text-destructive text-sm">Could not check recipients. Try again.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-[0.33em] border border-gray-200 bg-gray-50 px-3 py-2.5">
            <Users className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-sm text-gray-800">
              <span className="font-semibold">{preflightData.willSend.length}</span> of{" "}
              {targets.length} will be {ACTION_COPY[action].verb}.
            </p>
          </div>

          {preflightData.batchBlockers.length > 0 && (
            <div className="border-destructive/30 bg-destructive/5 space-y-1 rounded-[0.33em] border p-3 text-sm">
              {preflightData.batchBlockers.map((blocker, index) => (
                <p key={index} className="text-destructive">
                  {blocker}
                  {blocker.includes("template") && (
                    <>
                      {" "}
                      <Link href="/templates" className="font-medium underline">
                        Go to Templates
                      </Link>
                    </>
                  )}
                </p>
              ))}
            </div>
          )}

          {preflightData.warnings.needsReverification.length > 0 && (
            <WarningNote icon={ShieldAlert}>
              {preflightData.warnings.needsReverification.length} recipient
              {preflightData.warnings.needsReverification.length === 1 ? "" : "s"} will get the
              email, but {preflightData.warnings.needsReverification.length === 1 ? "isn't" : "aren't"}{" "}
              currently platform-verified — they won't be able to complete a request until they are.
            </WarningNote>
          )}
          {preflightData.warnings.atMoaCap.length > 0 && (
            <WarningNote icon={AlertTriangle}>
              {preflightData.warnings.atMoaCap.length} recipient
              {preflightData.warnings.atMoaCap.length === 1 ? "" : "s"} already {preflightData.warnings.atMoaCap.length === 1 ? "has" : "have"} the maximum number of active MOAs with you.
            </WarningNote>
          )}
          {preflightData.warnings.supersedes.length > 0 && (
            <WarningNote icon={Mail}>
              {preflightData.warnings.supersedes.length} recipient
              {preflightData.warnings.supersedes.length === 1 ? "" : "s"} already{" "}
              {preflightData.warnings.supersedes.length === 1 ? "has" : "have"} a pending invite —
              its link will stop working once this send goes out.
            </WarningNote>
          )}

          <IssueList title="Won't be included" issues={preflightData.blocked} />
          <IssueList title="Skipped" issues={preflightData.skipped} />
          {preflightData.collapsed.length > 0 && (
            <div className="rounded-[0.33em] border border-gray-200 p-3 text-sm text-gray-700">
              {preflightData.collapsed.map((group, index) => (
                <p key={index} className={cn(index > 0 && "mt-1")}>
                  {group.targets.map((t) => t.displayName).join(" and ")} share the email{" "}
                  <span className="font-medium">{group.email}</span> — only one invite will be
                  sent.
                </p>
              ))}
            </div>
          )}

          {action === "moa" && (
            <div className="space-y-2">
              <Label htmlFor="bulk-invite-template">Preferred MOA template (optional)</Label>
              {availableTemplates.length === 0 ? (
                <div className="border-warning/40 bg-warning/5 rounded-[0.33em] border p-3 text-sm text-gray-700">
                  You need at least one active MOA template before you can invite companies to
                  sign a MOA.{" "}
                  <Link href="/templates" className="text-primary font-medium underline">
                    Go to Templates
                  </Link>
                  .
                </div>
              ) : (
                <Select
                  value={templateId || "company-decides"}
                  onValueChange={(value) => setTemplateId(value === "company-decides" ? "" : value)}
                >
                  <SelectTrigger id="bulk-invite-template" className="h-10 max-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company-decides">Company decides</SelectItem>
                    {availableTemplates.map((t) => (
                      <SelectItem key={t.template.id} value={t.template.id}>
                        {t.template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {action !== "renew" && (
            <div className="space-y-2">
              <Label htmlFor="bulk-invite-message">Welcome message (optional)</Label>
              <Textarea
                id="bulk-invite-message"
                rows={3}
                className="min-h-20 resize-none"
                placeholder="Add a note to every recipient..."
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-muted-foreground text-right text-xs">{message.length}/500</p>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => send.mutate()} disabled={!canSend || send.isPending}>
          {send.isPending && <Loader2 className="animate-spin" />}
          {send.isPending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
