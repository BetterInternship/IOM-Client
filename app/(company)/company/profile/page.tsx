"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  type PatchCompanyProfileDto,
} from "@/app/api";
import { cn } from "@/lib/utils";
import {
  companyProfileSchema,
  type CompanyProfileDraft,
} from "@/lib/profile-validation";
import { PageContainer } from "@/components/page-header";
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
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import { toastPresets } from "@/components/sonner-toaster";
import {
  Building2,
  CircleAlert,
  CircleCheck,
  Eye,
  FileText,
  Lightbulb,
  Loader2,
  Upload,
} from "lucide-react";
import { DocumentPreview } from "./document-preview";
import { ProfileHeader } from "./profile-header";

type SectionKey = "company" | "documents" | "other";

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

interface CompanyDoc {
  id: string;
  type: string;
  filename: string;
  uploaded_at: string;
}

function ProfileContent() {
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
  const incomplete = verification?.status === "incomplete";

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

  // Auto-redirect to the MOA modal as soon as profile is complete (invite flow).
  useEffect(() => {
    if (!inviteUniId || isLoading || vLoading || !company || !verification)
      return;
    if (verification.status === "incomplete") return;
    const params = new URLSearchParams({ open_university_id: inviteUniId });
    if (inviteTemplateId) params.set("template_id", inviteTemplateId);
    if (inviteId) params.set("invite_id", inviteId);
    router.replace(`/company/dashboard?${params}`);
  }, [
    inviteUniId,
    isLoading,
    vLoading,
    company,
    verification,
    inviteTemplateId,
    inviteId,
    router,
  ]);

  useEffect(() => {
    if (
      !awaitingCompletionReview ||
      vLoading ||
      verification?.status !== "pending"
    )
      return;
    const params = new URLSearchParams({ approval_pending: "1" });
    if (inviteUniId) params.set("open_university_id", inviteUniId);
    if (inviteTemplateId) params.set("template_id", inviteTemplateId);
    if (inviteId) params.set("invite_id", inviteId);
    router.replace(`/company/dashboard?${params}`);
  }, [
    awaitingCompletionReview,
    inviteId,
    inviteTemplateId,
    inviteUniId,
    router,
    verification?.status,
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
        setAwaitingCompletionReview(true);
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
        setAwaitingCompletionReview(true);
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
  // Material fields whose change forces re-verification (the hash inputs).
  const MATERIAL_KEYS_BY_SECTION: Record<string, string[]> = {
    company: ["registered_name"],
  };

  function attemptSave(sectionKey: SectionKey) {
    if (!form.formState.isValid) return;
    const matKeys = MATERIAL_KEYS_BY_SECTION[sectionKey] ?? [];
    const changedMaterial = matKeys.some(
      (k) => form.getValues(k as keyof CompanyProfileDraft) !== persisted(k),
    );
    const submit = () => {
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

  function preview(doc: CompanyDoc) {
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

  const docs = (docsData?.documents ?? []) as CompanyDoc[];
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
      (incomplete || isEditing) &&
      (sectionKey !== "company" || field !== "registered_name");
    return (
      <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8">
        <Label
          htmlFor={field}
          className="self-start text-xs font-medium text-slate-500 sm:flex sm:h-8 sm:items-center"
        >
          {label}
        </Label>
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
    <div className="relative isolate flex-1 bg-slate-50/70">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[url('/bg2.png')] bg-cover bg-center bg-no-repeat opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-gradient-to-b from-white/90 via-white/50 to-transparent" />
      <PageContainer className={cn("relative z-10 space-y-8 pb-12")}>
        <ProfileHeader
          companyName={company.registered_name}
          isSetupMode={incomplete}
          isEditing={isEditing}
          companyInfoComplete={companyInfoComplete}
          documentsComplete={documentsComplete}
          isSaveDisabled={
            save.isPending || !form.formState.isValid || !form.formState.isDirty
          }
          isSaving={save.isPending}
          onEdit={() => setIsEditing(true)}
          onSave={() => attemptSave("company")}
        />

        {inviteUniId && (
          <div className="border-primary/30 bg-primary/5 rounded-[0.33em] border px-4 py-3 text-sm text-gray-700">
            {incomplete ? (
              <>
                You have a pending MOA invitation. Complete your company profile
                and upload all required documents to proceed.
              </>
            ) : (
              <>
                Your profile is ready.{" "}
                <Link
                  href={`/company/dashboard?${new URLSearchParams({
                    open_university_id: inviteUniId!,
                    ...(inviteTemplateId
                      ? { template_id: inviteTemplateId }
                      : {}),
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

        <Accordion
          type="multiple"
          defaultValue={["company", "documents"]}
          className={cn(
            incomplete
              ? "space-y-4"
              : "overflow-hidden rounded-[0.33em] border border-blue-100 bg-white shadow-sm",
          )}
        >
          {/* 1 — Company Profile */}
          <AccordionItem
            value="company"
            className={cn(
              incomplete &&
                "overflow-hidden rounded-[0.33em] border border-blue-100 bg-white shadow-sm",
            )}
          >
            {sectionTrigger(
              Building2,
              incomplete ? "Company Information" : "Company Profile",
              <Badge
                type={companyInfoComplete ? "supportive" : "default"}
                strength="medium"
              >
                {companyInfoComplete ? "Completed" : "Required"}
              </Badge>,
              incomplete || isEditing ? companyInfoComplete : undefined,
            )}
            <AccordionContent className="space-y-4 px-5 pb-5">
              <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8">
                <Label className="self-start text-xs font-medium text-slate-500 sm:flex sm:h-8 sm:items-center">
                  Account email
                </Label>
                <div className="min-w-0 flex-1">
                  <p className="flex min-h-8 items-center break-all text-sm font-medium text-gray-900">
                    {company.email}
                  </p>
                </div>
              </div>
              <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8">
                <Label className="self-start text-xs font-medium text-slate-500 sm:flex sm:h-8 sm:items-center">
                  Legal / registered name
                </Label>
                <p className="flex min-h-8 items-center break-words text-sm font-medium text-gray-900">
                  {company.registered_name}
                </p>
              </div>
              {textField("company", "registered_address", "Registered address")}
              <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8">
                <Label className="self-start text-xs font-medium text-slate-500 sm:flex sm:h-8 sm:items-center">
                  Company type
                </Label>
                <div className="min-w-0 flex-1">
                  {incomplete || isEditing ? (
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
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 2 — Required Documents */}
          <AccordionItem
            value="documents"
            className={cn(
              incomplete &&
                "overflow-hidden rounded-[0.33em] border border-blue-100 bg-white shadow-sm",
            )}
          >
            {sectionTrigger(
              FileText,
              incomplete ? "Legal Documents" : "Required Documents",
              <Badge
                type={docCount === DOC_TYPES.length ? "supportive" : "default"}
                strength="medium"
              >
                {documentsComplete
                  ? "Completed"
                  : incomplete
                    ? "Required"
                    : `${docCount}/${DOC_TYPES.length}`}
              </Badge>,
              incomplete || isEditing ? documentsComplete : undefined,
            )}
            <AccordionContent className="space-y-4 px-5 pb-5">
              {incomplete && (
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
                    <div
                      key={value}
                      className="flex flex-row items-center border-b border-gray-100 px-4 last:border-b-0"
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
                          {incomplete && (
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
                                    ? "Replace"
                                    : "Upload"}
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
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Accordion
          type="single"
          collapsible
          className="rounded-[0.33em] border border-blue-100 bg-white shadow-sm"
        >
          <AccordionItem value="additional" className="border-none">
            {sectionTrigger(
              Building2,
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
                <span className="font-semibold">Tip:</span> These details help
                universities learn more about your company.
              </p>
            </div>
            <AccordionContent className="px-5 pb-5">
              <div className="space-y-4">
                {textField("other", "description", "Description")}
                {textField("other", "website", "Website")}
                {textField("other", "phone", "Phone")}
                {textField("other", "industry", "Industry")}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {(incomplete || isEditing) && (
          <div className="flex justify-end gap-2">
            {!incomplete && (
              <Button
                variant="outline"
                onClick={() => {
                  form.reset();
                  setIsEditing(false);
                }}
                disabled={save.isPending}
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={() => attemptSave("company")}
              disabled={
                save.isPending ||
                !form.formState.isValid ||
                (!incomplete && !form.formState.isDirty)
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

export default function CompanyProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  );
}
