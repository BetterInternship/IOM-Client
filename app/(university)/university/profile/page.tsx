"use client";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Pencil,
  Upload,
  UserRound,
} from "lucide-react";

type SectionKey = "university" | "representative";

interface UniversityProfile {
  registered_name: string | null;
  address: string | null;
  rep_name: string | null;
  rep_title: string | null;
  rep_signature_url: string | null;
  logo_url: string | null;
  [key: string]: string | null;
}

export default function UniversityProfilePage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const queryClient = useQueryClient();
  const sigRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [openSections, setOpenSections] = useState<string[]>(["university"]);
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["university-profile"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/profile")
        .then((r) => r.data as { university: UniversityProfile }),
    enabled: !!account,
  });

  const uni = data?.university;

  const save = useMutation({
    mutationFn: () => preconfiguredAxios.patch("/api/university/profile", draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-profile"] });
      queryClient.invalidateQueries({ queryKey: ["university-me"] });
      toast.success("Profile saved");
      cancelEdit();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return preconfiguredAxios.post("/api/university/profile/logo", fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-profile"] });
      toast.success("Logo uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadSig = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return preconfiguredAxios.post("/api/university/profile/signature", fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-profile"] });
      toast.success("Signature uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !account) return null;

  function persisted(key: string): string {
    return `${uni?.[key] ?? ""}`;
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

  const signatoryComplete =
    uni?.rep_name && uni?.rep_title && uni?.rep_signature_url;

  // ── renderers (plain functions to preserve input focus) ──────────────────────
  const textField = (sectionKey: SectionKey, field: string, label: string) => {
    const isEditing = editing === sectionKey;
    return (
      <div className="flex items-center gap-4">
        <Label htmlFor={field} className="w-44 flex-shrink-0 truncate text-gray-400">
          {label}
        </Label>
        <div className="min-w-0 flex-1">
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
        </div>
      </div>
    );
  };

  const editControls = (sectionKey: SectionKey, keys: string[]) => {
    if (!isSuperadmin) return null;
    return editing === sectionKey ? (
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
  };

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
        title="University profile"
        description="Institution details and the signatory used on your MOA templates."
      />

      {!signatoryComplete && isSuperadmin && (
        <div className="border-warning/30 bg-warning/10 flex items-start gap-3 rounded-[0.33em] border p-4 text-sm">
          <AlertTriangle className="text-warning mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-gray-700">
            Complete the representative details (name, title, and signature image)
            before you can offer MOA templates to companies.
          </p>
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
        {/* 1 — University Details */}
        <AccordionItem value="university" className="">
          {sectionTrigger(Building2, "University Details")}
          <AccordionContent className="space-y-4 px-5 pb-5">
            {textField("university", "registered_name", "Registered name")}
            {textField(
              "university",
              "address",
              "Address (used as execution place in MOAs)"
            )}
            {editControls("university", ["registered_name", "address"])}
          </AccordionContent>
        </AccordionItem>

        {/* 2 — Representative Details */}
        <AccordionItem value="representative" className="">
          {sectionTrigger(UserRound, "Representative Details")}
          <AccordionContent className="space-y-4 px-5 pb-5">
            <p className="text-muted-foreground text-xs">
              The representative&apos;s details will be used on all approved
              MOAs.
            </p>
            {textField("representative", "rep_name", "Signatory name")}
            {textField("representative", "rep_title", "Signatory title")}

            {editControls("representative", ["rep_name", "rep_title"])}
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <Label className="text-gray-500">Signature image</Label>
              <p className="text-muted-foreground text-xs">
                PNG only. A transparent background works best on the MOA.
              </p>
              <div className="flex items-center justify-center rounded-[0.33em] bg-gray-100 p-4">
                {uni?.rep_signature_url ? (
                  <img
                    src={uni.rep_signature_url}
                    alt="Signature"
                    className="h-16 max-w-xs object-contain"
                  />
                ) : (
                  <p className="text-muted-foreground text-xs">
                    No signature uploaded
                  </p>
                )}
              </div>
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
              {isSuperadmin && (
                <div className="flex justify-end">
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
                    {uni?.rep_signature_url
                      ? "Replace signature"
                      : "Upload signature"}
                  </Button>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3 — Other Info (logo) */}
        <AccordionItem value="other" className="">
          {sectionTrigger(
            ImageIcon,
            "Other Info",
            <span className="text-muted-foreground text-sm font-normal">
              (Optional)
            </span>
          )}
          <AccordionContent className="space-y-3 px-5 pb-5">
            <Label>Logo</Label>
            {uni?.logo_url ? (
              <p className="text-supportive flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" /> Logo uploaded
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                No logo uploaded yet.
              </p>
            )}
            <input
              ref={logoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo.mutate(f);
              }}
            />
            {isSuperadmin && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoRef.current?.click()}
                  disabled={uploadLogo.isPending}
                >
                  {uploadLogo.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Upload />
                  )}
                  {uni?.logo_url ? "Replace logo" : "Upload logo"}
                </Button>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </PageContainer>
  );
}
