"use client";
import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { resolveFile } from "@/app/lib/resolve-file";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
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
import {
  Building2,
  CircleAlert,
  CircleCheck,
  Eye,
  FileText,
  Info,
  Loader2,
  Pencil,
} from "lucide-react";

type SectionKey = "company" | "documents" | "other";

const COSMETIC_KEYS = ["description", "website", "phone", "industry"];

const COMPANY_TYPES = [
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "government_agency", label: "Government Agency" },
];
const COMPANY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  COMPANY_TYPES.map((t) => [t.value, t.label])
);

const DOC_TYPES = [
  { value: "business_permit", label: "Business Permit" },
  { value: "sec_dti_registration", label: "SEC/DTI Registration" },
  { value: "mayor_permit", label: "Mayor's Permit" },
  { value: "or_registration", label: "Official Receipt (OR)" },
];

interface CompanyDoc {
  id: string;
  type: string;
  filename: string;
  uploaded_at: string;
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inviteUniId = searchParams.get("invite_uni");
  const inviteTemplateId = searchParams.get("invite_template");
  const inviteId = searchParams.get("invite_id");

  const { company, isLoading } = useCompanyProfile();
  const queryClient = useQueryClient();

  const [openSections, setOpenSections] = useState<string[]>(["company"]);
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewName, setPreviewName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: docsData, refetch: refetchDocs } = useQuery({
    queryKey: ["company-docs"],
    queryFn: () =>
      preconfiguredAxios.get("/api/company/documents").then((r) => r.data),
    enabled: !!company,
  });

  const { data: verification, isLoading: vLoading } = useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const incomplete = verification?.status === "incomplete";

  // Auto-redirect to queue-moa as soon as profile is complete (invite flow).
  useEffect(() => {
    if (!inviteUniId || isLoading || vLoading || !company || !verification) return;
    if (verification.status === "incomplete") return;
    const params = new URLSearchParams();
    if (inviteTemplateId) params.set("template_id", inviteTemplateId);
    if (inviteId) params.set("invite_id", inviteId);
    router.replace(`/company/universities/${inviteUniId}/queue-moa?${params}`);
  }, [inviteUniId, isLoading, vLoading, company, verification, inviteTemplateId, inviteId, router]);

  // When set, a re-verification confirm dialog is shown; running it performs the edit.
  const [pendingConfirm, setPendingConfirm] = useState<(() => void) | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const g = (k: string) => (k in draft ? draft[k] : persisted(k));
      return preconfiguredAxios.patch("/api/company/profile", {
        registered_name: g("registered_name"),
        registered_address: g("registered_address"),
        company_type: g("company_type") || undefined,
        description: g("description"),
        website: g("website"),
        phone: g("phone"),
        industry: g("industry"),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-me"] });
      queryClient.invalidateQueries({ queryKey: ["company-verification"] });
      toast.success("Profile saved");
      cancelEdit();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadDoc = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      return preconfiguredAxios.post("/api/company/documents", fd);
    },
    onSuccess: () => {
      refetchDocs();
      queryClient.invalidateQueries({ queryKey: ["company-verification"] });
      toast.success("Document uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !company) return null;

  function persisted(key: string): string {
    if (COSMETIC_KEYS.includes(key))
      return String(company!.cosmetic?.[key] ?? "");
    return String(company?.[key as keyof NonNullable<typeof company>] ?? "");
  }
  function draftVal(key: string): string {
    return key in draft ? draft[key] : persisted(key);
  }
  function setField(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function startEdit(section: SectionKey, keys: string[]) {
    const seed: Record<string, string> = {};
    keys.forEach((k) => (seed[k] = persisted(k)));
    setDraft(seed);
    setEditing(section);
  }
  function cancelEdit() {
    setEditing(null);
    setDraft({});
  }

  // Material fields whose change forces re-verification (the hash inputs).
  const MATERIAL_KEYS_BY_SECTION: Record<string, string[]> = {
    company: ["registered_name"],
  };

  function attemptSave(sectionKey: SectionKey) {
    const matKeys = MATERIAL_KEYS_BY_SECTION[sectionKey] ?? [];
    const changedMaterial = matKeys.some((k) => k in draft && draft[k] !== persisted(k));
    if (verified && changedMaterial) {
      setPendingConfirm(() => () => save.mutate());
    } else {
      save.mutate();
    }
  }

  function attemptUploadDoc(file: File, type: string) {
    if (verified) {
      setPendingConfirm(() => () => uploadDoc.mutate({ file, type }));
    } else {
      uploadDoc.mutate({ file, type });
    }
  }

  async function preview(doc: CompanyDoc) {
    setPreviewName(doc.filename);
    setPreviewUrl(null);
    setPreviewLoading(true);
    setPreviewOpen(true);
    const url = await resolveFile("company_document", doc.id);
    setPreviewUrl(url);
    setPreviewLoading(false);
    if (!url) toast.error("Couldn't load that document");
  }

  const docs = (docsData?.documents ?? []) as CompanyDoc[];
  const latestDoc = (type: string) => docs.find((d) => d.type === type);
  const docCount = DOC_TYPES.filter(({ value }) => latestDoc(value)).length;

  // ── small renderers (plain functions, NOT components, to preserve input focus) ─
  const textField = (
    sectionKey: SectionKey,
    field: string,
    label: string,
    help?: string
  ) => {
    const isEditing = editing === sectionKey;
    return (
      <div className="flex items-center gap-4">
        <Label htmlFor={field} className="w-44 flex-shrink-0 truncate text-gray-400">
          {label}
        </Label>
        <div className="min-w-0 flex-1 space-y-1">
          {isEditing ? (
            <Input
              id={field}
              value={draftVal(field)}
              onChange={(e) => setField(field, e.target.value)}
            />
          ) : (
            <p className="truncate text-sm font-medium text-gray-900">
              {persisted(field) || (
                <span className="text-muted-foreground font-normal">Not set</span>
              )}
            </p>
          )}
          {help && <p className="text-muted-foreground text-xs">{help}</p>}
        </div>
      </div>
    );
  };

  const editControls = (sectionKey: SectionKey, keys: string[]) =>
    editing === sectionKey ? (
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={cancelEdit}
          disabled={save.isPending}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={() => attemptSave(sectionKey)} disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </div>
    ) : (
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => startEdit(sectionKey, keys)}
        >
          <Pencil /> Edit
        </Button>
      </div>
    );

  const sectionTrigger = (
    Icon: typeof Building2,
    title: string,
    badge?: React.ReactNode
  ) => (
    <AccordionTrigger className="cursor-pointer px-5 py-4 hover:no-underline">
      <span className="flex items-center gap-3 text-sm font-semibold text-gray-900">
        <Icon className="text-primary h-4 w-4" />
        {title}
        {badge}
      </span>
    </AccordionTrigger>
  );

  return (
    <PageContainer className="max-w-2xl space-y-6">
      <PageHeader
        title={company.display_name}
        description="Both the company profile and required documents are needed before you can request MOAs."
      />

      {inviteUniId && (
        <div className="border-primary/30 bg-primary/5 rounded-[0.33em] border px-4 py-3 text-sm text-gray-700">
          {incomplete ? (
            <>
              You have a pending MOA invitation. Complete your company profile and upload all
              required documents to proceed.
            </>
          ) : (
            <>
              Your profile is ready.{" "}
              <Link
                href={`/company/universities/${inviteUniId}/queue-moa?${new URLSearchParams({
                  ...(inviteTemplateId ? { template_id: inviteTemplateId } : {}),
                  ...(inviteId ? { invite_id: inviteId } : {}),
                })}`}
                className="text-primary font-medium underline"
              >
                Sign your MOA
              </Link>
              .
            </>
          )}
        </div>
      )}

      {!inviteUniId && incomplete && (
        <div className="rounded-[0.33em] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need to complete your profile before you can start requesting MOAs on the site.
        </div>
      )}

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={(v) => {
          setOpenSections(v);
          cancelEdit();
        }}
        className="overflow-hidden rounded-[0.33em] border border-gray-300 bg-white"
      >
        {/* 1 — Company Profile */}
        <AccordionItem value="company" className="">
          {sectionTrigger(Building2, "Company Profile")}
          <AccordionContent className="space-y-4 px-5 pb-5">
            <div className="flex items-center gap-4">
              <Label className="w-44 flex-shrink-0 truncate text-gray-400">Account email</Label>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{company.email}</p>
              </div>
            </div>
            {textField("company", "registered_name", "Legal / registered name")}
            {textField("company", "registered_address", "Registered address")}
            <div className="flex items-center gap-4">
              <Label className="w-44 flex-shrink-0 truncate text-gray-400">Company type</Label>
              <div className="min-w-0 flex-1">
                {editing === "company" ? (
                  <Select
                    value={draftVal("company_type") || undefined}
                    onValueChange={(v) => setField("company_type", v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="truncate text-sm font-medium text-gray-900">
                    {COMPANY_TYPE_LABELS[persisted("company_type")] || (
                      <span className="text-muted-foreground font-normal">Not set</span>
                    )}
                  </p>
                )}
              </div>
            </div>
            {editControls("company", [
              "registered_name",
              "registered_address",
              "company_type",
            ])}
          </AccordionContent>
        </AccordionItem>

        {/* 2 — Required Documents */}
        <AccordionItem value="documents" className="">
          {sectionTrigger(
            FileText,
            "Required Documents",
            <Badge
              type={docCount === DOC_TYPES.length ? "supportive" : "default"}
              strength="medium"
            >
              {docCount}/{DOC_TYPES.length}
            </Badge>
          )}
          <AccordionContent className="space-y-1 pb-5">
            {DOC_TYPES.map(({ value, label }) => {
              const existing = latestDoc(value);
              return (
                <div 
                  className="flex flex-row items-center hover:bg-gray-50 hover:cursor-pointer px-5 duration-200" 
                  onClick={() => existing && preview(existing)}
                >
                  {existing ? <CircleCheck className="text-supportive"/> : <CircleAlert className="text-warning" />}
                  <div
                    key={value}
                    className="flex flex-1 items-center justify-between gap-3 rounded-[0.16em] p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      {existing && (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {existing.filename}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <label 
                        className="cursor-pointer"
                        onMouseEnter={(e) => e.stopPropagation()}
                        onMouseOver={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          className="border-input hover:bg-accent inline-flex h-8 items-center justify-center rounded-[0.33em] border bg-background px-3 text-sm font-medium text-gray-700"
                          role="button"
                        >
                          {existing ? "Replace" : "Upload"}
                        </span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) attemptUploadDoc(f, value);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>

        {/* 3 — Other Info */}
        <AccordionItem value="other" className="">
          {sectionTrigger(
            Info,
            "Other Info",
            <span className="text-muted-foreground text-sm font-normal">
              (Optional)
            </span>
          )}
          <AccordionContent className="space-y-4 px-5 pb-5">
            {textField("other", "description", "Description")}
            {textField("other", "website", "Website")}
            {textField("other", "phone", "Phone")}
            {textField("other", "industry", "Industry")}
            {editControls("other", [
              "description",
              "website",
              "phone",
              "industry",
            ])}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Document preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogBottomSheet className="flex h-[88vh] flex-col p-0">
          <div className="flex items-center border-b border-gray-100 px-5 py-3.5 pr-14">
            <DialogTitle className="truncate text-sm font-medium text-gray-900">
              {previewName}
            </DialogTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {previewLoading ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="h-full w-full border-none"
                title={previewName}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Couldn&apos;t load that document.
              </div>
            )}
          </div>
        </DialogBottomSheet>
      </Dialog>

      {/* Re-verification warning (only when currently verified) */}
      <AlertDialog
        open={!!pendingConfirm}
        onOpenChange={(o) => !o && setPendingConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This change requires re-verification</AlertDialogTitle>
            <AlertDialogDescription>
              Changing this will require re-verification by the platform team. You
              won&apos;t be able to request new MOAs until you&apos;re re-approved.
              Your existing MOAs stay valid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pendingConfirm?.();
                setPendingConfirm(null);
              }}
            >
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

export default function CompanyProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  );
}
