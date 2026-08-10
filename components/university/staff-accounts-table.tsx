"use client";

import type { ReactNode } from "react";

import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModal } from "@/app/providers/modal-provider";

export interface StaffAccount {
  id: string;
  email: string;
  display_name: string;
  role: "superadmin" | "admin" | "staff";
  is_deactivated: boolean | null;
  created_at: string;
}

const ROLE_LABEL: Record<StaffAccount["role"], string> = {
  superadmin: "Owner",
  admin: "Admin",
  staff: "Staff",
};

// Client-side mirror of the server's assertCanActOn (§5.3): the owner row is
// never actionable, and an admin viewer may only act on staff rows.
function canActOn(viewerIsSuperadmin: boolean, targetRole: StaffAccount["role"]) {
  if (targetRole === "superadmin") return false;
  if (!viewerIsSuperadmin && targetRole === "admin") return false;
  return true;
}

function RoleTag({ role }: { role: StaffAccount["role"] }) {
  if (role === "staff") return null;
  return (
    <Badge type={role === "superadmin" ? "primary" : "default"}>
      {ROLE_LABEL[role]}
    </Badge>
  );
}

function AccountStatus({ account }: { account: StaffAccount }) {
  return account.is_deactivated ? (
    <PartnershipStatusBadge status="rejected" label="Deactivated" />
  ) : (
    <PartnershipStatusBadge status="active" label="Active" />
  );
}

function RoleCell({
  account,
  isSuperadmin,
  isChangingRole,
  onChangeRole,
}: {
  account: StaffAccount;
  isSuperadmin: boolean;
  isChangingRole: boolean;
  onChangeRole: (accountId: string, role: "staff" | "admin") => void;
}) {
  const { openModal, closeModal } = useModal();

  if (account.role === "superadmin" || !isSuperadmin) {
    return (
      <span className="text-sm text-gray-700">{ROLE_LABEL[account.role]}</span>
    );
  }

  const confirmChange = (role: "staff" | "admin") => {
    const modalName = `change-role-${account.id}`;
    const promoting = role === "admin";
    openModal(
      modalName,
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => closeModal(modalName)}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onChangeRole(account.id, role);
            closeModal(modalName);
          }}
        >
          {promoting ? "Make admin" : "Remove admin access"}
        </Button>
      </div>,
      {
        title: promoting
          ? `Make ${account.display_name} an admin?`
          : `Remove admin access from ${account.display_name}?`,
        description: promoting
          ? "Admins can edit the university profile and MOA signatory, toggle templates, and manage staff accounts."
          : `${account.display_name} will go back to a staff account and lose access to the university profile, MOA signatory, templates, and staff management.`,
        panelClassName: "!w-full sm:!max-w-md",
      },
    );
  };

  return (
    <Select
      value={account.role}
      onValueChange={(value) => confirmChange(value as "staff" | "admin")}
      disabled={isChangingRole}
    >
      <SelectTrigger
        className="h-8 w-28 cursor-pointer"
        onClick={(event) => event.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="staff">Staff</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

function AccountActions({
  account,
  isDeactivating,
  isReactivating,
  isResendingInvite,
  onDeactivate,
  onReactivate,
  onResendInvite,
  className,
}: {
  account: StaffAccount;
  isDeactivating: boolean;
  isReactivating: boolean;
  isResendingInvite: boolean;
  onDeactivate: (id: string) => void;
  onReactivate: (id: string) => void;
  onResendInvite: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          onResendInvite(account.id);
        }}
        disabled={isResendingInvite}
      >
        Resend invite
      </Button>
      {account.is_deactivated ? (
        <Button
          variant="outline"
          scheme="supportive"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onReactivate(account.id);
          }}
          disabled={isReactivating}
        >
          Reactivate
        </Button>
      ) : (
        <Button
          variant="outline"
          scheme="destructive"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onDeactivate(account.id);
          }}
          disabled={isDeactivating}
        >
          Deactivate
        </Button>
      )}
    </div>
  );
}

function AccountsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-1">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function StaffAccountsTable({
  accounts,
  isLoading,
  toolbarActions,
  isSuperadmin,
  isDeactivating,
  isReactivating,
  isResendingInvite,
  isChangingRole,
  onDeactivate,
  onReactivate,
  onResendInvite,
  onChangeRole,
}: {
  accounts: StaffAccount[];
  isLoading: boolean;
  toolbarActions: ReactNode;
  isSuperadmin: boolean;
  isDeactivating: boolean;
  isReactivating: boolean;
  isResendingInvite: boolean;
  isChangingRole: boolean;
  onDeactivate: (id: string) => void;
  onReactivate: (id: string) => void;
  onResendInvite: (id: string) => void;
  onChangeRole: (id: string, role: "staff" | "admin") => void;
}) {
  const columns: Array<ResourceTableColumn<StaffAccount>> = [
    {
      id: "name",
      header: "Name",
      width: "w-[20%]",
      getSortValue: (account) => account.display_name,
      render: (account) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-gray-900">
            {account.display_name}
          </span>
          <RoleTag role={account.role} />
        </span>
      ),
    },
    {
      id: "email",
      header: "Email",
      width: "w-[27%]",
      getSortValue: (account) => account.email,
      render: (account) => (
        <span className="text-muted-foreground">{account.email}</span>
      ),
    },
    {
      id: "role",
      header: "Role",
      width: "w-[13%]",
      getSortValue: (account) => ROLE_LABEL[account.role],
      render: (account) => (
        <RoleCell
          account={account}
          isSuperadmin={isSuperadmin}
          isChangingRole={isChangingRole}
          onChangeRole={onChangeRole}
        />
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "w-[14%]",
      getSortValue: (account) =>
        account.is_deactivated ? "deactivated" : "active",
      render: (account) => <AccountStatus account={account} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "w-[26%]",
      align: "right",
      sortable: false,
      render: (account) =>
        canActOn(isSuperadmin, account.role) ? (
          <AccountActions
            account={account}
            isDeactivating={isDeactivating}
            isReactivating={isReactivating}
            isResendingInvite={isResendingInvite}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
            onResendInvite={onResendInvite}
            className="flex items-center justify-end gap-2"
          />
        ) : null,
    },
  ];

  const table = useResourceTable({
    data: accounts,
    getRowId: (account) => account.id,
    columns,
    search: {
      placeholder: "Search by name or email...",
      ariaLabel: "Search staff accounts by name or email",
      matches: (account, query) =>
        account.display_name.toLowerCase().includes(query) ||
        account.email.toLowerCase().includes(query),
    },
    sort: { initialColumn: "name", initialDirection: "asc" },
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 20] },
  });

  if (isLoading) return <AccountsTableSkeleton />;

  return (
    <ResourceTable
      table={table}
      toolbarLeading={<div className="ml-auto flex">{toolbarActions}</div>}
      renderMobileRow={(account) => (
        <article className="px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {account.display_name}
                </p>
                <RoleTag role={account.role} />
              </div>
              <p className="text-muted-foreground mt-1 break-all text-sm">
                {account.email}
              </p>
            </div>
            <AccountStatus account={account} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Role</span>
            <RoleCell
              account={account}
              isSuperadmin={isSuperadmin}
              isChangingRole={isChangingRole}
              onChangeRole={onChangeRole}
            />
          </div>
          {canActOn(isSuperadmin, account.role) && (
            <AccountActions
              account={account}
              isDeactivating={isDeactivating}
              isReactivating={isReactivating}
              isResendingInvite={isResendingInvite}
              onDeactivate={onDeactivate}
              onReactivate={onReactivate}
              onResendInvite={onResendInvite}
              className="mt-4 flex flex-wrap items-center gap-2"
            />
          )}
        </article>
      )}
      emptyState={{
        title: "No accounts yet",
        description: "Invite a staff member to add them to your institution.",
      }}
      noResultsState={{
        title: "No accounts found",
        description: "Try searching by another name or email address.",
      }}
      rowLabelSingular="account"
      rowLabelPlural="accounts"
    />
  );
}
