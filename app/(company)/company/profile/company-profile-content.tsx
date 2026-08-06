"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import {
  getCompanyControllerGetDocumentsQueryKey,
  getCompanyControllerGetVerificationQueryKey,
  getCompanyControllerMeQueryKey,
  useCompanyControllerGetDocuments,
  useCompanyControllerPatchProfile,
  useCompanyControllerUploadDocument,
  type CompanyDocumentDto,
  type PatchCompanyProfileDto,
} from "@/app/api";
import { cn } from "@/lib/utils";
import {
  companyProfileSchema,
  type CompanyProfileDraft,
} from "@/lib/profile-validation";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FileDropTarget } from "@/components/ui/use-file-drop";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  CollapsibleCardGroup,
  CollapsibleCardSection,
  CollapsibleCardSectionTitle,
} from "@/components/ui/collapsible-card";
import { DetailField } from "@/components/ui/detail-field";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import { toastPresets } from "@/components/sonner-toaster";
import {
  Building2,
  CircleAlert,
  CircleCheck,
  Eye,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { DocumentPreview } from "./document-preview";
import { ProfileHeader } from "./profile-header";

type SectionKey = "company" | "documents";

const COSMETIC_KEYS = ["description", "website", "phone", "industry"];

const COMPANY_TYPES = [
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "government_agency", label: "Government Agency" },
];
const DOC_TYPES = [
  { value: "business_permit", label: "Business Permit" },
  { value: "sec_dti_registration", label: "SEC/DTI Registration" },
  { value: "mayor_permit", label: "Mayor's Permit" },
];

type CompanyProfileMode = "setup" | "profile";

