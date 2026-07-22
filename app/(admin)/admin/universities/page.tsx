"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { FormError } from "@/components/auth-shell";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import { toastPresets } from "@/components/sonner-toaster";
import { Loader2, Plus } from "lucide-react";

interface University {
  id: string;
  registered_name: string;
  logo_url: string | null;
  is_deactivated: boolean | null;
  university_accounts: {
    email: string;
    display_name: string;
    is_pending: boolean;
  }[];
}

function UniversityIdentity({ university }: { university: University }) {
  const initials = university.registered_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[0.33em] border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600">
        {university.logo_url ? (
          // University logos are user-uploaded and served from signed URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={university.logo_url}
            alt={`${university.registered_name} logo`}
            className="h-full w-full object-contain p-1"
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </div>
      <span className="truncate font-medium text-gray-900">
        {university.registered_name}
      </span>
    </div>
  );
}

function UniversityStatus({ university }: { university: University }) {
  return university.is_deactivated ? (
    <PartnershipStatusBadge status="rejected" label="Deactivated" />
  ) : !university.university_accounts[0] ||
    university.university_accounts[0].is_pending ? (
    <PartnershipStatusBadge status="pending" label="Pending" />
  ) : (
    <PartnershipStatusBadge status="active" label="Active" />
  );
}

const EMPTY_FORM = {
  registered_name: "",
  superadmin_email: "",
  superadmin_display_name: "",
};

function CreateUniversityForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/admin/universities", {
        ...form,
        superadmin_display_name: "Super Admin",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-universities"],
        refetchType: "active",
      });
      toast("University created", toastPresets.success);
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const valid = form.registered_name && form.superadmin_email;

  return (
    <form
      id="create-university"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        create.mutate();
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

  const deactivate = useMutation({
    mutationFn: () =>
      preconfiguredAxios.patch(`/api/admin/universities/${uni.id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-universities"] });
      toast.success("University deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (uni.is_deactivated) return null;

  return (
    <Button
      variant="outline"
      scheme="destructive"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        confirmAction.open({
          title: `Deactivate ${uni.registered_name}?`,
          description:
            "Staff will lose access and the institution can no longer receive new MOA requests. This can be reversed later.",
          confirmLabel: "Deactivate",
          onConfirm: () => deactivate.mutate(),
          isPending: deactivate.isPending,
        });
      }}
    >
      Deactivate
    </Button>
  );
}

const columns: Array<ResourceTableColumn<University>> = [
  {
    id: "name",
    header: "University",
    width: "w-[35%]",
    getSortValue: (university) => university.registered_name,
    render: (university) => <UniversityIdentity university={university} />,
  },
  {
    id: "superadmin",
    header: "Superadmin",
    width: "w-[35%]",
    getSortValue: (university) => university.university_accounts[0]?.email,
    render: (university) => (
      <span className="text-muted-foreground">
        {university.university_accounts[0]?.email ?? "—"}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "w-[15%]",
    sortable: false,
    render: (university) => <UniversityStatus university={university} />,
  },
  {
    id: "actions",
    header: "",
    width: "w-[15%]",
    align: "right",
    sortable: false,
    render: (university) => <DeactivateCell uni={university} />,
  },
];

export default function AdminUniversitiesPage() {
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-universities"],
    queryFn: async () => {
      const res = await preconfiguredAxios.get("/api/admin/universities");
      return res.data.universities as University[];
    },
  });
  const universities = data ?? [];
  const table = useResourceTable({
    data: universities,
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
              />,
              {
                title: "Create university",
                description:
                  "The superadmin is emailed an invitation to set their password.",
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
          renderMobileRow={(university) => (
            <article
              className="cursor-pointer px-4 py-4 transition-colors hover:bg-primary/[0.035]"
              onClick={() =>
                router.push(`/admin/universities/${university.id}`)
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <UniversityIdentity university={university} />
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
