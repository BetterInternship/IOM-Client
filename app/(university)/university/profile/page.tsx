"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { getUniversityControllerMeQueryKey } from "@/app/api";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
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
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  AlertTriangle,
  Building2,
  Camera,
  CircleAlert,
  CircleCheck,
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

  const { data, isLoading: profileLoading } = useQuery({
    queryKey: ["university-profile"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/profile")
        .then((r) => r.data as { university: UniversityProfile }),
    enabled: !!account,
  });

  const uni = data?.university;
  const displayLogoUrl = logoPreviewUrl ?? uni?.logo_url ?? null;
  const displaySigUrl = uni?.rep_signature_url ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!editing)
        return {
          response: await preconfiguredAxios.patch(
            "/api/university/profile",
            {},
          ),
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
      const response = await preconfiguredAxios.patch(
        "/api/university/profile",
        payload,
      );

      if (signatureFile) {
        const formData = new FormData();
        formData.append("file", signatureFile);
        await preconfiguredAxios.post(
          "/api/university/profile/signature",
          formData,
        );
      }

      return { response, completedSetup };
    },
    onSuccess: async ({ completedSetup }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["university-profile"] }),
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

  const uploadLogo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return preconfiguredAxios.post("/api/university/profile/logo", fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-profile"] });
      queryClient.invalidateQueries({
        queryKey: getUniversityControllerMeQueryKey(),
      });
      toast.success("Logo uploaded");
    },
    onError: (e: Error) => {
      setLogoPreviewUrl(null);
      toast.error(e.message);
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
      <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8">
        <Label
          htmlFor={field}
          className="self-start text-xs font-medium text-slate-500 sm:flex sm:h-8 sm:items-center"
        >
          {label}
        </Label>
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
      </div>
    );
  };

  const sectionTrigger = (
    Icon: typeof Building2,
    title: string,
    badge?: React.ReactNode,
    requiredComplete?: boolean,
  ) => (
    <AccordionTrigger className="cursor-pointer px-5 py-4 hover:no-underline">
      <span className="flex items-center gap-3 text-base font-semibold text-[#061858]">
        {requiredComplete === undefined ? (
          <Icon className="text-primary h-4 w-4" />
        ) : requiredComplete ? (
          <CircleCheck className="text-supportive h-5 w-5" />
        ) : (
          <CircleAlert className="text-destructive h-5 w-5" />
        )}
        {title}
        {badge}
      </span>
    </AccordionTrigger>
  );

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
            uploadLogo.mutate(file);
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

        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={(v) => {
            setOpenSections(v);
          }}
          className={cn(
            setupMode
              ? "space-y-4"
              : "overflow-hidden rounded-[0.33em] border border-blue-100 bg-white shadow-sm",
          )}
        >
          {/* 1 — University Details */}
          <AccordionItem
            value="university"
            className={cn(
              setupMode &&
                "overflow-hidden rounded-[0.33em] border border-blue-100 bg-white shadow-sm",
            )}
          >
            {sectionTrigger(
              Building2,
              setupMode ? "University Information" : "University Details",
              setupMode ? (
                <Badge
                  type={institutionComplete ? "supportive" : "default"}
                  strength="medium"
                >
                  {institutionComplete ? "Completed" : "Required"}
                </Badge>
              ) : undefined,
              setupMode ? institutionComplete : undefined,
            )}
            <AccordionContent className="space-y-4 px-5 pb-5">
              {textField("university", "registered_name", "Registered name")}
              {textField("university", "address", "Address (used in MOAs)")}
            </AccordionContent>
          </AccordionItem>

          {/* 2 — Representative Details */}
          <AccordionItem
            value="representative"
            className={cn(
              setupMode &&
                "overflow-hidden rounded-[0.33em] border border-blue-100 bg-white shadow-sm",
            )}
          >
            {sectionTrigger(
              UserRound,
              setupMode ? "MOA Representative" : "Representative Details",
              setupMode ? (
                <Badge
                  type={representativeComplete ? "supportive" : "default"}
                  strength="medium"
                >
                  {representativeComplete ? "Completed" : "Required"}
                </Badge>
              ) : undefined,
              setupMode ? representativeComplete : undefined,
            )}
            <AccordionContent className="space-y-4 px-5 pb-5">
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {setupMode && (
          <Accordion
            type="single"
            collapsible
            className="rounded-[0.33em] border border-blue-100 bg-white shadow-sm"
          >
            <AccordionItem value="additional" className="border-none">
              {sectionTrigger(
                ImageIcon,
                "Additional Information",
                <span className="text-muted-foreground font-normal">
                  (Optional)
                </span>,
              )}
              <div className="border-primary/20 bg-primary/5 mx-5 mb-4 flex items-center gap-3 rounded-[0.33em] border px-4 py-3 text-sm text-gray-700">
                <span className="bg-primary/10 rounded-full p-2">
                  <Lightbulb className="text-primary h-4 w-4" />
                </span>
                <p>
                  <span className="font-semibold">Tip:</span> Add your
                  university logo so companies can recognize your institution.
                </p>
              </div>
              <AccordionContent className="px-5 pb-5">
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8">
                  <Label className="self-start text-xs font-medium text-slate-500 sm:flex sm:h-10 sm:items-center">
                    University logo
                  </Label>
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
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
