"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Loader2, Mail, X } from "lucide-react";
import { toast } from "sonner";

import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { toastPresets } from "@/components/sonner-toaster";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

export type CompanyInviteKind = "moa" | "listing";

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

const inviteSteps = [
  { title: "Choose company", icon: Building2 },
  { title: "Invitation details", icon: Mail },
];

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
      outer.offsetHeight;
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
  allowListingKind = false,
}: {
  onClose: () => void;
  onSent: () => void;
  initialMode?: "registered" | "new";
  initialStep?: 1 | 2;
  initialCompanyId?: string;
  initialCompanyName?: string;
  initialEmail?: string;
  initialKind?: CompanyInviteKind;
  initialLegacyCompanyId?: string;
  // Invites page (blank open): company search stays available, but every
  // invite from there is moa-only — listing invites only ever originate
  // from a specific Partners-page row, which already knows the company.
  allowSearch?: boolean;
  allowListingKind?: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [mode, setMode] = useState<"registered" | "new">(initialMode);
  const [transitioningFrom, setTransitioningFrom] = useState<
    "registered" | "new" | null
  >(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedCompany, setSelectedCompany] =
    useState<RegisteredCompany | null>(null);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [email, setEmail] = useState(initialEmail);
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Invite kind (D1/D3): only ever selectable when allowListingKind (the
  // Partners-page row context) — defaults from row data (initialKind);
  // otherwise 'moa' until a debounced server lookup below suggests
  // otherwise. A manual toggle click always wins over any later suggestion.
  // The Invites page's blank dialog stays moa-only regardless.
  const [kind, setKind] = useState<CompanyInviteKind>(
    allowListingKind ? (initialKind ?? "moa") : "moa",
  );
  const [legacyCompanyId, setLegacyCompanyId] = useState<string | undefined>(
    initialLegacyCompanyId,
  );
  const [kindManuallySet, setKindManuallySet] = useState(!!initialKind);

  function switchMode(next: "registered" | "new") {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    setTransitioningFrom(mode);
    setMode(next);
    transitionTimer.current = setTimeout(() => setTransitioningFrom(null), 200);
  }

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ["university-registered-companies"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/companies")
        .then((r) => r.data as { companies: RegisteredCompany[] }),
  });

  useEffect(() => {
    if (!initialCompanyId || selectedCompany) return;
    const company = (companiesData?.companies ?? []).find(
      (c) => c.id === initialCompanyId,
    );
    if (company) setSelectedCompany(company);
  }, [companiesData, initialCompanyId, selectedCompany]);

  const { data: templatesData } = useQuery({
    queryKey: ["university-templates-for-invite"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/templates")
        .then((r) => r.data as { templates: AvailableTemplate[] }),
  });

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

  // D3: blank-dialog default — debounce the email (+ name) against a
  // server-side match, but only when no row context already decided the
  // kind (initialKind) and the user hasn't manually toggled it.
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmail(invitedEmail);
      setDebouncedName(invitedName ?? "");
    }, 400);
    return () => clearTimeout(timer);
  }, [invitedEmail, invitedName]);

  const { data: suggestionData } = useQuery({
    queryKey: ["university-invite-suggestion", debouncedEmail, debouncedName],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/invite-suggestion", {
          params: { email: debouncedEmail, name: debouncedName || undefined },
        })
        .then(
          (r) =>
            r.data as {
              suggestedKind: CompanyInviteKind;
              legacyCompanyId?: string;
              matchedCompanyName?: string;
            },
        ),
    enabled:
      allowListingKind &&
      !initialKind &&
      !kindManuallySet &&
      debouncedEmail.includes("@"),
  });

  useEffect(() => {
    if (!suggestionData || kindManuallySet) return;
    setKind(suggestionData.suggestedKind);
    setLegacyCompanyId(suggestionData.legacyCompanyId);
  }, [suggestionData, kindManuallySet]);

  const toggleKind = () => {
    setKind((current) => (current === "moa" ? "listing" : "moa"));
    setKindManuallySet(true);
  };

  const send = useMutation({
    mutationFn: () =>
      preconfiguredAxios
        .post("/api/university/invites", {
          invitedEmail,
          companyName: invitedName,
          templateId: kind === "moa" ? templateId || undefined : undefined,
          personalMessage: message.trim() || undefined,
          kind,
          legacyCompanyId: kind === "listing" ? legacyCompanyId : undefined,
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
                  <p className="truncate text-sm font-semibold text-gray-900">
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
                    {allowListingKind && (
                      <button
                        type="button"
                        onClick={toggleKind}
                        className="text-primary cursor-pointer font-medium underline"
                      >
                        Invite them to post a listing instead
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <Select
                      value={templateId || "company-decides"}
                      onValueChange={(value) =>
                        setTemplateId(value === "company-decides" ? "" : value)
                      }
                    >
                      <SelectTrigger id="invite-template" className="h-10 max-h-10">
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

      {allowListingKind && (
        <button
          type="button"
          onClick={toggleKind}
          className="text-primary cursor-pointer text-sm hover:underline"
        >
          {kind === "moa"
            ? "Already have an MOA? Invite them to post a listing instead"
            : "Invite them to sign an MOA instead"}
        </button>
      )}

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
            <Button
              onClick={() => {
                setError("");
                send.mutate();
              }}
              disabled={!canSend || send.isPending}
            >
              {send.isPending && <Loader2 className="animate-spin" />}
              {send.isPending ? "Sending..." : "Send invitation"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
