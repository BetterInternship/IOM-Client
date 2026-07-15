"use client";

import { useModal } from "@/app/providers/modal-provider";
import { CompanyInviteForm } from "@/components/invites/company-invite-form";
import { TemplatePreviewContent } from "@/components/moa-request-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export function useIomModalRegistry() {
  const { openModal, closeModal } = useModal();

  return {
    previewDocument: {
      open: (url: string, title: string) =>
        openModal(
          "preview-document",
          <iframe src={url} className="h-full w-full border-none" title={title} />,
          {
            title,
            panelClassName: "!w-full sm:!max-w-4xl",
            contentClassName: "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
            showHeaderDivider: true,
          }
        ),
      close: () => closeModal("preview-document"),
    },
    previewTemplate: {
      open: (template: { id: string; name: string; description: string | null }) =>
        openModal(
          "preview-template",
          <TemplatePreviewContent
            templateId={template.id}
            templateName={template.name}
            templateDescription={template.description}
          />,
          {
            title: template.name,
            panelClassName: "!w-full sm:!max-w-4xl",
            contentClassName: "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
            showHeaderDivider: true,
          },
        ),
      close: () => closeModal("preview-template"),
    },
    inviteCompany: {
      open: (opts: {
        onSent: () => void;
        initialMode?: "registered" | "new";
        initialStep?: 1 | 2;
        initialCompanyId?: string;
        initialCompanyName?: string;
        initialEmail?: string;
      }) =>
        openModal(
          "invite-company",
          <CompanyInviteForm
            onClose={() => closeModal("invite-company")}
            onSent={opts.onSent}
            initialMode={opts.initialMode}
            initialStep={opts.initialStep}
            initialCompanyId={opts.initialCompanyId}
            initialCompanyName={opts.initialCompanyName}
            initialEmail={opts.initialEmail}
          />,
          { title: "Invite a company", panelClassName: "!w-full sm:!max-w-md" },
        ),
      close: () => closeModal("invite-company"),
    },
    blacklistPartner: {
      open: (opts: {
        companyName: string;
        onBlacklist: (reason: string) => void;
        isPending: boolean;
      }) =>
        openModal(
          "blacklist-partner",
          <BlacklistForm
            companyName={opts.companyName}
            onBlacklist={opts.onBlacklist}
            isPending={opts.isPending}
            close={() => closeModal("blacklist-partner")}
          />,
          { title: "Blacklist company", showHeaderDivider: false }
        ),
      close: () => closeModal("blacklist-partner"),
    },
    confirmAction: {
      open: (opts: {
        title: string;
        description: string;
        confirmLabel: string;
        onConfirm: () => void;
        isPending?: boolean;
      }) =>
        openModal(
          "confirm-action",
          <ConfirmForm
            title={opts.title}
            description={opts.description}
            confirmLabel={opts.confirmLabel}
            onConfirm={opts.onConfirm}
            isPending={opts.isPending}
            close={() => closeModal("confirm-action")}
          />,
          { title: null, hasClose: false, contentClassName: "px-4 pb-4 pt-2" }
        ),
      close: () => closeModal("confirm-action"),
    },
  };
}

function BlacklistForm({
  companyName,
  onBlacklist,
  isPending,
  close,
}: {
  companyName: string;
  onBlacklist: (reason: string) => void;
  isPending: boolean;
  close: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{companyName}</p>
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
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button
          scheme="destructive"
          disabled={isPending}
          onClick={() => onBlacklist(reason)}
        >
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Blacklisting…" : "Blacklist company"}
        </Button>
      </div>
    </div>
  );
}

function ConfirmForm({
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending,
  close,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  close: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button disabled={isPending} onClick={onConfirm}>
          {isPending && <Loader2 className="animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
