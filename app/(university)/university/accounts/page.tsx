"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import {
  getUniversityControllerGetAccountsQueryKey,
  useUniversityControllerCreateStaff,
  useUniversityControllerDeactivateStaff,
  useUniversityControllerGetAccounts,
  useUniversityControllerReactivateStaff,
  useUniversityControllerResendInvite,
  useUniversityControllerUpdateStaffRole,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/auth-shell";
import { useModal } from "@/app/providers/modal-provider";
import { Loader2, Plus } from "lucide-react";
import {
  StaffAccountsTable,
  type StaffAccount,
} from "@/components/university/staff-accounts-table";

function InviteStaffForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const createStaff = useUniversityControllerCreateStaff({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerGetAccountsQueryKey(),
        });
        toast.success("Invitation sent");
        onClose();
      },
      onError: (e: Error) => setError(e.message),
    },
  });

  return (
    <form
      id="invite-staff"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        createStaff.mutate({ data: { email, display_name: name } });
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
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
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
      </div>
    </form>
  );
}

export default function AccountsPage() {
  const { account, isLoading, isSuperadmin, canManageUniversity } =
    useUniversityProfile();
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useModal();

  const { data, isLoading: accountsLoading } =
    useUniversityControllerGetAccounts({
      query: { enabled: !!account && canManageUniversity },
    });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getUniversityControllerGetAccountsQueryKey(),
    });

  const deactivate = useUniversityControllerDeactivateStaff({
    mutation: {
      onSuccess: invalidate,
      onError: (e: Error) => toast.error(e.message),
    },
  });
  const reactivate = useUniversityControllerReactivateStaff({
    mutation: {
      onSuccess: invalidate,
      onError: (e: Error) => toast.error(e.message),
    },
  });
  const resendInvite = useUniversityControllerResendInvite({
    mutation: {
      onSuccess: () => toast.success("Invitation resent"),
      onError: (e: Error) => toast.error(e.message),
    },
  });
  const changeRole = useUniversityControllerUpdateStaffRole({
    mutation: {
      onSuccess: invalidate,
      onError: (e: Error) => toast.error(e.message),
    },
  });

  if (isLoading || !account) return null;
  if (!canManageUniversity) return null;

  const accounts = data?.accounts ?? [];

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Manage staff accounts for your institution."
      />
      <StaffAccountsTable
        accounts={accounts}
        isLoading={accountsLoading}
        isSuperadmin={isSuperadmin}
        isDeactivating={deactivate.isPending}
        isReactivating={reactivate.isPending}
        isResendingInvite={resendInvite.isPending}
        isChangingRole={changeRole.isPending}
        onDeactivate={(accountId) => deactivate.mutate({ accountId })}
        onReactivate={(accountId) => reactivate.mutate({ accountId })}
        onResendInvite={(accountId) => resendInvite.mutate({ accountId })}
        onChangeRole={(accountId, role) =>
          changeRole.mutate({ accountId, data: { role } })
        }
        toolbarActions={
          <Button
            onClick={() =>
              openModal(
                "invite-staff",
                <InviteStaffForm onClose={() => closeModal("invite-staff")} />,
                {
                  title: "Invite staff member",
                  description:
                    "They'll receive an email to set their password and join your institution.",
                  panelClassName: "!w-full sm:!max-w-md",
                },
              )
            }
          >
            <Plus /> Invite staff
          </Button>
        }
      />
    </PageContainer>
  );
}
