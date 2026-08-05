"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  isUniversitySetupComplete,
  useUniversityProfile,
} from "@/app/providers/university-profile.provider";
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
import { FileDropTarget } from "@/components/ui/use-file-drop";
import {
  AlertTriangle,
  Building2,
  Camera,
  ImageIcon,
  Loader2,
  Mail,
  Pencil,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  universityProfileSchema,
  type UniversityProfileDraft,
} from "@/lib/profile-validation";

type SectionKey = "university" | "representative" | "accountHolder";
type EditingState = SectionKey | "all";

const SECTION_FIELDS: Record<SectionKey, (keyof UniversityProfileDraft)[]> = {
  university: ["registered_name", "address"],
  representative: ["rep_name", "rep_title"],
  accountHolder: ["account_holder_name", "account_holder_title"],
};

interface UniversityProfile {
  registered_name: string | null;
  address: string | null;
  rep_name: string | null;
  rep_title: string | null;
  rep_signature_url: string | null;
  account_holder_name: string | null;
  account_holder_title: string | null;
  logo_url: string | null;
  [key: string]: string | null;
}

type UniversityProfileMode = "setup" | "profile";

export function UniversityProfileContent({
  mode,
}: {
  mode: UniversityProfileMode;
}) {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoRef = useRef<HTMLInputElement>(null);
  const setupCompletionRedirectRef = useRef(false);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const form = useForm<UniversityProfileDraft>({
    resolver: zodResolver(universityProfileSchema),
    mode: "onChange",
    defaultValues: {
      registered_name: "",
      address: "",
      rep_name: "",
      rep_title: "",
      account_holder_name: "",
      account_holder_title: "",
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
        isSetupMode &&
        values.registered_name.trim() &&
        values.address.trim() &&
        values.rep_name.trim() &&
        values.rep_title.trim() &&
        (uni?.rep_signature_url || signatureFile),
      );
      const keys = isSetupMode
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
      if (completedSetup) setupCompletionRedirectRef.current = true;
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
        router.replace("/templates?setup_complete=1");
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

  const selectLogo = (file: File) => {
    setLogoPreviewUrl(URL.createObjectURL(file));
    uploadLogo.mutate({ data: { file } });
  };

  const persistedInstitutionComplete = Boolean(
    uni?.registered_name?.trim() && uni.address?.trim(),
  );
  const persistedRepresentativeDetailsComplete = Boolean(
    uni?.rep_name?.trim() && uni.rep_title?.trim(),
  );
  const persistedRepresentativeComplete = Boolean(
    persistedRepresentativeDetailsComplete && uni?.rep_signature_url,
  );
  const setupComplete = isUniversitySetupComplete(uni);
  const isSetupRoute = mode === "setup";
  const isSetupMode = isSetupRoute && isSuperadmin;
  const liveValues = form.watch();
  const institutionComplete = isSetupMode
    ? Boolean(liveValues.registered_name.trim() && liveValues.address.trim())
    : persistedInstitutionComplete;
  const representativeDetailsComplete = isSetupMode
    ? Boolean(liveValues.rep_name.trim() && liveValues.rep_title.trim())
    : persistedRepresentativeDetailsComplete;
  const representativeComplete = isSetupMode
    ? Boolean(
        representativeDetailsComplete &&
        (uni?.rep_signature_url || signatureFile),
      )
    : persistedRepresentativeComplete;

  useEffect(() => {
    if (!uni || !isSetupMode || setupComplete || editing) return;

    if (!institutionComplete) {
      startEdit("university", ["registered_name", "address"]);
      return;
    }

    startEdit("representative", ["rep_name", "rep_title"]);
  }, [
    editing,
    institutionComplete,
    representativeDetailsComplete,
    isSetupMode,
    setupComplete,
    uni,
  ]);

  useEffect(() => {
    if (
      !isSetupRoute ||
      isLoading ||
      profileLoading ||
      !account ||
      setupCompletionRedirectRef.current
    )
      return;

    if (!isSuperadmin || setupComplete) {
      router.replace("/profile");
    }
  }, [
    account,
    isLoading,
    isSetupRoute,
    isSuperadmin,
    profileLoading,
    router,
    setupComplete,
  ]);

  const isLeavingSetupRoute = isSetupRoute && (!isSuperadmin || setupComplete);

  if (isLoading || profileLoading || !account || isLeavingSetupRoute)
    return null;

  function persisted(key: string): string {
    return `${uni?.[key] ?? ""}`;
  }
  function startEdit(section: EditingState, keys: string[]) {
    const seed: Record<string, string> = {};
    (Object.keys(universityProfileSchema.shape) as string[]).forEach(
      (k) => (seed[k] = persisted(k)),
    );
    form.reset(seed as UniversityProfileDraft);
    void form.trigger(keys as (keyof UniversityProfileDraft)[]);
    setEditing(section);
  }
  function cancelEdit() {
    setEditing(null);
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
    const isEditing =
      isSetupMode || editing === "all" || editing === sectionKey;
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
              {...form.register(field as keyof UniversityProfileDraft)}
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
            selectLogo(file);
            event.target.value = "";
          }}
        />

        {isSetupMode && (
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            You&apos;re almost ready to offer MOAs!
          </h1>
        )}

        {/* Completed profile header */}
        {!isSetupMode && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <FileDropTarget
                accept="image/jpeg,image/png,image/webp"
                disabled={editing !== "all" || uploadLogo.isPending}
                onFiles={([file]) => file && selectLogo(file)}
                className="relative shrink-0 rounded-full"
              >
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
              </FileDropTarget>
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

        {!isSetupMode && !signatoryComplete && isSuperadmin && (
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
          defaultValue={["university", "representative"]}
          variant={isSetupMode ? "separate" : "grouped"}
        >
          {/* 1 — University Details */}
          <CollapsibleCardSection
            value="university"
            trigger={
              <CollapsibleCardSectionTitle
                icon={Building2}
                title={
                  isSetupMode ? "University Information" : "University Details"
                }
                requiredComplete={isSetupMode ? institutionComplete : undefined}
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
                  isSetupMode ? "MOA Representative" : "Representative Details"
                }
                requiredComplete={
                  isSetupMode ? representativeComplete : undefined
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

            {isSuperadmin && (isSetupMode || editing === "all") && (
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

          {/* 3 — Account Holder (not part of MOA setup — governs only the
              manual invite email's sign-off, so it's kept off the setup
              wizard entirely and only shown on the regular profile page). */}
          {!isSetupMode && (
            <CollapsibleCardSection
              value="accountHolder"
              trigger={
                <CollapsibleCardSectionTitle
                  icon={Mail}
                  title="Account Holder"
                />
              }
              contentClassName="space-y-4 px-5 pb-5"
            >
              <p className="text-muted-foreground text-xs">
                Used to sign off invite emails sent to companies — this is
                whoever&apos;s actually sending the email, separate from the
                MOA representative above.
              </p>
              {textField("accountHolder", "account_holder_name", "Name")}
              {textField("accountHolder", "account_holder_title", "Title")}
            </CollapsibleCardSection>
          )}
        </CollapsibleCardGroup>

        {isSetupMode && editing && (
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
