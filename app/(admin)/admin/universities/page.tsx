"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Building2, Loader2, Plus } from "lucide-react";

interface University {
  id: string;
  registered_name: string;
  is_deactivated: boolean | null;
  university_accounts?: { email: string }[];
}

const EMPTY_FORM = {
  registered_name: "",
  superadmin_email: "",
  superadmin_display_name: "",
};

function CreateUniversityDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/admin/universities", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-universities"] });
      toast.success("University created");
      setForm(EMPTY_FORM);
      setError("");
      setOpen(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  const valid = form.registered_name && form.superadmin_email;

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
          <Plus /> Add university
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create university</DialogTitle>
          <DialogDescription>
            The superadmin is emailed an invitation to set their password.
          </DialogDescription>
        </DialogHeader>

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
          <div className="space-y-1.5">
            <Label htmlFor="superadmin_display_name">Superadmin name</Label>
            <Input
              id="superadmin_display_name"
              placeholder="Juan Dela Cruz"
              value={form.superadmin_display_name}
              onChange={(e) =>
                setForm({ ...form, superadmin_display_name: e.target.value })
              }
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUniversitiesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-universities"],
    queryFn: async () => {
      const res = await preconfiguredAxios.get("/api/admin/universities");
      return res.data.universities as University[];
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) =>
      preconfiguredAxios.patch(`/api/admin/universities/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-universities"] });
      toast.success("University deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Universities"
        description="Onboard institutions and manage their access to the platform."
      >
        <CreateUniversityDialog />
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No universities yet"
          description="Add your first institution to get started."
        />
      ) : (
        <div className="space-y-2.5">
          {data.map((uni) => (
            <Card
              key={uni.id}
              className="flex-row items-center justify-between gap-4 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-muted text-muted-foreground flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.33em]">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {uni.registered_name}
                    </p>
                    {uni.is_deactivated && (
                      <Badge type="destructive" strength="medium">
                        Deactivated
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {uni.university_accounts?.[0]?.email ?? "No superadmin"}
                  </p>
                </div>
              </div>

              {!uni.is_deactivated && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      scheme="destructive"
                      size="sm"
                      className="flex-shrink-0"
                    >
                      Deactivate
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Deactivate {uni.registered_name}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Staff will lose access and the institution can no longer
                        receive new MOA requests. This can be reversed later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deactivate.mutate(uni.id)}
                      >
                        Deactivate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
