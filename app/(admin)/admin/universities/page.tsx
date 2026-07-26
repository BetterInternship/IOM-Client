"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminControllerListUniversitiesQueryKey,
  useAdminControllerCreateUniversity,
  useAdminControllerDeactivateUniversity,
  useAdminControllerListUniversities,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TruncatedTooltip } from "@/components/ui/truncated-tooltip";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { FormError } from "@/components/auth-shell";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import { toastPresets } from "@/components/sonner-toaster";
import { ChevronRight, Loader2, Plus, UserRoundX } from "lucide-react";

interface University {
  id: string;
  registered_name: string;
  is_deactivated: boolean | null;
  university_accounts: {
    email: string;
    display_name: string;
    is_pending: boolean;
  }[];
}

type UniversityStatusValue = "active" | "pending" | "deactivated";
type UniversityStatusTab = "all" | UniversityStatusValue;

const STATUS_TABS: Array<{
  value: UniversityStatusTab;
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
    value: "active",
    label: "Active",
    activeCountClassName:
      "group-data-[state=active]:bg-supportive group-data-[state=active]:text-supportive-foreground",
  },
  {
    value: "pending",
    label: "Pending",
    activeCountClassName:
      "group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground",
  },
  {
    value: "deactivated",
    label: "Deactivated",
    activeCountClassName:
      "group-data-[state=active]:bg-destructive group-data-[state=active]:text-destructive-foreground",
  },
];

function universityStatus(university: University): UniversityStatusValue {
  if (university.is_deactivated) return "deactivated";
  if (
    !university.university_accounts[0] ||
    university.university_accounts[0].is_pending
  ) {
    return "pending";
  }
  return "active";
}

function UniversityStatus({ university }: { university: University }) {
  const status = universityStatus(university);
  return status === "deactivated" ? (
    <PartnershipStatusBadge status="rejected" label="Deactivated" />
  ) : status === "pending" ? (
    <PartnershipStatusBadge status="pending" label="Pending" />
  ) : (
    <PartnershipStatusBadge status="active" label="Active" />
  );
}

