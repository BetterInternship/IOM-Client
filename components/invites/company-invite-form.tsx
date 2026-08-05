"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Mail,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  universityControllerCancelInvite,
  useUniversityControllerListRegisteredCompanies,
  useUniversityControllerListTemplates,
  useUniversityControllerSendInvite,
} from "@/app/api/app/api/endpoints/university/university";
import type { UniversityRegisteredCompanyDto } from "@/app/api/app/api/models";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { toastPresets } from "@/components/sonner-toaster";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MorphHeight } from "@/components/ui/morph-height";
import {
  buildComposeUrl,
  buildInviteBody,
  buildInviteSubject,
  INVITE_CC_EMAIL,
  loadInviteDraft,
  saveInviteDraft,
  type ComposeProvider,
} from "@/lib/compose-url";
import { cn } from "@/lib/utils";

export type CompanyInviteKind = "moa" | "listing";

const inviteSteps = [
  { title: "Choose company", icon: Building2 },
  { title: "Invitation details", icon: Mail },
];

const PROVIDER_LABEL: Record<ComposeProvider, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
};

// The invite row is created the instant the button is pressed, but "sent"
// can't be observed — only the coordinator's own mailbox knows that. Rather
// than claim success immediately, this waits for a signal that they've
// actually been away (the compose tab stealing focus, then giving it back)
// before showing the confirmation — so it's there waiting for them exactly
// when they return, with a cancel option in case they back out instead of
// sending. A capped fallback timer covers the case where focus never
// visibly changes (e.g. the popup was blocked or the OS window manager
// doesn't report visibility changes).
function scheduleSendConfirmation({
  companyLabel,
  inviteId,
  superseded,
  onCancelled,
}: {
  companyLabel: string;
  inviteId: string;
  superseded: boolean;
  onCancelled: () => void;
}) {
  let shown = false;
  let fallback: ReturnType<typeof setTimeout> | undefined;

  const onVisible = () => {
    if (document.visibilityState === "visible") show();
  };

  function show() {
    if (shown) return;
    shown = true;
    document.removeEventListener("visibilitychange", onVisible);
    if (fallback) clearTimeout(fallback);

    toast.custom(
      (id) => (
        <div className="flex items-start gap-3 rounded-[0.33em] bg-[#059669] px-4 py-3 text-sm text-white shadow-lg">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p>
              {`Invite sent to ${companyLabel}.`}
              {superseded &&
                " A previous pending invite to this email was superseded."}
            </p>
            <button
              type="button"
              className="mt-1 cursor-pointer font-semibold underline underline-offset-2 hover:no-underline"
              onClick={async () => {
                toast.dismiss(id);
                try {
                  await universityControllerCancelInvite(inviteId);
                  toast("Invite cancelled", toastPresets.success);
                  onCancelled();
                } catch (e) {
                  toast(
                    (e as Error).message ?? "Failed to cancel invite.",
                    toastPresets.destructive,
                  );
                }
              }}
            >
              Never sent it? Cancel invite
            </button>
          </div>
        </div>
      ),
      { duration: 20000 },
    );
  }

  document.addEventListener("visibilitychange", onVisible);
  fallback = setTimeout(show, 20000);
}

