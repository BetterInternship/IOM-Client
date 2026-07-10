"use client";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { useCompanyControllerListUniversities, type CompanyUniversityDirectoryItemDto } from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { RequestDialog } from "@/components/moa-request-dialog";
import Link from "next/link";

interface DialogState {
  universityId: string;
}

export default function UniversityDirectoryPage() {
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: vLoading } = useCompanyVerification(!!company);
  const verified = verification?.status === "verified";

  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  const { data, isLoading: uniLoading } = useCompanyControllerListUniversities({
    query: {
      enabled: !!company && verified,
    },
  });

  const columns = useMemo<ColumnDef<CompanyUniversityDirectoryItemDto>[]>(
    () => [
      {
        id: "name",
        header: "University",
        accessorFn: (row) => row.registered_name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-gray-900">{row.original.registered_name}</p>
            {row.original.address && (
              <p className="text-muted-foreground truncate text-xs">{row.original.address}</p>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableResizing: false,
        size: 140,
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            {row.original.requestable ? (
              <Button size="sm" onClick={() => setDialogState({ universityId: row.original.id })}>
                Request MOA
              </Button>
            ) : (
              <Badge type="default">Unavailable</Badge>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  if (isLoading || vLoading) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full" />
      </PageContainer>
    );
  }
  if (!company) return null;

  if (!verified) {
    const status = verification?.status;
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          title="Request MOA"
          description="This is a list of universities you can request a MOA with."
        />
        <div className="border-warning/30 bg-warning/10 rounded-[0.33em] border p-4 text-sm text-gray-700">
          {status === "rejected"
            ? verification?.rejectionReason ||
              "Your company could not be verified. Please review your profile and documents."
            : status === "incomplete"
              ? "Complete your profile and upload all required documents so the platform team can verify your company."
              : status === "expired"
                ? "Your company verification has expired. Please re-upload your documents to request re-review."
                : "Your company is pending verification by the platform team. You can request MOAs once it's approved."}{" "}
          <Link href="/profile" className="text-primary underline">
            Go to your profile
          </Link>
          .
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Request MOA"
        description="This is a list of universities you can request a MOA with."
      />

      {uniLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <DataTable
          id="university-directory"
          columns={columns}
          data={data?.universities ?? []}
          searchPlaceholder="Search universities..."
          rowLabelSingular="university"
          rowLabelPlural="universities"
        />
      )}

      {dialogState && (
        <RequestDialog
          universityId={dialogState.universityId}
          verified={verified}
          onClose={() => setDialogState(null)}
        />
      )}
    </PageContainer>
  );
}