export function CompanyProfileContent({ mode }: { mode: CompanyProfileMode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openModal } = useModal();
  const { confirmAction } = useIomModalRegistry();
  const inviteUniId = searchParams.get("invite_uni");
  const inviteTemplateId = searchParams.get("invite_template");
  const inviteId = searchParams.get("invite_id");

  const { company, isLoading } = useCompanyProfile();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const form = useForm<CompanyProfileDraft>({
    resolver: zodResolver(companyProfileSchema),
    mode: "onChange",
    defaultValues: {
      registered_name: "",
      registered_address: "",
      company_type: "",
      description: "",
      website: "",
      phone: "",
      industry: "",
    },
  });

  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [awaitingCompletionReview, setAwaitingCompletionReview] =
    useState(false);
  const documentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: docsData } = useCompanyControllerGetDocuments({
    query: { enabled: !!company },
  });

  const { data: verification, isLoading: vLoading } =
    useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const isSetupMode = mode === "setup";

  useEffect(() => {
    if (!company) return;
    const seed: CompanyProfileDraft = {
      registered_name: company.registered_name ?? "",
      registered_address: company.registered_address ?? "",
      company_type: company.company_type ?? "",
      description: String(company.cosmetic?.description ?? ""),
      website: String(company.cosmetic?.website ?? ""),
      phone: String(company.cosmetic?.phone ?? ""),
      industry: String(company.cosmetic?.industry ?? ""),
    };
    form.reset(seed);
    void form.trigger();
  }, [company, form]);

  // Continue an invitation only after the server has confirmed setup completion.
  useEffect(() => {
    if (
      !isSetupMode ||
      !inviteUniId ||
      isLoading ||
      vLoading ||
      !company ||
      !verification
    )
      return;
    if (verification.status === "incomplete") return;
    if (awaitingCompletionReview && verification.status === "pending") return;
    const params = new URLSearchParams({ open_university_id: inviteUniId });
    if (inviteTemplateId) params.set("template_id", inviteTemplateId);
    if (inviteId) params.set("invite_id", inviteId);
    router.replace(`/dashboard?${params}`);
  }, [
    awaitingCompletionReview,
    inviteUniId,
    isLoading,
    isSetupMode,
    vLoading,
    company,
    verification,
    inviteTemplateId,
    inviteId,
    router,
  ]);

  useEffect(() => {
    if (
      !isSetupMode ||
      !awaitingCompletionReview ||
      vLoading ||
      verification?.status !== "pending"
    )
      return;
    const params = new URLSearchParams({ approval_pending: "1" });
    if (inviteUniId) params.set("open_university_id", inviteUniId);
    if (inviteTemplateId) params.set("template_id", inviteTemplateId);
    if (inviteId) params.set("invite_id", inviteId);
    router.replace(`/universities?${params}`);
  }, [
    awaitingCompletionReview,
    inviteId,
    inviteTemplateId,
    inviteUniId,
    isSetupMode,
    router,
    verification?.status,
    vLoading,
  ]);

  useEffect(() => {
    if (
      !isSetupMode ||
      inviteUniId ||
      isLoading ||
      vLoading ||
      !verification ||
      verification.status === "incomplete" ||
      (awaitingCompletionReview && verification.status === "pending")
    )
      return;
    router.replace("/profile");
  }, [
    awaitingCompletionReview,
    inviteUniId,
    isLoading,
    isSetupMode,
    router,
    verification,
    vLoading,
  ]);

  const save = useCompanyControllerPatchProfile({
    mutation: {
      onSuccess: (_data, variables) => {
        form.reset(variables.data as CompanyProfileDraft);
        setIsEditing(false);
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerMeQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerGetVerificationQueryKey(),
        });
        setAwaitingCompletionReview(isSetupMode);
        toast("Profile saved", toastPresets.success);
      },
      onError: (e: Error) => toast.error(e.message),
    },
  });

  const uploadDoc = useCompanyControllerUploadDocument({
    mutation: {
      onSuccess: () => {
        setUploadingType(null);
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerGetDocumentsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerGetVerificationQueryKey(),
        });
        setAwaitingCompletionReview(isSetupMode);
        toast("Document uploaded", toastPresets.success);
      },
      onError: (e: Error) => {
        setUploadingType(null);
        toast(e.message, toastPresets.destructive);
      },
    },
  });

  if (isLoading || !company) return null;

  function persisted(key: string): string {
    if (COSMETIC_KEYS.includes(key))
      return String(company!.cosmetic?.[key] ?? "");
    return String(company?.[key as keyof NonNullable<typeof company>] ?? "");
  }
  function attemptSave() {
    if (
      save.isPending ||
      uploadDoc.isPending ||
      (isSetupMode && !documentsComplete) ||
      !form.formState.isValid
    )
      return;
    const changedMaterial =
      form.getValues("registered_name") !== persisted("registered_name");
    const submit = () => {
      if (
        save.isPending ||
        uploadDoc.isPending ||
        (isSetupMode && !documentsComplete)
      )
        return;
      const values = form.getValues();
      save.mutate({
        data: {
          ...values,
          company_type:
            values.company_type as PatchCompanyProfileDto["company_type"],
        },
      });
    };
    if (verified && changedMaterial) {
      confirmAction.open({
        title: "This change requires re-verification",
        description:
          "Changing this will require re-verification by the platform team. You won't be able to request new MOAs until you're re-approved. Your existing MOAs stay valid.",
        confirmLabel: "Save anyway",
        onConfirm: submit,
        isPending: save.isPending,
      });
    } else {
      submit();
    }
  }

  function fieldError(field: string) {
    return form.formState.errors[field as keyof CompanyProfileDraft]?.message;
  }

  function attemptUploadDoc(file: File, type: string) {
    const upload = () => {
      setUploadingType(type);
      uploadDoc.mutate({ data: { file, type } });
    };
    if (verified) {
      confirmAction.open({
        title: "This change requires re-verification",
        description:
          "Changing this will require re-verification by the platform team. You won't be able to request new MOAs until you're re-approved. Your existing MOAs stay valid.",
        confirmLabel: "Upload anyway",
        onConfirm: upload,
        isPending: uploadDoc.isPending,
      });
    } else {
      upload();
    }
  }

  function preview(doc: CompanyDocumentDto) {
    const documentTitle =
      DOC_TYPES.find(({ value }) => value === doc.type)?.label ??
      "Legal Document";

    openModal("preview-doc", <DocumentPreview docId={doc.id} />, {
      title: documentTitle,
      panelClassName: "!w-full sm:!max-w-4xl",
      contentClassName:
        "h-[75dvh] overflow-hidden sm:h-[75vh] sm:min-h-[32rem]",
      showHeaderDivider: false,
    });
  }

  const docs = docsData?.documents ?? [];
  const latestDoc = (type: string) => docs.find((d) => d.type === type);
  const docCount = DOC_TYPES.filter(({ value }) => latestDoc(value)).length;
  const watched = form.watch();
  const companyInfoComplete = Boolean(
    company.registered_name &&
    watched.registered_address?.trim() &&
    watched.company_type,
  );
  const documentsComplete = docCount === DOC_TYPES.length;

  // ── small renderers (plain functions, NOT components, to preserve input focus) ─
  const textField = (
    sectionKey: SectionKey,
    field: string,
    label: string,
    help?: string,
  ) => {
    const fieldIsEditable =
      (isSetupMode || isEditing) &&
      (sectionKey !== "company" || field !== "registered_name");
    return (
      <DetailField label={<Label htmlFor={field}>{label}</Label>}>
        <div className="min-w-0 flex-1 space-y-1">
          {fieldIsEditable ? (
            <Input
              id={field}
              aria-invalid={!!fieldError(field)}
              aria-describedby={
                fieldError(field) ? `${field}-error` : undefined
              }
              {...form.register(field as keyof CompanyProfileDraft)}
            />
          ) : (
            <p className="flex min-h-8 items-center break-words text-sm font-medium text-gray-900">
              {persisted(field) || (
                <span className="text-muted-foreground font-normal">
                  Not set
                </span>
              )}
            </p>
          )}
          {fieldIsEditable && fieldError(field) && (
            <p id={`${field}-error`} className="text-destructive text-xs">
              {fieldError(field)}
            </p>
          )}
          {help && <p className="text-muted-foreground text-xs">{help}</p>}
        </div>
      </DetailField>
    );
  };

  return (
    <div className="relative isolate flex-1 bg-slate-50/70">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[url('/bg2.png')] bg-cover bg-center bg-no-repeat opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-gradient-to-b from-white/90 via-white/50 to-transparent" />
      <PageContainer className={cn("relative z-10 space-y-8 pb-12")}>
        <ProfileHeader
          companyName={company.registered_name}
          isSetupMode={isSetupMode}
          isEditing={isEditing}
          companyInfoComplete={companyInfoComplete}
          documentsComplete={documentsComplete}
          isSaveDisabled={
            save.isPending ||
            uploadDoc.isPending ||
            !form.formState.isValid ||
            !form.formState.isDirty
          }
          isSaving={save.isPending}
          onEdit={() => setIsEditing(true)}
          onCancel={() => {
            form.reset();
            setIsEditing(false);
          }}
          onSave={attemptSave}
        />

        {isSetupMode && inviteUniId && (
          <div className="border-primary/30 bg-primary/5 rounded-[0.33em] border px-4 py-3 text-sm text-gray-700">
            You have a pending MOA invitation. Complete your company profile and
            upload all required documents to proceed.
          </div>
        )}

        <CollapsibleCardGroup
          type="multiple"
          defaultValue={["company", "documents"]}
          variant={isSetupMode ? "separate" : "grouped"}
        >
          {/* 1 — Company Profile */}
          <CollapsibleCardSection
            value="company"
            trigger={
              <CollapsibleCardSectionTitle
                icon={Building2}
                title={isSetupMode ? "Company Information" : "Company Profile"}
                requiredComplete={
                  isSetupMode || isEditing ? companyInfoComplete : undefined
                }
              />
            }
            contentClassName="space-y-4 px-5 pb-5"
          >
            <DetailField label="Account email">
              <p className="flex min-h-8 items-center break-all text-sm font-medium text-gray-900">
                {company.email}
              </p>
            </DetailField>
            <DetailField label="Legal / registered name">
              <p className="flex min-h-8 items-center break-words text-sm font-medium text-gray-900">
                {company.registered_name}
              </p>
            </DetailField>
            {textField("company", "registered_address", "Registered address")}
            <DetailField label="Company type">
              <div className="min-w-0 flex-1">
                {isSetupMode || isEditing ? (
                  <Select
                    value={form.watch("company_type") || undefined}
                    onValueChange={(v) =>
                      form.setValue("company_type", v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={!!fieldError("company_type")}
                    >
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
                  <p className="flex min-h-8 items-center text-sm font-medium text-gray-900">
                    {COMPANY_TYPES.find(
                      ({ value }) => value === company.company_type,
                    )?.label ?? "Not set"}
                  </p>
                )}
                {fieldError("company_type") && (
                  <p className="text-destructive mt-1 text-xs">
                    {fieldError("company_type")}
                  </p>
                )}
              </div>
            </DetailField>
          </CollapsibleCardSection>

          {/* 2 — Required Documents */}
          <CollapsibleCardSection
            value="documents"
            trigger={
              <CollapsibleCardSectionTitle
                icon={FileText}
                title={isSetupMode ? "Legal Documents" : "Required Documents"}
                requiredComplete={
                  isSetupMode || isEditing ? documentsComplete : undefined
                }
              />
            }
            contentClassName="space-y-4 px-5 pb-5"
          >
            {isSetupMode && (
              <div className="space-y-2">
                <div className="flex max-w-xs items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: `${(docCount / DOC_TYPES.length) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {docCount} of {DOC_TYPES.length} uploaded
                  </span>
                </div>
              </div>
            )}
            <div className="overflow-hidden rounded-[0.33em] border border-blue-100 bg-white">
              {DOC_TYPES.map(({ value, label }) => {
                const existing = latestDoc(value);
                return (
                  <FileDropTarget
                    key={value}
                    accept="application/pdf"
                    disabled={!isSetupMode || uploadDoc.isPending}
                    onFiles={([file]) => {
                      if (file) attemptUploadDoc(file, value);
                    }}
                    dragOverlay={
                      <div className="text-primary flex min-h-[72px] w-full items-center justify-center gap-2 rounded-[0.33em] border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-medium">
                        <Upload className="h-4 w-4" />
                        Drop PDF to {existing ? "replace" : "upload"}
                      </div>
                    }
                    className="flex min-h-[72px] flex-row items-center border-b border-gray-100 px-4 last:border-b-0"
                  >
                    {existing ? (
                      <CircleCheck className="text-supportive" />
                    ) : (
                      <CircleAlert className="text-warning" />
                    )}
                    <div className="flex flex-1 items-center justify-between gap-3 rounded-[0.16em] p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {label}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {existing
                            ? `Uploaded ${new Date(existing.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                            : "Not uploaded"}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {isSetupMode && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadDoc.isPending}
                              onClick={() =>
                                documentInputRefs.current[value]?.click()
                              }
                            >
                              {uploadingType === value ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <Upload />
                              )}
                              {uploadingType === value
                                ? "Uploading..."
                                : existing
                                  ? "Drop or replace"
                                  : "Drop or upload"}
                            </Button>
                            <input
                              ref={(input) => {
                                documentInputRefs.current[value] = input;
                              }}
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              disabled={uploadDoc.isPending}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) attemptUploadDoc(file, value);
                                event.target.value = "";
                              }}
                            />
                          </>
                        )}
                        {existing && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => preview(existing)}
                          >
                            <Eye /> View
                          </Button>
                        )}
                      </div>
                    </div>
                  </FileDropTarget>
                );
              })}
            </div>
          </CollapsibleCardSection>
        </CollapsibleCardGroup>

        {isSetupMode && (
          <div className="flex justify-end gap-2">
            <Button
              onClick={attemptSave}
              disabled={
                save.isPending ||
                uploadDoc.isPending ||
                !documentsComplete ||
                !form.formState.isValid
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
