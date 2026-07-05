"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, Plus, Upload } from "lucide-react";
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
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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

function CreateCompanyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
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
      setVerifyState({ loading: false, result: "idle" });
      setError("");
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  const verify = useMutation({
    mutationFn: async () => {
      const res = await preconfiguredAxios.post("/api/admin/companies/verify-tin", {
        tin: form.tin,
        registered_name: form.registered_name,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      if (data.valid) {
        setVerifyState({ loading: false, result: "verified", message: data.message });
      } else {
        setVerifyState({ loading: false, result: "failed", message: data.message });
      }
    },
    onError: (e: Error) => {
      setVerifyState({ loading: false, result: "failed", message: e.message });
    },
  });

  const valid = form.registered_name;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setError(""); setVerifyState({ loading: false, result: "idle" }); } }}>
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
                  verify.mutate();
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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

function BulkUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const fd = new FormData();
      fd.append("file", file);
      const res = await preconfiguredAxios.post("/api/admin/companies/bulk", fd);
      return res.data;
    },
    onSuccess: (data: any) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast.success(`Import complete: ${data.summary.created} created`);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) { setFile(null); setResults(null); setError(""); }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk upload companies</DialogTitle>
          <DialogDescription>
            Upload a CSV file with company records. BIR verification is not performed on bulk uploads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-xs space-y-2">
            <p className="font-medium text-foreground">CSV format:</p>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1 pr-2 font-medium text-foreground">Column</th>
                  <th className="py-1 pr-2 font-medium text-foreground">Required</th>
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
                  <td className="py-1">corporation, partnership, sole_proprietorship, government_agency</td>
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
            <div className="space-y-1.5">
              <Label htmlFor="csv-file">CSV file</Label>
              <Input
                id="csv-file"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Results</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-green-50 p-2 text-green-700">
                  <p className="text-lg font-bold">{results.summary.created}</p>
                  <p>Created</p>
                </div>
                <div className="rounded bg-yellow-50 p-2 text-yellow-700">
                  <p className="text-lg font-bold">{results.summary.duplicate_tin}</p>
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
              {results.results?.filter((r: any) => r.status !== "created").length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                  {results.results
                    .filter((r: any) => r.status !== "created")
                    .map((r: any) => (
                      <p key={r.row} className="text-xs text-muted-foreground">
                        Row {r.row}: <span className="font-medium">{r.status}</span> — {r.message}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
              {upload.isPending && <Loader2 className="animate-spin" />}
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCompanyDropdown() {
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <>
      <div className="flex">
        <Button onClick={() => setCreateOpen(true)} className="rounded-r-none">
          <Plus /> Add company
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-l-none border-l-0 px-2">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4" />
              Bulk upload
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateCompanyDialog open={createOpen} onOpenChange={setCreateOpen} />
      <BulkUploadDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </>
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
        <AddCompanyDropdown />
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
