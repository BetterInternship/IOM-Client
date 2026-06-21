"use client";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
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
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  Info,
  Loader2,
  Pencil,
  Upload,
  UserRound,
} from "lucide-react";

type SectionKey = "company" | "representative" | "documents" | "other";

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

export default function CompanyProfilePage() {
  const { company, isLoading } = useCompanyProfile();
  const queryClient = useQueryClient();
  const sigRef = useRef<HTMLInputElement>(null);

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

  const save = useMutation({
    mutationFn: () => {
      const g = (k: string) => (k in draft ? draft[k] : persisted(k));
      return preconfiguredAxios.patch("/api/company/profile", {
        registered_name: g("registered_name"),
        registered_address: g("registered_address"),
        company_type: g("company_type") || undefined,
        rep_name: g("rep_name"),
        rep_title: g("rep_title"),
        description: g("description"),
        website: g("website"),
        phone: g("phone"),
        industry: g("industry"),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-me"] });
      toast.success("Profile saved");
      cancelEdit();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadSig = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return preconfiguredAxios.post("/api/company/profile/signature", fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-me"] });
      toast.success("Signature uploaded");
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
      <div className="space-y-1.5">
        <Label htmlFor={field}>{label}</Label>
        {isEditing ? (
          <Input
            id={field}
            value={draftVal(field)}
            onChange={(e) => setField(field, e.target.value)}
          />
        ) : (
          <p className="text-sm text-gray-800">
            {persisted(field) || (
              <span className="text-muted-foreground">Not set</span>
            )}
          </p>
        )}
        {help && <p className="text-muted-foreground text-xs">{help}</p>}
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
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
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
    <AccordionTrigger className="px-5 py-4 hover:no-underline">
      <span className="flex items-center gap-3 text-sm font-semibold text-gray-900">
        <Icon className="text-primary h-4 w-4" />
        {title}
        {badge}
      </span>
    </AccordionTrigger>
  );

  const materialNote = (
    <p className="text-warning flex items-center gap-1.5 text-xs">
      <Info className="h-3.5 w-3.5" /> Editing these notifies your active MOA
      partners.
    </p>
  );

  return (
    <PageContainer className="max-w-2xl space-y-6">
      <PageHeader
        title={company.display_name}
        description="Manage your company profile and required documents."
      />

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={(v) => {
          setOpenSections(v);
          cancelEdit();
        }}
        className="overflow-hidden rounded-[0.33em] border border-gray-300 bg-white"
      >
        {/* 1 — Company Profile (formerly Material Fields) */}
        <AccordionItem value="company" className="">
          {sectionTrigger(Building2, "Company Profile")}
          <AccordionContent className="space-y-4 px-5 pb-5">
            {materialNote}
            {editControls("company", [
              "registered_name",
              "registered_address",
              "company_type",
            ])}
            {textField("company", "registered_name", "Legal / registered name")}
            {textField("company", "registered_address", "Registered address")}
            <div className="space-y-1.5">
              <Label>Company type</Label>
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
                <p className="text-sm text-gray-800">
                  {COMPANY_TYPE_LABELS[persisted("company_type")] || (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2 — Representative Details */}
        <AccordionItem value="representative" className="">
          {sectionTrigger(UserRound, "Representative Details")}
          <AccordionContent className="space-y-4 px-5 pb-5">
            {materialNote}
            {editControls("representative", ["rep_name", "rep_title"])}
            {textField("representative", "rep_name", "Representative name")}
            <div className="space-y-1.5">
              <Label>Representative email</Label>
              <p className="text-sm text-gray-800">{company.rep_email}</p>
              <p className="text-muted-foreground text-xs">
                Managed by the platform admin.
              </p>
            </div>
            {textField("representative", "rep_title", "Representative title")}

            <div className="space-y-2 border-t border-gray-100 pt-4">
              <Label>Representative signature</Label>
              <p className="text-muted-foreground text-xs">
                PNG only — a transparent background works best on the MOA.
              </p>
              {company.rep_signature_url ? (
                <p className="text-supportive flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Signature uploaded
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  No signature uploaded yet.
                </p>
              )}
              <input
                ref={sigRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadSig.mutate(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => sigRef.current?.click()}
                disabled={uploadSig.isPending}
              >
                {uploadSig.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Upload />
                )}
                {company.rep_signature_url
                  ? "Replace signature"
                  : "Upload signature"}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3 — Required Documents */}
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
          <AccordionContent className="space-y-2.5 px-5 pb-5">
            <p className="text-muted-foreground text-xs">
              All four are required before you can request MOAs.
            </p>
            {DOC_TYPES.map(({ value, label }) => {
              const existing = latestDoc(value);
              return (
                <div
                  key={value}
                  className="flex items-center justify-between gap-3 rounded-[0.33em] border border-gray-200 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      {existing ? (
                        <Badge type="supportive" strength="medium">
                          Uploaded
                        </Badge>
                      ) : (
                        <Badge type="default" strength="light">
                          Missing
                        </Badge>
                      )}
                    </div>
                    {existing && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {existing.filename}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {existing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => preview(existing)}
                      >
                        <Eye /> Preview
                      </Button>
                    )}
                    <label className="cursor-pointer">
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
                          if (f) uploadDoc.mutate({ file: f, type: value });
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>

        {/* 4 — Other Info */}
        <AccordionItem value="other" className="">
          {sectionTrigger(Info, "Other Info")}
          <AccordionContent className="space-y-4 px-5 pb-5">
            {editControls("other", [
              "description",
              "website",
              "phone",
              "industry",
            ])}
            {textField("other", "description", "Description")}
            {textField("other", "website", "Website")}
            {textField("other", "phone", "Phone")}
            {textField("other", "industry", "Industry")}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Document preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{previewName}</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="text-muted-foreground flex h-[70vh] items-center justify-center text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              className="h-[70vh] w-full rounded-[0.33em] border border-gray-200"
              title={previewName}
            />
          ) : (
            <div className="text-muted-foreground flex h-[40vh] items-center justify-center text-sm">
              Couldn&apos;t load that document.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
