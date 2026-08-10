"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
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
import { SignatoryCard } from "@/components/signatory-card";
import { SignatoryEmailInput } from "@/components/signatory-email-input";
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
  ArrowDown,
  ArrowUp,
  Building2,
  Camera,
  ImageIcon,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  universityProfileSchema,
  universitySignatoriesComplete,
  type UniversityProfileDraft,
  type UniversitySignatoryDraft,
} from "@/lib/profile-validation";

type SectionKey = "university" | "signatories" | "accountHolder";
type EditingState = SectionKey | "all";

const SECTION_FIELDS: Record<SectionKey, (keyof UniversityProfileDraft)[]> = {
  university: ["registered_name", "address"],
  signatories: ["signatories"],
  accountHolder: ["account_holder_name", "account_holder_title"],
};

interface UniversityProfile {
  registered_name: string | null;
  address: string | null;
  account_holder_name: string | null;
  account_holder_title: string | null;
  logo_url: string | null;
  signatories: UniversitySignatoryDraft[] | null;
  [key: string]: string | string[] | UniversitySignatoryDraft[] | null;
}

type UniversityProfileMode = "setup" | "profile";

const newSignatoryId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function UniversityProfileContent({
  mode,
}: {
  mode: UniversityProfileMode;
}) {
  const { account, isLoading, canManageUniversity } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoRef = useRef<HTMLInputElement>(null);
  const setupCompletionRedirectRef = useRef(false);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const seedRef = useRef<string | null>(null);
  const form = useForm<UniversityProfileDraft>({
    resolver: zodResolver(universityProfileSchema),
    mode: "onChange",
    defaultValues: {
      registered_name: "",
      address: "",
      account_holder_name: "",
      account_holder_title: "",
      signatories: [
        { id: newSignatoryId(), name: "", title: "" },
        { id: newSignatoryId(), name: "", title: "" },
      ],
    },
  });
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "signatories",
    keyName: "formRowId",
  });
  const [pendingSigs, setPendingSigs] = useState<Record<string, File>>({});
  const [sigModes, setSigModes] = useState<Record<string, MoaSignatureMode>>(
    {},
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const { data, isLoading: profileLoading } = useUniversityControllerGetProfile(
    {
      query: { enabled: !!account },
    },
  );

  const uni = data?.university as UniversityProfile | undefined;
  const accountEmails = Array.isArray(data?.accountEmails)
    ? data.accountEmails
    : [];
  const displayLogoUrl = logoPreviewUrl ?? uni?.logo_url ?? null;

  const signatoriesComplete = (list: UniversitySignatoryDraft[]) =>
    universitySignatoriesComplete(
      list.map((s) => ({
        ...s,
        // A pending upload counts as a signature while still in edit mode.
        signatureUrl:
          s.signatureUrl?.trim() || (pendingSigs[s.id] ? "pending" : undefined),
      })),
    );

  const save = useMutation({
    mutationFn: async () => {
      if (!editing)
        return {
          response: await universityControllerPatchProfile({}),
          completedSetup: false,
        };
      const values = form.getValues();
      const signatories = values.signatories.map((s) => ({
        id: s.id,
        name: s.name,
        title: s.title,
        ...(s.signatureUrl ? { signatureUrl: s.signatureUrl } : {}),
        ...(s.signatureText?.trim()
          ? {
              signatureText: s.signatureText.trim(),
              signatureType: "text" as const,
            }
          : {}),
        ...(s.email?.trim() ? { email: s.email.trim() } : {}),
      }));
      const missingSignature = signatories.find(
        (s) =>
          !s.signatureUrl?.trim() &&
          !s.signatureText?.trim() &&
          !pendingSigs[s.id],
      );
      if (missingSignature) {
        throw new Error(
          `Add a signature for "${
            missingSignature.name.trim() || "this signatory"
          }" before saving.`,
        );
      }
      const completedSetup = Boolean(
        isSetupMode &&
        values.registered_name.trim() &&
        values.address.trim() &&
        signatoriesComplete(signatories),
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

      const uploaded: string[] = [];
      for (const [id, file] of Object.entries(pendingSigs)) {
        try {
          await universityControllerUploadSignature(id, { file });
          uploaded.push(id);
        } catch (e) {
          setPendingSigs((prev) => {
            const next = { ...prev };
            for (const done of uploaded) delete next[done];
            return next;
          });
          const signatory = signatories.find((s) => s.id === id);
          const label = signatory?.name.trim() || "a signatory";
          const message = e instanceof Error ? e.message : "unknown error";
          throw new Error(
            `Could not upload the signature for "${label}". ${message}`,
          );
        }
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
      setPendingSigs({});
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
  const persistedSignatories = Array.isArray(uni?.signatories)
    ? uni!.signatories
    : [];
  const persistedSignatoriesComplete =
    universitySignatoriesComplete(persistedSignatories);
  const setupComplete = isUniversitySetupComplete(uni);
  const isSetupRoute = mode === "setup";
  const isSetupMode = isSetupRoute && canManageUniversity;
  const liveValues = form.watch();
  const formIsValid = universityProfileSchema.safeParse(liveValues).success;
  const hasChanges =
    seedRef.current !== null &&
    JSON.stringify(liveValues) !== seedRef.current;
  const institutionComplete = isSetupMode
    ? Boolean(liveValues.registered_name.trim() && liveValues.address.trim())
    : persistedInstitutionComplete;
  const representativeComplete = isSetupMode
    ? signatoriesComplete(liveValues.signatories ?? [])
    : persistedSignatoriesComplete;

  useEffect(() => {
    if (!uni || !isSetupMode || setupComplete || editing) return;

    if (!institutionComplete) {
      startEdit("university", ["registered_name", "address"]);
      return;
    }

    startEdit("signatories", ["signatories"]);
  }, [editing, institutionComplete, isSetupMode, setupComplete, uni]);

  useEffect(() => {
    if (
      !isSetupRoute ||
      isLoading ||
      profileLoading ||
      !account ||
      setupCompletionRedirectRef.current
    )
      return;

    if (!canManageUniversity || setupComplete) {
      router.replace("/profile");
    }
  }, [
    account,
    isLoading,
    isSetupRoute,
    canManageUniversity,
    profileLoading,
    router,
    setupComplete,
  ]);

  const isLeavingSetupRoute =
    isSetupRoute && (!canManageUniversity || setupComplete);

  if (isLoading || profileLoading || !account || isLeavingSetupRoute)
    return null;

  function persisted(key: string): string {
    return `${uni?.[key] ?? ""}`;
  }
  function startEdit(section: EditingState, keys: string[]) {
    const seed = {
      registered_name: uni?.registered_name ?? "",
      address: uni?.address ?? "",
      account_holder_name: uni?.account_holder_name ?? "",
      account_holder_title: uni?.account_holder_title ?? "",
      signatories:
        Array.isArray(uni?.signatories) && uni!.signatories.length
          ? uni!.signatories.map((s) => ({ ...s }))
          : [
              { id: newSignatoryId(), name: "", title: "" },
              { id: newSignatoryId(), name: "", title: "" },
            ],
    };
    seedRef.current = JSON.stringify(seed);
    form.reset(seed);
    void form.trigger(keys as (keyof UniversityProfileDraft)[]);
    setEditing(section);
  }
  function cancelEdit() {
    setEditing(null);
    setPendingSigs({});
    seedRef.current = null;
    form.reset();
  }

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

  const editingSignatories =
    isSetupMode || editing === "all" || editing === "signatories";

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
            {canManageUniversity &&
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
                      !formIsValid ||
                      !signatoriesComplete(liveValues.signatories ?? []) ||
                      (!hasChanges && !Object.keys(pendingSigs).length)
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

        {!isSetupMode && !persistedSignatoriesComplete && canManageUniversity && (
          <div className="border-warning/30 bg-warning/10 flex items-start gap-3 rounded-[0.33em] border p-4 text-sm">
            <AlertTriangle className="text-warning mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="text-gray-700">
              Complete the signatory details (name, title, and signature image
              for at least two signatories) before you can offer MOA templates
              to companies.
            </p>
          </div>
        )}

        <CollapsibleCardGroup
          type="multiple"
          defaultValue={["university", "signatories"]}
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

          {/* 2 — Signatories */}
          <CollapsibleCardSection
            value="signatories"
            trigger={
              <CollapsibleCardSectionTitle
                icon={UserRound}
                title={isSetupMode ? "MOA Signatories" : "Signatory Details"}
                requiredComplete={
                  isSetupMode ? representativeComplete : undefined
                }
              />
            }
            contentClassName="space-y-4 px-5 pb-5"
          >
            <p className="text-muted-foreground text-xs">
              Add 2 to 5 signatories. Their details and signatures will be used
              on all approved MOAs, in this order.
            </p>

            {!editingSignatories ? (
              <div className="space-y-3">
                {persistedSignatories.length === 0 && (
                  <p className="text-muted-foreground text-sm">Not set</p>
                )}
                {persistedSignatories.map((s, index) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-[0.33em] border border-gray-200 bg-white p-3"
                  >
                    <span className="text-muted-foreground w-6 text-center text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {s.name || "—"}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {s.title || "No title"}
                      </p>
                      {s.email?.trim() && (
                        <p className="text-muted-foreground truncate text-xs">
                          {s.email}
                        </p>
                      )}
                    </div>
                    {s.signatureUrl ? (
                      <img
                        src={s.signatureUrl}
                        alt="Signature"
                        className="h-10 max-w-24 object-contain"
                      />
                    ) : s.signatureText?.trim() ? (
                      <span className="text-muted-foreground max-w-24 truncate font-serif text-sm italic">
                        {s.signatureText}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        No signature
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const isComplete = Boolean(
                    field.name.trim() &&
                    field.title.trim() &&
                    (field.signatureUrl?.trim() ||
                      !!pendingSigs[field.id] ||
                      !!field.signatureText?.trim()),
                  );
                  return (
                    <SignatoryCard
                      key={field.formRowId}
                      title={`Signatory ${index + 1}`}
                      complete={isComplete}
                      actions={
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === 0}
                            onClick={() => move(index, index - 1)}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === fields.length - 1}
                            onClick={() => move(index, index + 1)}
                          >
                            <ArrowDown />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            scheme="destructive"
                            disabled={fields.length <= 2}
                            onClick={() => remove(index)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      }
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Signatory name</Label>
                          <Input
                            aria-invalid={
                              !!form.formState.errors.signatories?.[index]?.name
                            }
                            {...form.register(`signatories.${index}.name`)}
                          />
                          {form.formState.errors.signatories?.[index]?.name && (
                            <p className="text-destructive text-xs">
                              {
                                form.formState.errors.signatories?.[index]?.name
                                  ?.message
                              }
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Signatory title</Label>
                          <Input
                            aria-invalid={
                              !!form.formState.errors.signatories?.[index]
                                ?.title
                            }
                            {...form.register(`signatories.${index}.title`)}
                          />
                          {form.formState.errors.signatories?.[index]
                            ?.title && (
                            <p className="text-destructive text-xs">
                              {
                                form.formState.errors.signatories?.[index]
                                  ?.title?.message
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      <SignatoryEmailInput
                        id={`signatory-${index}-email`}
                        value={liveValues.signatories?.[index]?.email ?? ""}
                        onChange={(v) =>
                          form.setValue(`signatories.${index}.email`, v, {
                            shouldDirty: true,
                          })
                        }
                        suggestions={accountEmails}
                        error={
                          form.formState.errors.signatories?.[index]?.email
                            ?.message
                        }
                      />

                      <MoaSignatureInput
                        mode={
                          sigModes[field.id] ??
                          (liveValues.signatories?.[index]?.signatureText?.trim()
                            ? "type"
                            : "upload")
                        }
                        onModeChange={(m) => {
                          setSigModes((prev) => ({
                            ...prev,
                            [field.id]: m,
                          }));
                          if (m === "type") {
                            form.setValue(
                              `signatories.${index}.signatureUrl`,
                              "",
                              { shouldDirty: true },
                            );
                          } else {
                            form.setValue(
                              `signatories.${index}.signatureText`,
                              "",
                              { shouldDirty: true },
                            );
                          }
                        }}
                        text={liveValues.signatories?.[index]?.signatureText ?? ""}
                        onTextChange={(t) =>
                          form.setValue(`signatories.${index}.signatureText`, t, {
                            shouldDirty: true,
                          })
                        }
                        file={pendingSigs[field.id] ?? null}
                        onFileChange={(file) =>
                          setPendingSigs((prev) => {
                            const next = { ...prev };
                            if (file) next[field.id] = file;
                            else delete next[field.id];
                            return next;
                          })
                        }
                        modes={["type", "upload", "draw"]}
                      />
                    </SignatoryCard>
                  );
                })}

                {fields.length < 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        id: newSignatoryId(),
                        name: "",
                        title: "",
                      })
                    }
                  >
                    <Plus /> Add signatory
                  </Button>
                )}
                {fields.length >= 5 && (
                  <p className="text-muted-foreground text-xs">
                    Maximum of 5 signatories reached.
                  </p>
                )}
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
                whoever&apos;s actually sending the email, separate from the MOA
                representative above.
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
                !formIsValid ||
                !signatoriesComplete(liveValues.signatories ?? [])
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
