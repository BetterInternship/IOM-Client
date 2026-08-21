"use client";

import { useModal } from "@/app/providers/modal-provider";
import { CompanyInviteForm } from "@/components/invites/company-invite-form";
import {
  BulkInviteSheet,
  type BulkInviteTargetInput,
} from "@/components/university/bulk-invite-sheet";
import type { BulkInviteAction } from "@/components/university/university-partners-table";
import { TemplatePreviewContent } from "@/components/moa-request-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FilePlus2,
  Hourglass,
  Loader2,
  Mail,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const PREVIEW_MODAL_PANEL_CLASS = "!w-full sm:!max-w-4xl";
const PREVIEW_MODAL_CONTENT_CLASS =
  "h-[75dvh] overflow-hidden p-0 sm:h-[75vh] sm:min-h-[32rem]";

export function useIomModalRegistry() {
  const { openModal, closeModal } = useModal();

  return {
    previewDocument: {
      open: (url: string, title: string) =>
        openModal(
          "preview-document",
          <iframe
            src={url}
            className="h-full w-full border-none"
            title={title}
          />,
          {
            title,
            panelClassName: PREVIEW_MODAL_PANEL_CLASS,
            contentClassName: PREVIEW_MODAL_CONTENT_CLASS,
            showHeaderDivider: false,
          },
        ),
      close: () => closeModal("preview-document"),
    },
    previewTemplate: {
      open: (template: {
        id: string;
        name: string;
        description: string | null;
      }) =>
        openModal(
          "preview-template",
          <TemplatePreviewContent
            templateId={template.id}
            templateName={template.name}
            templateDescription={template.description}
          />,
          {
            title: template.name,
            panelClassName: PREVIEW_MODAL_PANEL_CLASS,
            contentClassName: PREVIEW_MODAL_CONTENT_CLASS,
            showHeaderDivider: false,
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
        initialKind?: "moa" | "listing";
        initialLegacyCompanyId?: string;
        allowSearch?: boolean;
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
            initialKind={opts.initialKind}
            initialLegacyCompanyId={opts.initialLegacyCompanyId}
            allowSearch={opts.allowSearch}
          />,
          {
            // No header title/close here — CompanyInviteForm renders its
            // own header row (title + close) so the title can react to the
            // invite kind (moa vs listing) as the university toggles it,
            // which the shell's open-time-only title can't.
            hasClose: false,
            panelClassName: "!w-full sm:!max-w-xl sm:!overflow-visible",
            contentClassName:
              "max-h-[calc(100dvh-4rem)] overflow-auto px-4 pb-4 sm:max-h-none sm:overflow-visible",
          },
        ),
      close: () => closeModal("invite-company"),
    },
    bulkInviteCompanies: {
      open: (opts: {
        action: BulkInviteAction;
        targets: BulkInviteTargetInput[];
        onSent: () => void;
      }) =>
        openModal(
          "bulk-invite-companies",
          <BulkInviteSheet
            action={opts.action}
            targets={opts.targets}
            onSent={opts.onSent}
            onClose={() => closeModal("bulk-invite-companies")}
          />,
          {
            title:
              opts.action === "listing"
                ? "Invite to post a listing"
                : opts.action === "moa"
                  ? "Invite to sign an MOA"
                  : "Invite to renew their MOA",
            panelClassName: "!w-full sm:!max-w-lg",
            contentClassName:
              "max-h-[calc(100dvh-8rem)] overflow-auto px-4 pb-4",
          },
        ),
      close: () => closeModal("bulk-invite-companies"),
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
            onBlacklist={opts.onBlacklist}
            isPending={opts.isPending}
            close={() => closeModal("blacklist-partner")}
          />,
          {
            title: `Blacklist ${opts.companyName}`,
            showHeaderDivider: false,
          },
        ),
      close: () => closeModal("blacklist-partner"),
    },
    approvalPending: {
      open: (opts: {
        onQueueMoa: () => void;
        onClose: () => void;
        reapproval?: boolean;
      }) =>
        openModal(
          "approval-pending",
          <ApprovalPendingContent
            reapproval={opts.reapproval}
            onDismiss={() => closeModal("approval-pending")}
            onQueueMoa={() => {
              closeModal("approval-pending", { skipOnClose: true });
              opts.onQueueMoa();
            }}
          />,
          {
            panelClassName: "!w-full sm:!max-w-xl",
            headerClassName: "pb-0",
            contentClassName: "px-6 pb-6 sm:px-8 sm:pb-7",
            backdropClassName: "bg-black/35 backdrop-blur-[1px]",
            onClose: opts.onClose,
          },
        ),
      close: () => closeModal("approval-pending"),
    },
    universityProfileComplete: {
      open: (opts: { onContinue: () => void; onClose: () => void }) =>
        openModal(
          "university-profile-complete",
          <UniversityProfileCompleteContent
            onContinue={() => {
              closeModal("university-profile-complete", {
                skipOnClose: true,
              });
              opts.onContinue();
            }}
          />,
          {
            panelClassName: "!w-full sm:!max-w-xl",
            headerClassName: "pb-0",
            contentClassName: "px-6 pb-6 sm:px-8 sm:pb-7",
            backdropClassName: "bg-black/35 backdrop-blur-[1px]",
            onClose: opts.onClose,
          },
        ),
      close: () => closeModal("university-profile-complete"),
    },
    // First-time self-serve "Post a listing" naming prompt (plan §12) — a
    // display name is a hire-side concept, asked exactly when it starts to
    // mattering. Never shown once the company has a registered_name.
    promptDisplayName: {
      open: (opts: {
        onSubmit: (displayName: string) => void;
        isPending?: boolean;
      }) =>
        openModal(
          "prompt-display-name",
          <DisplayNameForm
            onSubmit={opts.onSubmit}
            isPending={opts.isPending}
            close={() => closeModal("prompt-display-name")}
          />,
          {
            title: "What should students see your company called?",
            showHeaderDivider: false,
          },
        ),
      close: () => closeModal("prompt-display-name"),
    },
    confirmAction: {
      open: (opts: {
        title: string;
        description: ReactNode;
        confirmLabel: string;
        onConfirm: () => void | Promise<void>;
        isPending?: boolean;
        tone?: "default" | "warning" | "alert";
      }) =>
        openModal(
          "confirm-action",
          <ConfirmForm
            title={opts.title}
            description={opts.description}
            confirmLabel={opts.confirmLabel}
            onConfirm={opts.onConfirm}
            isPending={opts.isPending}
            tone={opts.tone}
            close={() => closeModal("confirm-action")}
          />,
          { title: null, hasClose: false, contentClassName: "px-4 pb-4 pt-2" },
        ),
      close: () => closeModal("confirm-action"),
    },
  };
}

