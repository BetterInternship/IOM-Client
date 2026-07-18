"use client";

import type { ReactNode } from "react";

import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface StaffAccount {
  id: string;
  email: string;
  display_name: string;
  role: "superadmin" | "staff";
  is_deactivated: boolean | null;
  created_at: string;
}

function AccountStatus({ account }: { account: StaffAccount }) {
  return account.is_deactivated ? (
    <PartnershipStatusBadge status="rejected" label="Deactivated" />
  ) : (
    <PartnershipStatusBadge status="active" label="Active" />
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
  isDeactivating,
  isReactivating,
  isResendingInvite,
  onDeactivate,
  onReactivate,
  onResendInvite,
}: {
  accounts: StaffAccount[];
  isLoading: boolean;
  toolbarActions: ReactNode;
  isDeactivating: boolean;
  isReactivating: boolean;
  isResendingInvite: boolean;
  onDeactivate: (id: string) => void;
  onReactivate: (id: string) => void;
  onResendInvite: (id: string) => void;
}) {
  const columns: Array<ResourceTableColumn<StaffAccount>> = [
    {
      id: "name",
      header: "Name",
      width: "w-[24%]",
      getSortValue: (account) => account.display_name,
      render: (account) => (
        <span className="font-medium text-gray-900">
          {account.display_name}
        </span>
      ),
    },
    {
      id: "email",
      header: "Email",
      width: "w-[32%]",
      getSortValue: (account) => account.email,
      render: (account) => (
        <span className="text-muted-foreground">{account.email}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "w-[16%]",
      getSortValue: (account) =>
        account.is_deactivated ? "deactivated" : "active",
      render: (account) => <AccountStatus account={account} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "w-[28%]",
      align: "right",
      sortable: false,
      render: (account) => (
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
      ),
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
              <p className="truncate text-sm font-semibold text-gray-900">
                {account.display_name}
              </p>
              <p className="text-muted-foreground mt-1 break-all text-sm">
                {account.email}
              </p>
            </div>
            <AccountStatus account={account} />
          </div>
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
        </article>
      )}
      emptyState={{
        title: "No staff accounts yet",
        description: "Invite a staff member to add them to your institution.",
      }}
      noResultsState={{
        title: "No staff accounts found",
        description: "Try searching by another name or email address.",
      }}
      rowLabelSingular="account"
      rowLabelPlural="accounts"
    />
  );
}
