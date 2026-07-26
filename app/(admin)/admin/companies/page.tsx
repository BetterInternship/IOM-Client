"use client";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Upload,
} from "lucide-react";
import {
  getAdminControllerListCompaniesQueryKey,
  useAdminControllerBulkCreateCompanies,
  useAdminControllerCreateCompany,
  useAdminControllerListCompanies,
  useAdminControllerVerifyTin,
  type AdminCompanyListItemDto,
  type CreateCompanyAdminDtoCompanyType,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/ui/file-upload";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TruncatedTooltip } from "@/components/ui/truncated-tooltip";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FormError } from "@/components/auth-shell";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { useModal } from "@/app/providers/modal-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { formatDateWithoutTime } from "@/lib/utils";

type VerificationStatus =
  | "incomplete"
  | "pending"
  | "verified"
  | "expired"
  | "rejected";
type CompanyStatusTab = "all" | "deactivated" | VerificationStatus;
type CompanyListItem = AdminCompanyListItemDto & {
  verification_status: VerificationStatus;
};

const STATUS_TABS: Array<{
  value: CompanyStatusTab;
  label: string;
  activeCountClassName: string;
}> = [
  {
    value: "all",
    label: "All",
    activeCountClassName:
      "group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground",
  },
  {
    value: "pending",
    label: "Pending",
    activeCountClassName:
      "group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground",
  },
  {
    value: "rejected",
    label: "Rejected",
    activeCountClassName:
      "group-data-[state=active]:bg-destructive group-data-[state=active]:text-destructive-foreground",
  },
  {
    value: "verified",
    label: "Verified",
    activeCountClassName:
      "group-data-[state=active]:bg-supportive group-data-[state=active]:text-supportive-foreground",
  },
  {
    value: "expired",
    label: "Expired",
    activeCountClassName:
      "group-data-[state=active]:bg-destructive group-data-[state=active]:text-destructive-foreground",
  },
  {
    value: "incomplete",
    label: "Incomplete",
    activeCountClassName:
      "group-data-[state=active]:bg-gray-600 group-data-[state=active]:text-white",
  },
  {
    value: "deactivated",
    label: "Deactivated",
    activeCountClassName:
      "group-data-[state=active]:bg-destructive group-data-[state=active]:text-destructive-foreground",
  },
];

function companyStatus(company: CompanyListItem): CompanyStatusTab {
  return company.is_deactivated ? "deactivated" : company.verification_status;
}

function CompanyStatusBadge({ company }: { company: CompanyListItem }) {
  const status = companyStatus(company);
  if (status === "deactivated") {
    return <PartnershipStatusBadge status="rejected" label="Deactivated" />;
  }
  if (status === "pending") {
    return <PartnershipStatusBadge status="pending" label="Pending" />;
  }
  if (status === "rejected") {
    return <PartnershipStatusBadge status="rejected" label="Rejected" />;
  }
  if (status === "verified") {
    return <PartnershipStatusBadge status="active" label="Verified" />;
  }
  if (status === "expired") {
    return <PartnershipStatusBadge status="expired" label="Expired" />;
  }
  return <PartnershipStatusBadge status="inactive" label="Incomplete" />;
}

const columns: Array<ResourceTableColumn<CompanyListItem>> = [
  {
    id: "status",
    header: "Status",
    width: "w-[12%]",
    sortable: false,
    render: (company) => <CompanyStatusBadge company={company} />,
  },
  {
    id: "name",
    header: "Company",
    width: "w-[34%]",
    getSortValue: (company) => company.registered_name,
    render: (company) => (
      <div className="flex items-center gap-2 min-w-0">
        <TruncatedTooltip
          align="start"
          className="text-sm font-medium text-gray-900"
          contentClassName="text-left"
        >
          {company.registered_name}
        </TruncatedTooltip>
      </div>
    ),
  },
  {
    id: "email",
    header: "Email",
    width: "w-[30%]",
    getSortValue: (company) => company.email,
    render: (company) =>
      company.email ? (
        <span className="text-muted-foreground text-sm">{company.email}</span>
      ) : (
        <Badge type="default" strength="medium">
          Record only
        </Badge>
      ),
  },
  {
    id: "joined",
    header: "Joined",
    width: "w-[12%]",
    getSortValue: (company) => new Date(company.created_at),
    render: (company) => (
      <span className="text-muted-foreground text-sm">
        {formatDateWithoutTime(company.created_at)}
      </span>
    ),
  },
  {
    id: "open",
    header: "",
    width: "w-[6%]",
    align: "right",
    sortable: false,
    render: (company) => (
      <div className="text-primary flex justify-end">
        <ChevronRight
          className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
        <span className="sr-only">Open {company.registered_name}</span>
      </div>
    ),
  },
];

function CompanyStatusTabs({
  companies,
  value,
  onValueChange,
}: {
  companies: CompanyListItem[];
  value: CompanyStatusTab;
  onValueChange: (value: CompanyStatusTab) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) =>
        onValueChange(nextValue as CompanyStatusTab)
      }
      className="block"
    >
      <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-none border-0 border-b border-gray-200 bg-transparent">
        {STATUS_TABS.map((tab) => {
          const count = companies.filter(
            (company) =>
              tab.value === "all" || companyStatus(company) === tab.value,
          ).length;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
            >
              {tab.label}
              <span
                className={`ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 ${tab.activeCountClassName}`}
              >
                {count}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

const COMPANY_TYPES = [
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "government_agency", label: "Government Agency" },
] as const;

function CreateCompanyForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    registered_name: "",
    tin: "",
    company_type: "",
    registered_address: "",
  });
  const [error, setError] = useState("");
  const [verifyState, setVerifyState] = useState<{
    loading: boolean;
    result: "idle" | "verified" | "failed";
    message?: string;
  }>({ loading: false, result: "idle" });

  const create = useAdminControllerCreateCompany({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getAdminControllerListCompaniesQueryKey(),
        });
        toast.success("Company created");
        onClose();
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  const verify = useAdminControllerVerifyTin({
    mutation: {
      onSuccess: (data) => {
        if (data.valid) {
          setVerifyState({
            loading: false,
            result: "verified",
            message: data.message,
          });
        } else {
          setVerifyState({
            loading: false,
            result: "failed",
            message: data.message,
          });
        }
      },
      onError: (e: Error) => {
        setVerifyState({
          loading: false,
          result: "failed",
          message: e.message,
        });
      },
    },
  });

  const valid = form.registered_name;

  return (
    <>
      <form
        id="create-company"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          create.mutate({
            data: {
              registered_name: form.registered_name,
              tin: form.tin || undefined,
              company_type: (form.company_type || undefined) as
                | CreateCompanyAdminDtoCompanyType
                | undefined,
              registered_address: form.registered_address || undefined,
            },
          });
        }}
        className="space-y-4"
      >
        <FormError>{error}</FormError>

        <div className="space-y-1.5">
          <Label htmlFor="registered_name">Registered name</Label>
          <Input
            id="registered_name"
            placeholder="Company legal name"
            value={form.registered_name}
            onChange={(e) =>
              setForm({
                ...form,
                registered_name: e.target.value.toUpperCase(),
              })
            }
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tin">TIN (optional)</Label>
          <div className="flex gap-2">
            <Input
              id="tin"
              placeholder="000-000-000-000"
              value={form.tin}
              onChange={(e) => setForm({ ...form, tin: e.target.value })}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!form.tin || !form.registered_name || verify.isPending}
              title={!form.tin ? "Enter a TIN to verify" : undefined}
              onClick={() => {
                setVerifyState({ loading: true, result: "idle" });
                verify.mutate({
                  data: {
                    tin: form.tin,
                    registered_name: form.registered_name,
                  },
                });
              }}
            >
              {verify.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Verify
            </Button>
          </div>
          {verifyState.result === "verified" && (
            <p className="text-xs text-green-600">{verifyState.message}</p>
          )}
          {verifyState.result === "failed" && (
            <p className="text-xs text-red-600">{verifyState.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="company_type">Company type</Label>
          <Select
            value={form.company_type}
            onValueChange={(v) => setForm({ ...form, company_type: v })}
          >
            <SelectTrigger id="company_type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="registered_address">Registered address</Label>
          <Input
            id="registered_address"
            placeholder="123 Main St, City"
            value={form.registered_address}
            onChange={(e) =>
              setForm({ ...form, registered_address: e.target.value })
            }
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-company"
            disabled={!valid || create.isPending}
          >
            {create.isPending && <Loader2 className="animate-spin" />}
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </>
  );
}

function BulkUploadForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const upload = useAdminControllerBulkCreateCompanies({
    mutation: {
      onSuccess: (data) => {
        setResults(data);
        queryClient.invalidateQueries({
          queryKey: getAdminControllerListCompaniesQueryKey(),
        });
        toast.success(`Import complete: ${data.summary.created} created`);
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted p-3 text-xs space-y-2">
        <p className="font-medium text-foreground">CSV format:</p>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 pr-2 font-medium text-foreground">Column</th>
              <th className="py-1 pr-2 font-medium text-foreground">
                Required
              </th>
              <th className="py-1 font-medium text-foreground">Description</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border">
              <td className="py-1 pr-2 font-mono">registered_name</td>
              <td className="py-1 pr-2">Yes</td>
              <td className="py-1">Company legal name</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-1 pr-2 font-mono">tin</td>
              <td className="py-1 pr-2">No</td>
              <td className="py-1">TIN (000-000-000-000)</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-1 pr-2 font-mono">company_type</td>
              <td className="py-1 pr-2">No</td>
              <td className="py-1">
                corporation, partnership, sole_proprietorship, government_agency
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-2 font-mono">registered_address</td>
              <td className="py-1 pr-2">No</td>
              <td className="py-1">Company registered address</td>
            </tr>
          </tbody>
        </table>
      </div>

      <FormError>{error}</FormError>

      {!results ? (
        <FileUpload
          label="CSV file"
          name="csv-file"
          accept=".csv,text/csv"
          disabled={upload.isPending}
          onFileSelect={setFile}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Results</p>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded bg-green-50 p-2 text-green-700">
              <p className="text-lg font-bold">{results.summary.created}</p>
              <p>Created</p>
            </div>
            <div className="rounded bg-yellow-50 p-2 text-yellow-700">
              <p className="text-lg font-bold">
                {results.summary.duplicate_tin}
              </p>
              <p>Duplicate</p>
            </div>
            <div className="rounded bg-red-50 p-2 text-red-700">
              <p className="text-lg font-bold">{results.summary.invalid}</p>
              <p>Invalid</p>
            </div>
            <div className="rounded bg-red-50 p-2 text-red-700">
              <p className="text-lg font-bold">{results.summary.failed}</p>
              <p>Failed</p>
            </div>
          </div>
          {results.results?.filter((r: any) => r.status !== "created").length >
            0 && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {results.results
                .filter((r: any) => r.status !== "created")
                .map((r: any) => (
                  <p key={r.row} className="text-xs text-muted-foreground">
                    Row {r.row}: <span className="font-medium">{r.status}</span>{" "}
                    — {r.message}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          {results ? "Close" : "Cancel"}
        </Button>
        {!results && (
          <Button
            disabled={!file || upload.isPending}
            onClick={() => file && upload.mutate({ data: { file } })}
          >
            {upload.isPending && <Loader2 className="animate-spin" />}
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        )}
      </div>
    </div>
  );
}

function AddCompanyDropdown() {
  const { openModal, closeModal } = useModal();

  return (
    <div className="flex">
      <Button
        onClick={() =>
          openModal(
            "create-company",
            <CreateCompanyForm onClose={() => closeModal("create-company")} />,
            {
              title: "Create company",
              description: "Add a new company/HTE record to the platform.",
              panelClassName: "!w-full sm:!max-w-md",
            },
          )
        }
        className="rounded-r-none"
      >
        <Plus /> Add company
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="rounded-l-none border-l-0 px-2">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              openModal(
                "bulk-upload",
                <BulkUploadForm onClose={() => closeModal("bulk-upload")} />,
                {
                  title: "Bulk upload companies",
                  description:
                    "Upload a CSV file with company records. BIR verification is not performed on bulk uploads.",
                  panelClassName: "!w-full sm:!max-w-lg",
                },
              )
            }
          >
            <Upload className="h-4 w-4" />
            Bulk upload
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function AdminCompaniesPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<CompanyStatusTab>("all");

  const { data, isLoading } = useAdminControllerListCompanies<{
    companies: CompanyListItem[];
  }>();
  const companies = data?.companies ?? [];
  const visibleCompanies = useMemo(
    () =>
      statusTab === "all"
        ? companies
        : companies.filter((company) => companyStatus(company) === statusTab),
    [companies, statusTab],
  );
  const table = useResourceTable({
    data: visibleCompanies,
    getRowId: (company) => company.id,
    columns,
    search: {
      placeholder: "Search companies...",
      ariaLabel: "Search companies",
      matches: (company, query) =>
        company.registered_name.toLowerCase().includes(query) ||
        !!company.email?.toLowerCase().includes(query) ||
        formatDateWithoutTime(company.created_at).toLowerCase().includes(query),
    },
    pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50] },
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Companies"
        description="All registered companies on the platform."
      >
        <AddCompanyDropdown />
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <ResourceTable
          table={table}
          columns={
            statusTab === "all"
              ? columns
              : columns.filter((column) => column.id !== "status")
          }
          className="space-y-4 [&_td]:py-2.5"
          toolbarStart={
            <CompanyStatusTabs
              companies={companies}
              value={statusTab}
              onValueChange={setStatusTab}
            />
          }
          renderMobileRow={(company) => (
            <article
              className="cursor-pointer px-4 py-3 transition-colors hover:bg-primary/[0.035]"
              onClick={() => router.push(`/admin/companies/${company.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {company.registered_name}
                  </p>
                  <p className="text-muted-foreground mt-1 break-all text-sm">
                    {company.email || "Record only"}
                  </p>
                </div>
                <CompanyStatusBadge company={company} />
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                Joined {formatDateWithoutTime(company.created_at)}
              </p>
            </article>
          )}
          emptyState={{
            title: "No companies yet",
            description: "Add a company to create its platform record.",
          }}
          noResultsState={{
            title: "No companies found",
            description: "Try searching by another company name or email.",
          }}
          rowLabelSingular="company"
          rowLabelPlural="companies"
          onRowClick={(company) =>
            router.push(`/admin/companies/${company.id}`)
          }
        />
      )}
    </PageContainer>
  );
}
