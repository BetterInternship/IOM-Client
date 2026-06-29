"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { FormError } from "@/components/auth-shell";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";

interface StaffAccount {
  id: string;
  email: string;
  display_name: string;
  role: "superadmin" | "staff";
  is_deactivated: boolean | null;
  created_at: string;
}

function InviteStaffDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const createStaff = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/university/accounts", {
        email,
        display_name: name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-accounts"] });
      toast.success("Invitation sent");
      setEmail("");
      setName("");
      setError("");
      setOpen(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError("");
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> Invite staff
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite staff member</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email to set their password and join your institution.
          </DialogDescription>
        </DialogHeader>
        <form
          id="invite-staff"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            createStaff.mutate();
          }}
          className="space-y-4"
        >
          <FormError>{error}</FormError>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="staff@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              placeholder="Juan Dela Cruz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="invite-staff"
            disabled={!email || !name || createStaff.isPending}
          >
            {createStaff.isPending && <Loader2 className="animate-spin" />}
            {createStaff.isPending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountsPage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const queryClient = useQueryClient();

  const { data, isLoading: accountsLoading } = useQuery({
    queryKey: ["university-accounts"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/accounts")
        .then((r) => r.data as { accounts: StaffAccount[] }),
    enabled: !!account && isSuperadmin,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["university-accounts"] });

  const deactivate = useMutation({
    mutationFn: (id: string) =>
      preconfiguredAxios.patch(`/api/university/accounts/${id}/deactivate`),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const reactivate = useMutation({
    mutationFn: (id: string) =>
      preconfiguredAxios.patch(`/api/university/accounts/${id}/reactivate`),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const resendInvite = useMutation({
    mutationFn: (id: string) =>
      preconfiguredAxios.post(`/api/university/accounts/${id}/resend-invite`),
    onSuccess: () => toast.success("Invitation resent"),
    onError: (e: Error) => toast.error(e.message),
  });

  const staffColumns = useMemo<ColumnDef<StaffAccount>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "display_name",
        cell: ({ row }) => (
          <span className="font-medium text-gray-900">{row.original.display_name}</span>
        ),
      },
      {
        id: "email",
        header: "Email",
        accessorKey: "email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.is_deactivated ? (
            <Badge type="destructive" strength="medium">Deactivated</Badge>
          ) : (
            <Badge type="supportive" strength="medium">Active</Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableResizing: false,
        size: 260,
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resendInvite.mutate(a.id)}
                disabled={resendInvite.isPending}
              >
                Resend invite
              </Button>
              {a.is_deactivated ? (
                <Button
                  variant="outline"
                  scheme="supportive"
                  size="sm"
                  onClick={() => reactivate.mutate(a.id)}
                  disabled={reactivate.isPending}
                >
                  Reactivate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  scheme="destructive"
                  size="sm"
                  onClick={() => deactivate.mutate(a.id)}
                  disabled={deactivate.isPending}
                >
                  Deactivate
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [deactivate, reactivate, resendInvite],
  );

  if (isLoading || !account) return null;
  if (!isSuperadmin) return null;

  const staff = (data?.accounts ?? []).filter((a) => a.role === "staff");

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Manage staff accounts for your institution."
      />
      {accountsLoading ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <DataTable
          id="staff-accounts"
          columns={staffColumns}
          data={staff}
          searchKey="email"
          searchPlaceholder="Search by name or email..."
          rowLabelSingular="account"
          rowLabelPlural="accounts"
          toolbarActions={<InviteStaffDialog />}
        />
      )}
    </PageContainer>
  );
}