export function CompanyInviteForm({
  onClose,
  onSent,
  initialMode = "registered",
  initialStep = 1,
  initialCompanyId,
  initialCompanyName = "",
  initialEmail = "",
  initialKind,
  initialLegacyCompanyId,
  allowSearch = true,
}: {
  onClose: () => void;
  onSent: () => void;
  initialMode?: "registered" | "new";
  initialStep?: 1 | 2;
  initialCompanyId?: string;
  initialCompanyName?: string;
  initialEmail?: string;
  // D9 — kind is fixed for the form's lifetime: it's inherited from the
  // Partners-page tab a row invite was opened from, or defaults to 'moa'
  // for the Invites page's blank dialog. Never toggled in-form.
  initialKind?: CompanyInviteKind;
  initialLegacyCompanyId?: string;
  // Invites page (blank open): company search stays available.
  allowSearch?: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [mode, setMode] = useState<"registered" | "new">(initialMode);
  const [transitioningFrom, setTransitioningFrom] = useState<
    "registered" | "new" | null
  >(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedCompany, setSelectedCompany] =
    useState<UniversityRegisteredCompanyDto | null>(null);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [email, setEmail] = useState(initialEmail);
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<ComposeProvider>("gmail");

  const { account } = useUniversityProfile();
  const universityName = account?.university.registered_name ?? "";

  // D7/D8 — prefill the welcome-message draft and remembered provider once
  // the account is known. Runs once per fresh modal mount.
  useEffect(() => {
    if (!account?.id) return;
    const draft = loadInviteDraft(account.id);
    if (!draft) return;
    if (draft.welcomeMessage) setMessage(draft.welcomeMessage);
    if (draft.provider) setProvider(draft.provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  function selectProvider(next: ComposeProvider) {
    setProvider(next);
    if (account?.id) {
      saveInviteDraft(account.id, { provider: next, welcomeMessage: message });
    }
  }

  // D9 — kind is fixed for the form's lifetime (see prop doc above).
  const kind: CompanyInviteKind = initialKind ?? "moa";
  const legacyCompanyId = initialLegacyCompanyId;

  function switchMode(next: "registered" | "new") {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    setTransitioningFrom(mode);
    setMode(next);
    transitionTimer.current = setTimeout(() => setTransitioningFrom(null), 200);
  }

  const { data: companiesData, isLoading: companiesLoading } =
    useUniversityControllerListRegisteredCompanies();

  useEffect(() => {
    if (!initialCompanyId || selectedCompany) return;
    const company = (companiesData?.companies ?? []).find(
      (c) => c.id === initialCompanyId,
    );
    if (company) setSelectedCompany(company);
  }, [companiesData, initialCompanyId, selectedCompany]);

  const { data: templatesData } = useUniversityControllerListTemplates();

  const availableTemplates = (templatesData?.templates ?? []).filter(
    (t) => t.is_available,
  );

  const companyOptions = useMemo(
    () =>
      (companiesData?.companies ?? []).map((c) => ({
        id: c.id,
        name: c.registered_name,
      })),
    [companiesData],
  );

  const invitedEmail =
    mode === "registered" ? (selectedCompany?.email ?? "") : email.trim();
  const invitedName =
    mode === "registered"
      ? selectedCompany?.registered_name
      : companyName.trim() || undefined;

  const send = useUniversityControllerSendInvite({
    mutation: {
      onSuccess: (res) => {
        const composeUrl = buildComposeUrl(provider, {
          to: invitedEmail,
          cc: INVITE_CC_EMAIL,
          subject: buildInviteSubject({ kind, universityName }),
          body: buildInviteBody({
            kind,
            universityName,
            companyName: invitedName ?? null,
            repName: account?.university.rep_name ?? null,
            repTitle: account?.university.rep_title ?? null,
            personalMessage: message.trim() || null,
            inviteLink: res.inviteLink,
          }),
        });
        const composeWindow = window.open(
          composeUrl,
          "_blank",
          "noopener,noreferrer",
        );

        onSent();
        onClose();

        if (!composeWindow) {
          toast(
            `Your browser blocked the ${PROVIDER_LABEL[provider]} window — use "Re-open compose" from the Invites tab to try again.`,
            toastPresets.alert,
          );
          return;
        }

        scheduleSendConfirmation({
          companyLabel: invitedName || invitedEmail,
          inviteId: res.inviteId,
          superseded: res.superseded,
          onCancelled: onSent,
        });
      },
      onError: (e) => setError(e.message ?? "Failed to send invitation."),
    },
  });

  function handleSend() {
    setError("");
    if (account?.id) {
      saveInviteDraft(account.id, { provider, welcomeMessage: message });
    }
    send.mutate({
      data: {
        invitedEmail,
        companyName: invitedName,
        templateId: kind === "moa" ? templateId || undefined : undefined,
        personalMessage: message.trim() || undefined,
        kind,
        legacyCompanyId: kind === "listing" ? legacyCompanyId : undefined,
      },
    });
  }

  const step1CanNext =
    mode === "registered"
      ? !!selectedCompany
      : !!companyName.trim() && !!email.trim();
  const canSend =
    !!invitedEmail &&
    (mode === "new" || !!selectedCompany) &&
    (kind !== "moa" || availableTemplates.length > 0);

  return (
    <div className="space-y-4">
      {/* Owns the modal's whole header row (title + close) — the shared
          modal shell's title is fixed at open-time and can't react to
          `kind` toggling in here, so this replaces it entirely (opened with
          hasClose: false to suppress the shell's own close button). */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl leading-snug font-semibold tracking-tight">
          {kind === "moa"
            ? "Invite to sign an MOA"
            : "Invite to post an internship"}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        {inviteSteps.map((inviteStep, index) => {
          const Icon = inviteStep.icon;
          const active = index === step - 1;
          const done = index < step - 1;

          return (
            <div
              key={inviteStep.title}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-[0.33em] border p-3",
                active
                  ? "border-primary/60 bg-primary/5"
                  : done
                    ? "border-supportive/40 bg-supportive/5"
                    : "border-border/60",
              )}
              aria-current={active ? "step" : undefined}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  active ? "bg-primary/10" : "bg-gray-100",
                )}
              >
                {done ? (
                  <CheckCircle2 className="text-supportive h-5 w-5" />
                ) : (
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                )}
              </div>
              <div className="min-w-0 text-sm leading-tight font-medium">
                <div className="text-xs text-gray-400">Step {index + 1}</div>
                <div className="truncate">{inviteStep.title}</div>
              </div>
            </div>
          );
        })}
      </div>

      <MorphHeight>
        {step === 1 && (
          <div
            className={`relative ${transitioningFrom !== null ? "overflow-hidden" : ""}`}
          >
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
                        placeholder="Search companies..."
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
                      <Input
                        value={companyName}
                        readOnly
                        placeholder="Acme Corporation"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Company email</Label>
                      <Input
                        value={email}
                        readOnly
                        placeholder="rep@company.com"
                      />
                    </div>
                    <button type="button" className="text-primary text-sm">
                      ← Search registered companies
                    </button>
                  </>
                )}
              </div>
            )}

            <div
              className={
                transitioningFrom !== null
                  ? "animate-in fade-in-0 slide-in-from-top-2 duration-200 space-y-3"
                  : "space-y-3"
              }
            >
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
                          ? ((companiesData?.companies ?? []).find(
                              (c) => c.id === id,
                            ) ?? null)
                          : null;
                        setSelectedCompany(company);
                      }}
                      placeholder="Search companies..."
                    />
                  )}
                  {allowSearch && (
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
                  )}
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
                  {allowSearch && (
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
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Recipient</Label>
              <div className="flex items-center gap-3 rounded-[0.33em] border border-gray-200 bg-gray-50 px-3 py-3">
                <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-[0.33em]">
                  <Building2 className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 uppercase">
                    {mode === "registered" && selectedCompany
                      ? selectedCompany.registered_name
                      : companyName}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {mode === "registered" && selectedCompany
                      ? selectedCompany.email
                      : email}
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                {`We'll open a prefilled email in your own ${PROVIDER_LABEL[provider]} — review it and hit send from there. We'll CC ${INVITE_CC_EMAIL} so we keep a copy.`}
              </p>
            </div>

            {kind === "moa" ? (
              <div className="space-y-2">
                <Label htmlFor="invite-template">
                  Preferred MOA template (optional)
                </Label>
                {availableTemplates.length === 0 ? (
                  <div className="border-warning/40 bg-warning/5 space-y-1.5 rounded-[0.33em] border p-3 text-sm text-gray-700">
                    <p>
                      You need at least one active MOA template before you can
                      invite a company to sign a MOA.{" "}
                      <Link
                        href="/templates"
                        className="text-primary font-medium underline"
                      >
                        Go to Templates
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <>
                    <Select
                      value={templateId || "company-decides"}
                      onValueChange={(value) =>
                        setTemplateId(value === "company-decides" ? "" : value)
                      }
                    >
                      <SelectTrigger
                        id="invite-template"
                        className="h-10 max-h-10"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company-decides">
                          Company decides
                        </SelectItem>
                        {availableTemplates.map((t) => (
                          <SelectItem key={t.template.id} value={t.template.id}>
                            {t.template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      They can choose their preferred template during setup.
                    </p>
                  </>
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="invite-message">Welcome message (optional)</Label>
              <Textarea
                id="invite-message"
                rows={4}
                className="min-h-28 resize-none"
                placeholder="Add a note to the company..."
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-muted-foreground text-right text-xs">
                {message.length}/500
              </p>
            </div>

            {error && (
              <p className="text-destructive rounded-[0.33em] bg-red-50 px-3 py-2 text-sm">
                {error}
              </p>
            )}
          </div>
        )}
      </MorphHeight>

      <div className="flex justify-end gap-2 pt-2">
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
            {/* Registered-mode step 1 is just the company search box — with
                allowSearch off there's nothing there to go back to. */}
            {(allowSearch || mode !== "registered") && (
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
              >
                Back
              </Button>
            )}
            <div className="flex">
              <Button
                className="rounded-r-none"
                onClick={handleSend}
                disabled={!canSend || send.isPending}
              >
                {send.isPending && <Loader2 className="animate-spin" />}
                {send.isPending
                  ? "Sending..."
                  : `Invite with ${PROVIDER_LABEL[provider]}`}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    className="rounded-l-none border-l border-white/25 px-2"
                    disabled={send.isPending}
                    aria-label="Choose email provider"
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => selectProvider("gmail")}
                  >
                    Gmail
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => selectProvider("outlook")}
                  >
                    Outlook
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