function UniversityProfileCompleteContent({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <div>
      <div className="text-center">
        <span className="bg-supportive/10 text-supportive mx-auto flex size-20 items-center justify-center rounded-full">
          <CheckCircle2 className="size-10" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-gray-950">
          Profile complete!
        </h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-6">
          You can now offer MOAs to companies.
        </p>
      </div>

      <Button size="lg" className="mt-6 w-full" onClick={onContinue}>
        Choose templates
      </Button>
    </div>
  );
}

function ApprovalPendingContent({
  onQueueMoa,
  onDismiss,
  reapproval = false,
}: {
  onQueueMoa: () => void;
  onDismiss: () => void;
  reapproval?: boolean;
}) {
  return (
    <div>
      <div className="text-center">
        <span className="border-primary text-primary mx-auto flex size-14 items-center justify-center rounded-full border-2">
          <Hourglass className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-gray-950">
          Pending approval
        </h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-6">
          {reapproval
            ? "Your document batch was submitted. Your company requires re-approval before new MOAs can be issued."
            : "Your company is pending approval. Expect an email in the next 24 hours."}
        </p>
      </div>

      <div className="mt-6 space-y-4 border-t border-gray-200 pt-5">
        <div className="flex items-center gap-3">
          <span className="bg-primary/5 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
            <FilePlus2 className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {reapproval
                ? "Queue MOA requests while you wait"
                : "Continue requesting MOAs"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              We&apos;ll queue them until approval.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-primary/5 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
            <Clock className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-gray-900">
            Usually takes less than 24 hours
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-primary/5 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
            <Mail className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-gray-900">
            We&apos;ll notify you via email
          </p>
        </div>
        {reapproval && (
          <p className="text-muted-foreground text-sm">
            Your existing MOAs remain valid while this review is pending.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          size="lg"
          variant="outline"
          className="flex-1"
          onClick={onDismiss}
        >
          Not now
        </Button>
        <Button size="lg" className="flex-1" onClick={onQueueMoa}>
          Request MOA now
        </Button>
      </div>

      <p className="text-muted-foreground mt-3 text-center text-xs">
        You can keep using the platform while you wait.
      </p>
    </div>
  );
}

function BlacklistForm({
  onBlacklist,
  isPending,
  close,
}: {
  onBlacklist: (reason: string) => void;
  isPending: boolean;
  close: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-3">
      <div className="border-destructive/30 bg-destructive/5 text-destructive space-y-1 rounded-[0.33em] border p-3 text-sm">
        <p>
          This immediately revokes all active MOAs with this company and blocks
          new requests. Revoked MOAs cannot be restored. The company is not
          notified. This action is logged under your name.
        </p>
        <p className="text-destructive/80 font-semibold"></p>
      </div>
      <Textarea
        rows={3}
        placeholder="Reason (optional — never shown to the company)"
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

function DisplayNameForm({
  onSubmit,
  isPending,
  close,
}: {
  onSubmit: (displayName: string) => void;
  isPending?: boolean;
  close: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        This is a hire-side display name — it&apos;s separate from your
        registered legal name, which an admin sets when your company is
        verified.
      </p>
      <Input
        autoFocus
        placeholder="Acme Corporation"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button
          disabled={!name.trim() || isPending}
          onClick={() => onSubmit(name.trim())}
        >
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Setting up…" : "Continue"}
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
  tone = "default",
  close,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  isPending?: boolean;
  tone?: "default" | "warning" | "alert";
  close: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pending = isPending || isSubmitting;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {tone === "warning" || tone === "alert" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span
              className={
                tone === "alert"
                  ? "text-warning flex shrink-0 items-center justify-center"
                  : "text-destructive flex shrink-0 items-center justify-center"
              }
            >
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <div
            className={
              tone === "alert"
                ? "border-warning/30 bg-warning/10 rounded-[0.33em] border px-4 py-3 text-left"
                : "border-destructive/30 bg-destructive/5 rounded-[0.33em] border px-4 py-3 text-left"
            }
          >
            <p
              className={
                tone === "alert"
                  ? "text-gray-800 text-sm leading-6"
                  : "text-destructive text-sm leading-6"
              }
            >
              {description}
            </p>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button disabled={pending} onClick={handleConfirm}>
          {pending && <Loader2 className="animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
