"use client";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { getUniversityControllerMeQueryKey } from "@/app/api";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer } from "@/components/page-header";
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
  Camera,
  ImageIcon,
  Loader2,
  Pencil,
  Upload,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { universityProfileSchema, type UniversityProfileDraft } from "@/lib/profile-validation";

type SectionKey = "university" | "representative";

const SECTION_FIELDS: Record<SectionKey, (keyof UniversityProfileDraft)[]> = {
  university: ["registered_name", "address"],
  representative: ["rep_name", "rep_title"],
};

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
  const form = useForm<UniversityProfileDraft>({
    resolver: zodResolver(universityProfileSchema),
    mode: "onChange",
    defaultValues: { registered_name: "", address: "", rep_name: "", rep_title: "" },
  });
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["university-profile"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/profile")
        .then((r) => r.data as { university: UniversityProfile }),
    enabled: !!account,
  });

  const uni = data?.university;
  const displayLogoUrl = logoPreviewUrl ?? uni?.logo_url ?? null;
  const displaySigUrl = sigPreviewUrl ?? uni?.rep_signature_url ?? null;

  const save = useMutation({
    mutationFn: () => {
      if (!editing) return preconfiguredAxios.patch("/api/university/profile", {});
      const values = form.getValues();
      const payload = Object.fromEntries(
        SECTION_FIELDS[editing].map((key) => [key, values[key]]),
      );
      return preconfiguredAxios.patch("/api/university/profile", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-profile"] });
      queryClient.invalidateQueries({ queryKey: getUniversityControllerMeQueryKey() });
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
    onError: (e: Error) => {
      setLogoPreviewUrl(null);
      toast.error(e.message);
    },
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
    onError: (e: Error) => {
      setSigPreviewUrl(null);
      toast.error(e.message);
    },
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
    form.setValue(key as keyof UniversityProfileDraft, value, { shouldDirty: true, shouldValidate: true });
  }
  function startEdit(section: SectionKey, keys: string[]) {
    const seed: Record<string, string> = {};
    (Object.keys(universityProfileSchema.shape) as string[]).forEach((k) => (seed[k] = persisted(k)));
    setDraft(seed);
    form.reset(seed as UniversityProfileDraft);
    void form.trigger(keys as (keyof UniversityProfileDraft)[]);
    setEditing(section);
  }
  function cancelEdit() {
    setEditing(null);
    setDraft({});
    form.reset();
  }

  const signatoryComplete = uni?.rep_name && uni?.rep_title && uni?.rep_signature_url;

  function fieldError(field: string) {
    return form.formState.errors[field as keyof UniversityProfileDraft]?.message;
  }

  function isSectionValid(sectionKey: SectionKey) {
    return SECTION_FIELDS[sectionKey].every((key) => {
      const value = form.getValues(key).trim();
      return value && !form.formState.errors[key];
    });
  }

  const textField = (sectionKey: SectionKey, field: string, label: string) => {
    const isEditing = editing === sectionKey;
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <Label htmlFor={field} className="sm:w-44 sm:flex-shrink-0 sm:truncate text-gray-400">
          {label}
        </Label>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <Input
              id={field}
              aria-invalid={!!fieldError(field)}
              aria-describedby={fieldError(field) ? `${field}-error` : undefined}
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
          {isEditing && fieldError(field) && (
            <p id={`${field}-error`} className="text-destructive text-xs">{fieldError(field)}</p>
          )}
        </div>
      </div>
    );
  };

  const editControls = (sectionKey: SectionKey, keys: string[]) => {
    if (!isSuperadmin) return null;
    return editing === sectionKey ? (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            const valid = await form.trigger(keys as (keyof UniversityProfileDraft)[]);
            if (valid) save.mutate();
          }}
          disabled={save.isPending || !isSectionValid(sectionKey)}
        >
          {save.isPending && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </div>
    ) : (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => startEdit(sectionKey, keys)}>
          <Pencil /> Edit
        </Button>
      </div>
    );
  };

  const sectionTrigger = (Icon: typeof Building2, title: string) => (
    <AccordionTrigger className="cursor-pointer px-5 py-4 hover:no-underline">
      <span className="flex items-center gap-3 text-sm font-semibold text-gray-900">
        <Icon className="text-primary h-4 w-4" />
        {title}
      </span>
    </AccordionTrigger>
  );

  return (
    <PageContainer className="max-w-2xl space-y-6">
      {/* Header: logo circle + title */}
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => isSuperadmin && logoRef.current?.click()}
            className={cn(
              "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 bg-gray-50",
              isSuperadmin && "cursor-pointer hover:opacity-80 transition-opacity",
              !isSuperadmin && "cursor-default",
            )}
            disabled={uploadLogo.isPending}
          >
            {uploadLogo.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : displayLogoUrl ? (
              <img src={displayLogoUrl} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-7 w-7 text-gray-400" />
            )}
          </button>
          {isSuperadmin && (
            <span
              onClick={() => logoRef.current?.click()}
              className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm"
            >
              <Camera className="h-3 w-3 text-gray-500" />
            </span>
          )}
          <input
            ref={logoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setLogoPreviewUrl(URL.createObjectURL(f));
              uploadLogo.mutate(f);
              e.target.value = "";
            }}
          />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {account.university.registered_name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Institution details and the signatory used on your MOA templates.
          </p>
        </div>
      </div>

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
        <AccordionItem value="university">
          {sectionTrigger(Building2, "University Details")}
          <AccordionContent className="space-y-4 px-5 pb-5">
            {editing === "university" && !form.formState.isValid && (
              <p className="rounded-[0.33em] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Complete the highlighted fields before saving this section.
              </p>
            )}
            {textField("university", "registered_name", "Registered name")}
            {textField("university", "address", "Address (used in MOAs)")}
            {editControls("university", ["registered_name", "address"])}
          </AccordionContent>
        </AccordionItem>

        {/* 2 — Representative Details */}
        <AccordionItem value="representative">
          {sectionTrigger(UserRound, "Representative Details")}
          <AccordionContent className="space-y-4 px-5 pb-5">
            {editing === "representative" && !form.formState.isValid && (
              <p className="rounded-[0.33em] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Complete the highlighted fields before saving this section.
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              The representative&apos;s details will be used on all approved MOAs.
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
                {displaySigUrl ? (
                  <img
                    src={displaySigUrl}
                    alt="Signature"
                    className="h-16 max-w-xs object-contain"
                  />
                ) : (
                  <p className="text-muted-foreground text-xs">No signature uploaded</p>
                )}
              </div>
              <input
                ref={sigRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setSigPreviewUrl(URL.createObjectURL(f));
                  uploadSig.mutate(f);
                  e.target.value = "";
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
                    {uploadSig.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
                    {uni?.rep_signature_url ? "Replace signature" : "Upload signature"}
                  </Button>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </PageContainer>
  );
}