function UniversityStatusTabs({
  universities,
  value,
  onValueChange,
}: {
  universities: University[];
  value: UniversityStatusTab;
  onValueChange: (value: UniversityStatusTab) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) =>
        onValueChange(nextValue as UniversityStatusTab)
      }
      className="block"
    >
      <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-none border-0 border-b border-gray-200 bg-transparent">
        {STATUS_TABS.map((tab) => {
          const count = universities.filter(
            (university) =>
              tab.value === "all" || universityStatus(university) === tab.value,
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

const EMPTY_FORM = {
  registered_name: "",
  superadmin_email: "",
  superadmin_display_name: "",
};

function CreateUniversityForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<unknown>;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const create = useAdminControllerCreateUniversity({
    mutation: {
      onSuccess: async () => {
        await onCreated();
        toast("University created", toastPresets.success);
        onClose();
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  const valid = form.registered_name && form.superadmin_email;

  return (
    <form
      id="create-university"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        create.mutate({
          data: { ...form, superadmin_display_name: "Super Admin" },
        });
      }}
      className="space-y-4"
    >
      <FormError>{error}</FormError>
      <div className="space-y-1.5">
        <Label htmlFor="registered_name">Registered name</Label>
        <Input
          id="registered_name"
          placeholder="De La Salle University"
          value={form.registered_name}
          onChange={(e) =>
            setForm({ ...form, registered_name: e.target.value })
          }
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="superadmin_email">Superadmin email</Label>
        <Input
          id="superadmin_email"
          type="email"
          placeholder="admin@university.edu"
          value={form.superadmin_email}
          onChange={(e) =>
            setForm({ ...form, superadmin_email: e.target.value })
          }
          required
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-university"
          disabled={!valid || create.isPending}
        >
          {create.isPending && <Loader2 className="animate-spin" />}
          {create.isPending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}

function DeactivateCell({ uni }: { uni: University }) {
  const queryClient = useQueryClient();
  const { confirmAction } = useIomModalRegistry();

  const deactivate = useAdminControllerDeactivateUniversity({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getAdminControllerListUniversitiesQueryKey(),
        });
        toast.success("University deactivated");
      },
      onError: (e: Error) => toast.error(e.message),
    },
  });

  if (uni.is_deactivated) return null;

  return (
    <Button
      scheme="destructive"
      variant="outline"
      size="sm"
      aria-label={`Deactivate ${uni.registered_name}`}
      title="Deactivate university"
      onClick={(e) => {
        e.stopPropagation();
        confirmAction.open({
          title: `Deactivate ${uni.registered_name}?`,
          description:
            "Staff will lose access and the institution can no longer receive new MOA requests. This can be reversed later.",
          confirmLabel: "Deactivate",
          onConfirm: () => deactivate.mutate({ universityId: uni.id }),
          isPending: deactivate.isPending,
        });
      }}
    >
      <UserRoundX className="h-3.5 w-3.5" />
      Deactivate
    </Button>
  );
}

const columns: Array<ResourceTableColumn<University>> = [
  {
    id: "status",
    header: "Status",
    width: "w-[12%]",
    sortable: false,
    render: (university) => <UniversityStatus university={university} />,
  },
  {
    id: "name",
    header: "University",
    width: "w-[32%]",
    getSortValue: (university) => university.registered_name,
    render: (university) => (
      <TruncatedTooltip
        align="start"
        className="text-sm font-medium text-gray-900"
        contentClassName="text-left"
      >
        {university.registered_name}
      </TruncatedTooltip>
    ),
  },
  {
    id: "superadmin",
    header: "Superadmin",
    width: "w-[35%]",
    getSortValue: (university) => university.university_accounts[0]?.email,
    render: (university) => (
      <span className="text-muted-foreground text-sm">
        {university.university_accounts[0]?.email ?? "—"}
      </span>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    width: "w-[15%]",
    sortable: false,
    render: (university) => <DeactivateCell uni={university} />,
  },
  {
    id: "open",
    header: "",
    width: "w-[6%]",
    align: "right",
    sortable: false,
    render: (university) => (
      <div className="text-primary flex justify-end">
        <ChevronRight
          className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
        <span className="sr-only">Open {university.registered_name}</span>
      </div>
    ),
  },
];

export default function AdminUniversitiesPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<UniversityStatusTab>("all");
  const { openModal, closeModal } = useModal();
  const { data, isLoading, refetch } = useAdminControllerListUniversities<
    University[]
  >({
    query: {
      queryKey: getAdminControllerListUniversitiesQueryKey(),
      select: (response) => response.universities,
    },
  });
  const universities = data ?? [];
  const visibleUniversities = useMemo(
    () =>
      statusTab === "all"
        ? universities
        : universities.filter(
            (university) => universityStatus(university) === statusTab,
          ),
    [statusTab, universities],
  );
  const table = useResourceTable({
    data: visibleUniversities,
    getRowId: (university) => university.id,
    columns,
    search: {
      placeholder: "Search universities...",
      ariaLabel: "Search universities",
      matches: (university, query) =>
        university.registered_name.toLowerCase().includes(query) ||
        (university.is_deactivated ? "deactivated" : "active").includes(
          query,
        ) ||
        university.university_accounts.some(
          (account) =>
            account.email.toLowerCase().includes(query) ||
            account.display_name.toLowerCase().includes(query),
        ),
    },
    pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50] },
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Universities"
        description="Onboard institutions and manage their access to the platform."
      >
        <Button
          onClick={() =>
            openModal(
              "create-university",
              <CreateUniversityForm
                onClose={() => closeModal("create-university")}
                onCreated={refetch}
              />,
              {
                title: "Create university",
                panelClassName: "!w-full sm:!max-w-md",
              },
            )
          }
        >
          <Plus /> Add university
        </Button>
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
            <UniversityStatusTabs
              universities={universities}
              value={statusTab}
              onValueChange={setStatusTab}
            />
          }
          renderMobileRow={(university) => (
            <article
              className="cursor-pointer px-4 py-3 transition-colors hover:bg-primary/[0.035]"
              onClick={() =>
                router.push(`/admin/universities/${university.id}`)
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {university.registered_name}
                  </p>
                  <p className="text-muted-foreground mt-1 break-all text-sm">
                    {university.university_accounts[0]?.email ??
                      "No superadmin"}
                  </p>
                </div>
                <UniversityStatus university={university} />
              </div>
              <div
                className="mt-4"
                onClick={(event) => event.stopPropagation()}
              >
                <DeactivateCell uni={university} />
              </div>
            </article>
          )}
          emptyState={{
            title: "No universities yet",
            description: "Add a university to onboard its superadmin.",
          }}
          noResultsState={{
            title: "No universities found",
            description: "Try searching by another university, name, or email.",
          }}
          rowLabelSingular="university"
          rowLabelPlural="universities"
          onRowClick={(uni) => router.push(`/admin/universities/${uni.id}`)}
        />
      )}
    </PageContainer>
  );
}
