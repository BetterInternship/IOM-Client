"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import {
  getUniversityControllerGetProfileQueryKey,
  getUniversityControllerMeQueryKey,
  universityControllerPatchProfile,
  universityControllerUploadSignature,
  useUniversityControllerGetProfile,
  useUniversityControllerUploadLogo,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { toastPresets } from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MoaSignatureInput,
  type MoaSignatureMode,
} from "@/components/moa-signature-input";
import {
  CollapsibleCardGroup,
  CollapsibleCardSection,
  CollapsibleCardSectionTitle,
} from "@/components/ui/collapsible-card";
import { DetailField } from "@/components/ui/detail-field";
import {
  AlertTriangle,
  Building2,
  Camera,
  ImageIcon,
  Lightbulb,
  Loader2,
  Pencil,
  Upload,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  universityProfileSchema,
  type UniversityProfileDraft,
} from "@/lib/profile-validation";

type SectionKey = "university" | "representative";
type EditingState = SectionKey | "all";

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
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const logoRef = useRef<HTMLInputElement>(null);

  const [openSections, setOpenSections] = useState<string[]>([
    "university",
    "representative",
  ]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const form = useForm<UniversityProfileDraft>({
    resolver: zodResolver(universityProfileSchema),
    mode: "onChange",
    defaultValues: {
      registered_name: "",
      address: "",
      rep_name: "",
      rep_title: "",
    },
  });
  const [signatureMode, setSignatureMode] =
    useState<MoaSignatureMode>("upload");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const { data, isLoading: profileLoading } = useUniversityControllerGetProfile(
    {
      query: { enabled: !!account },
    },
  );

  const uni = data?.university as UniversityProfile | undefined;
  const displayLogoUrl = logoPreviewUrl ?? uni?.logo_url ?? null;
  const displaySigUrl = uni?.rep_signature_url ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!editing)
        return {
          response: await universityControllerPatchProfile({}),
          completedSetup: false,
        };
      const values = form.getValues();
      const completedSetup = Boolean(
        setupMode &&
        values.registered_name.trim() &&
        values.address.trim() &&
        values.rep_name.trim() &&
        values.rep_title.trim() &&
        (uni?.rep_signature_url || signatureFile),
      );
      const keys = setupMode
        ? (Object.keys(
            universityProfileSchema.shape,
          ) as (keyof UniversityProfileDraft)[])
        : editing === "all"
          ? (Object.keys(
              universityProfileSchema.shape,
            ) as (keyof UniversityProfileDraft)[])
          : SECTION_FIELDS[editing];
      const payload = Object.fromEntries(keys.map((key) => [key, values[key]]));
      const response = await universityControllerPatchProfile(payload);

      if (signatureFile) {
        await universityControllerUploadSignature({ file: signatureFile });
      }

      return { response, completedSetup };
    },
    onSuccess: async ({ completedSetup }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerGetProfileQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerMeQueryKey(),
        }),
      ]);
      setSignatureFile(null);
      cancelEdit();
      if (completedSetup) {
        const prefix = pathname.startsWith("/university/") ? "/university" : "";
        router.replace(`${prefix}/templates?setup_complete=1`);
        return;
      }
      toast("Profile saved", toastPresets.success);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadLogo = useUniversityControllerUploadLogo({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerGetProfileQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerMeQueryKey(),
        });
        toast.success("Logo uploaded");
      },
      onError: (e: Error) => {
        setLogoPreviewUrl(null);
        toast.error(e.message);
      },
    },
  });

  const persistedInstitutionComplete = Boolean(
    uni?.registered_name?.trim() && uni.address?.trim(),
  );
  const persistedRepresentativeDetailsComplete = Boolean(
    uni?.rep_name?.trim() && uni.rep_title?.trim(),
  );
  const persistedRepresentativeComplete = Boolean(
    persistedRepresentativeDetailsComplete && uni?.rep_signature_url,
  );
  const setupComplete =
    persistedInstitutionComplete && persistedRepresentativeComplete;
  const setupMode = isSuperadmin && !setupComplete;
  const liveValues = form.watch();
  const institutionComplete = setupMode
    ? Boolean(liveValues.registered_name.trim() && liveValues.address.trim())
    : persistedInstitutionComplete;
  const representativeDetailsComplete = setupMode
    ? Boolean(liveValues.rep_name.trim() && liveValues.rep_title.trim())
    : persistedRepresentativeDetailsComplete;
  const representativeComplete = setupMode
    ? Boolean(
        representativeDetailsComplete &&
        (uni?.rep_signature_url || signatureFile),
      )
    : persistedRepresentativeComplete;

  useEffect(() => {
    if (!uni || !isSuperadmin || !setupMode || editing) return;

    if (!institutionComplete) {
      startEdit("university", ["registered_name", "address"]);
      return;
    }

    startEdit("representative", ["rep_name", "rep_title"]);
  }, [
    editing,
    institutionComplete,
    isSuperadmin,
    representativeDetailsComplete,
    setupMode,
    uni,
  ]);

  if (isLoading || profileLoading || !account) return null;

  function persisted(key: string): string {
    return `${uni?.[key] ?? ""}`;
  }
  function draftVal(key: string): string {
    return key in draft ? draft[key] : persisted(key);
  }
  function setField(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    form.setValue(key as keyof UniversityProfileDraft, value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }
  function startEdit(section: EditingState, keys: string[]) {
    const seed: Record<string, string> = {};
    (Object.keys(universityProfileSchema.shape) as string[]).forEach(
      (k) => (seed[k] = persisted(k)),
    );
    setDraft(seed);
    form.reset(seed as UniversityProfileDraft);
    void form.trigger(keys as (keyof UniversityProfileDraft)[]);
    setEditing(section);
  }
  function cancelEdit() {
    setEditing(null);
    setDraft({});
    setSignatureFile(null);
    form.reset();
  }

  const signatoryComplete =
    uni?.rep_name && uni?.rep_title && uni?.rep_signature_url;

  function fieldError(field: string) {
    return form.formState.errors[field as keyof UniversityProfileDraft]
      ?.message;
  }

  const textField = (sectionKey: SectionKey, field: string, label: string) => {
    const isEditing = setupMode || editing === "all" || editing === sectionKey;
    return (
      <DetailField label={<Label htmlFor={field}>{label}</Label>}>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <Input
              id={field}
              aria-invalid={!!fieldError(field)}
              aria-describedby={
                fieldError(field) ? `${field}-error` : undefined
              }
              value={draftVal(field)}
              onChange={(e) => setField(field, e.target.value)}
            />
          ) : (
            <p className="flex min-h-8 items-center truncate text-sm font-medium text-gray-900">
              {persisted(field) || (
                <span className="text-muted-foreground font-normal">
                  Not set
                </span>
              )}
            </p>
          )}
          {isEditing && fieldError(field) && (
            <p id={`${field}-error`} className="text-destructive text-xs">
              {fieldError(field)}
            </p>
          )}
        </div>
      </DetailField>
    );
  };

  return (
    <div className="relative isolate min-h-screen flex-1 bg-slate-50/70">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[url('/bg2.png')] bg-cover bg-center bg-no-repeat opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-gradient-to-b from-white/90 via-white/50 to-transparent" />
      <PageContainer className="relative z-10 space-y-8 pb-12">
        <input
          ref={logoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setLogoPreviewUrl(URL.createObjectURL(file));
            uploadLogo.mutate({ data: { file } });
            event.target.value = "";
          }}
        />

        {setupMode && (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              You&apos;re almost ready to offer MOAs!
            </h1>
            <div className="w-full max-w-sm space-y-3 sm:w-80">
              <p className="text-sm font-medium text-gray-700">
                {
                  [institutionComplete, representativeComplete].filter(
                    (complete) => !complete,
                  ).length
                }{" "}
                required{" "}
                {[institutionComplete, representativeComplete].filter(
                  (complete) => !complete,
                ).length === 1
                  ? "step"
                  : "steps"}{" "}
                remaining
              </p>
              <div
                className="flex gap-1.5"
                aria-label={`${[institutionComplete, representativeComplete].filter(Boolean).length} of 2 setup steps completed`}
              >
                {[institutionComplete, representativeComplete].map(
                  (complete, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-1.5 flex-1 rounded-full",
                        complete ? "bg-primary" : "bg-gray-200",
                      )}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* Completed profile header */}
        {!setupMode && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => editing === "all" && logoRef.current?.click()}
                  disabled={editing !== "all" || uploadLogo.isPending}
                  className={cn(
                    "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 bg-gray-50",
                    editing === "all"
                      ? "cursor-pointer transition-opacity hover:opacity-80"
                      : "cursor-default",
                  )}
                >
                  {uploadLogo.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  ) : displayLogoUrl ? (
                    <img
                      src={displayLogoUrl}
                      alt="University logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-7 w-7 text-gray-400" />
                  )}
                </button>
                {editing === "all" && (
                  <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                    <Camera className="h-3 w-3 text-gray-500" />
                  </span>
                )}
              </div>
              <PageHeader title={account.university.registered_name} />
            </div>
            {isSuperadmin &&
              (editing === "all" ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={cancelEdit}
                    disabled={save.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      const keys = Object.keys(
                        universityProfileSchema.shape,
                      ) as (keyof UniversityProfileDraft)[];
                      const valid = await form.trigger(keys);
                      if (valid) save.mutate();
                    }}
                    disabled={
                      save.isPending ||
                      !form.formState.isValid ||
                      (!form.formState.isDirty && !signatureFile)
                    }
                  >
                    {save.isPending && <Loader2 className="animate-spin" />}
                    Save changes
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() =>
                    startEdit("all", Object.keys(universityProfileSchema.shape))
                  }
                >
                  <Pencil /> Edit
                </Button>
              ))}
          </div>
        )}

        {!setupMode && !signatoryComplete && isSuperadmin && (
          <div className="border-warning/30 bg-warning/10 flex items-start gap-3 rounded-[0.33em] border p-4 text-sm">
            <AlertTriangle className="text-warning mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="text-gray-700">
              Complete the representative details (name, title, and signature
              image) before you can offer MOA templates to companies.
            </p>
          </div>
        )}

        <CollapsibleCardGroup
          type="multiple"
          value={openSections}
          onValueChange={(v) => {
            setOpenSections(v);
          }}
          variant={setupMode ? "separate" : "grouped"}
        >
          {/* 1 — University Details */}
          <CollapsibleCardSection
            value="university"
            trigger={
              <CollapsibleCardSectionTitle
                icon={Building2}
                title={
                  setupMode ? "University Information" : "University Details"
                }
                badge={
                  setupMode ? (
                    <Badge
                      type={institutionComplete ? "supportive" : "default"}
                      strength="medium"
                    >
                      {institutionComplete ? "Completed" : "Required"}
                    </Badge>
                  ) : undefined
                }
                requiredComplete={setupMode ? institutionComplete : undefined}
              />
            }
            contentClassName="space-y-4 px-5 pb-5"
          >
            {textField("university", "registered_name", "Registered name")}
            {textField("university", "address", "Address (used in MOAs)")}
          </CollapsibleCardSection>

          {/* 2 — Representative Details */}
          <CollapsibleCardSection
            value="representative"
            trigger={
              <CollapsibleCardSectionTitle
                icon={UserRound}
                title={
                  setupMode ? "MOA Representative" : "Representative Details"
                }
                badge={
                  setupMode ? (
                    <Badge
                      type={representativeComplete ? "supportive" : "default"}
                      strength="medium"
                    >
                      {representativeComplete ? "Completed" : "Required"}
                    </Badge>
                  ) : undefined
                }
                requiredComplete={
                  setupMode ? representativeComplete : undefined
                }
              />
            }
            contentClassName="space-y-4 px-5 pb-5"
          >
            <p className="text-muted-foreground text-xs">
              The representative&apos;s details will be used on all approved
              MOAs.
            </p>
            {textField("representative", "rep_name", "Signatory name")}
            {textField("representative", "rep_title", "Signatory title")}

            {displaySigUrl && (
              <div className="rounded-[0.33em] border border-blue-100 bg-white p-4">
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Current signature
                </p>
                <img
                  src={displaySigUrl}
                  alt="Signature"
                  className="h-16 max-w-xs object-contain"
                />
              </div>
            )}

            {isSuperadmin && (setupMode || editing === "all") && (
              <div className="space-y-3">
                <MoaSignatureInput
                  mode={signatureMode}
                  onModeChange={setSignatureMode}
                  text=""
                  onTextChange={() => undefined}
                  file={signatureFile}
                  onFileChange={setSignatureFile}
                  modes={["upload", "draw"]}
                />
              </div>
            )}
          </CollapsibleCardSection>
        </CollapsibleCardGroup>

        {setupMode && (
          <CollapsibleCardGroup type="single" collapsible variant="grouped">
            <CollapsibleCardSection
              value="additional"
              trigger={
                <CollapsibleCardSectionTitle
                  icon={ImageIcon}
                  title="Additional Information"
                  badge={
                    <span className="text-muted-foreground font-normal">
                      (Optional)
                    </span>
                  }
                />
              }
              persistentContent={
                <div className="border-primary/20 bg-primary/5 mx-5 mb-4 flex items-center gap-3 rounded-[0.33em] border px-4 py-3 text-sm text-gray-700">
                  <span className="bg-primary/10 rounded-full p-2">
                    <Lightbulb className="text-primary h-4 w-4" />
                  </span>
                  <p>
                    <span className="font-semibold">Tip:</span> Add your
                    university logo so companies can recognize your institution.
                  </p>
                </div>
              }
              contentClassName="px-5 pb-5"
            >
              <DetailField
                label="University logo"
                labelClassName="sm:min-h-10"
                className="gap-3"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 bg-gray-50">
                    {uploadLogo.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    ) : displayLogoUrl ? (
                      <img
                        src={displayLogoUrl}
                        alt="University logo"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-gray-400" />
                    )}
                  </div>
                  {(setupMode || editing === "all") && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoRef.current?.click()}
                      disabled={uploadLogo.isPending}
                    >
                      <Upload />
                      {displayLogoUrl ? "Replace logo" : "Upload logo"}
                    </Button>
                  )}
                </div>
              </DetailField>
            </CollapsibleCardSection>
          </CollapsibleCardGroup>
        )}

        {setupMode && editing && (
          <div className="flex justify-end gap-2">
            <Button
              onClick={async () => {
                const keys = Object.keys(
                  universityProfileSchema.shape,
                ) as (keyof UniversityProfileDraft)[];
                const valid = await form.trigger(keys);
                if (valid) save.mutate();
              }}
              disabled={
                save.isPending ||
                !form.formState.isValid ||
                (!displaySigUrl && !signatureFile)
              }
            >
              {save.isPending && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </div>
        )}
      </PageContainer>
    </div>
  );
}
