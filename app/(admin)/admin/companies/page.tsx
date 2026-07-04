"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogTrigger, DialogContent,
  DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { FormError } from "@/components/auth-shell";
import { DataTable } from "@/components/ui/data-table";
import { formatDateWithoutTime } from "@/lib/utils";

interface Company {
  id: string;
  registered_name: string;
  email: string | null;
  email_verified: boolean | null;
  is_deactivated: boolean | null;
  has_pending_review: boolean;
  is_profile_incomplete: boolean;
  created_at: string;
}

const columns: ColumnDef<Company>[] = [
  {
    id: "name",
    header: "Company",
    accessorFn: (row) => row.registered_name,
    cell: ({ row }) => (
      <div className="flex items-center gap-2 min-w-0">
        <p className="font-medium text-gray-900">{row.original.registered_name}</p>
        {row.original.is_deactivated ? (
          <Badge type="destructive" strength="medium">Deactivated</Badge>
        ) : row.original.has_pending_review ? (
          <Badge type="warning" strength="medium">Pending</Badge>
        ) : row.original.is_profile_incomplete ? (
          <Badge type="default" strength="medium">Incomplete</Badge>
        ) : null}
      </div>
    ),
  },
  {
    id: "email",
    header: "Email",
    accessorFn: (row) => row.email,
    cell: ({ row }) => (
      row.original.email ? (
        <span className="text-muted-foreground">{row.original.email}</span>
      ) : (
        <Badge type="default" strength="medium">Record only</Badge>
      )
    ),
  },
  {
    id: "joined",
    header: "Joined",
    accessorFn: (row) => row.created_at,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateWithoutTime(row.original.created_at)}
      </span>
    ),
  },
];

const COMPANY_TYPES = [
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "government_agency", label: "Government Agency" },
] as const;

function CreateCompanyDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    registered_name: "",
    tin: "",
    company_type: "",
    registered_address: "",
  });
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/admin/companies", {
        registered_name: form.registered_name,
        tin: form.tin,
        company_type: form.company_type || undefined,
        registered_address: form.registered_address || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast.success("Company created");
      setForm({ registered_name: "", tin: "", company_type: "", registered_address: "" });
      setError("");
      setOpen(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  const valid = form.registered_name && form.tin;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(""); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add company
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create company</DialogTitle>
          <DialogDescription>Add a new company/HTE record to the platform.</DialogDescription>
        </DialogHeader>

        <form
          id="create-company"
          onSubmit={(e) => { e.preventDefault(); setError(""); create.mutate(); }}
          className="space-y-4"
        >
          <FormError>{error}</FormError>

          <div className="space-y-1.5">
            <Label htmlFor="registered_name">Registered name</Label>
            <Input
              id="registered_name"
              placeholder="Company legal name"
              value={form.registered_name}
              onChange={(e) => setForm({ ...form, registered_name: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tin">TIN</Label>
            <Input
              id="tin"
              placeholder="000-000-000-000"
              value={form.tin}
              onChange={(e) => setForm({ ...form, tin: e.target.value })}
              required
            />
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
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
              onChange={(e) => setForm({ ...form, registered_address: e.target.value })}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-company" disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCompaniesPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const res = await preconfiguredAxios.get("/api/admin/companies");
      return res.data.companies as Company[];
    },
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Companies"
        description="All registered companies on the platform."
      >
        <CreateCompanyDialog />
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <DataTable
          id="admin-companies"
          columns={columns}
          data={data ?? []}
          searchPlaceholder="Search companies..."
          rowLabelSingular="company"
          rowLabelPlural="companies"
          pageSizes={[10, 25, 50]}
          onRowClick={(company) => router.push(`/admin/companies/${company.id}`)}
        />
      )}
    </PageContainer>
  );
}
