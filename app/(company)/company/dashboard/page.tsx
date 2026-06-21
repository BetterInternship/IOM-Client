"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MoaStatusBadge } from "@/components/status-badge";
import { formatDateWithoutTime } from "@/lib/utils";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";

const REQUIRED_DOC_TYPES = [
  "business_permit",
  "sec_dti_registration",
  "mayor_permit",
  "or_registration",
];

interface Moa {
  id: string;
  status: "active" | "rejected";
  is_expired: boolean | null;
  effective_date: string;
  expiry_date: string;
  rejection_reason: string | null;
  university: { id: string; registered_name: string; logo_url: string | null };
}

function MoaRow({ moa }: { moa: Moa }) {
  return (
    <Link href={`/company/moas/${moa.id}`} className="block">
      <Card className="flex-row items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-gray-50">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {moa.university.registered_name}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatDateWithoutTime(moa.effective_date)} &ndash;{" "}
            {formatDateWithoutTime(moa.expiry_date)}
          </p>
          {moa.status === "rejected" && moa.rejection_reason && (
            <p className="text-destructive mt-1 text-xs">{moa.rejection_reason}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <MoaStatusBadge status={moa.status} isExpired={moa.is_expired} />
          <ChevronRight className="text-muted-foreground h-4 w-4" />
        </div>
      </Card>
    </Link>
  );
}

function MoaSection({ title, items }: { title: string; items: Moa[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title} ({items.length})
      </h2>
      <div className="space-y-2.5">
        {items.map((m) => (
          <MoaRow key={m.id} moa={m} />
        ))}
      </div>
    </section>
  );
}

export default function CompanyDashboardPage() {
  const { company, isLoading } = useCompanyProfile();

  const { data: moasData, isLoading: moasLoading } = useQuery({
    queryKey: ["company-moas"],
    queryFn: () =>
      preconfiguredAxios.get("/api/company/moas?limit=100").then((r) => r.data),
    enabled: !!company,
  });

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ["company-docs"],
    queryFn: () =>
      preconfiguredAxios.get("/api/company/documents").then((r) => r.data),
    enabled: !!company,
  });

  if (isLoading) {
    return (
      <PageContainer className="space-y-8">
        <Skeleton className="h-8 w-56" />
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </PageContainer>
    );
  }
  if (!company) return null;

  const moas: Moa[] = moasData?.moas ?? [];
  const active = moas.filter((m) => m.status === "active" && !m.is_expired);
  const rejected = moas.filter((m) => m.status === "rejected");
  const expired = moas.filter((m) => m.is_expired);

  const profileComplete = !!(
    company.registered_name &&
    company.company_type &&
    company.registered_address &&
    company.rep_name &&
    company.rep_title
  );

  const docs = (docsData?.documents ?? []) as Array<{ type: string }>;
  const docsComplete = REQUIRED_DOC_TYPES.every((t) =>
    docs.some((d) => d.type === t)
  );

  // Whether the company is eligible to request MOAs yet.
  const canRequest = profileComplete && docsComplete;
  const gatesLoading = moasLoading || docsLoading;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Active MOAs"
        description="This is a list of your outstanding MOAs."
      >
        {canRequest && (
          <Button asChild>
            <Link href="/company/universities">
              <Plus /> Request MOA
            </Link>
          </Button>
        )}
      </PageHeader>

      {gatesLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !canRequest ? (
        <>
          {/* Onboarding gate — dominates the screen until setup is complete. */}
          <div className="flex min-h-[60vh] items-center justify-center">
            <Card className="w-full max-w-lg items-center gap-4 px-6 py-12 text-center">
              <span className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full">
                <ClipboardList className="h-7 w-7" />
              </span>
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold tracking-tight text-gray-900">
                  Finish setting up your account
                </h2>
                <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                  Complete your company profile and upload all four required
                  documents. Once everything&apos;s in, you can start requesting
                  MOAs from partner universities.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/company/profile">Complete your profile</Link>
              </Button>
            </Card>
          </div>

          {/* Defensive: still surface any existing MOAs below the gate. */}
          {moas.length > 0 && (
            <div className="space-y-8">
              <MoaSection title="Active" items={active} />
              <MoaSection title="Rejected" items={rejected} />
              <MoaSection title="Expired" items={expired} />
            </div>
          )}
        </>
      ) : moas.length === 0 ? (
        <EmptyState
          title="No MOAs yet"
          description="Browse partner universities and request your first memorandum of agreement."
        >
          <Button asChild variant="outline" scheme="primary">
            <Link href="/company/universities">Browse universities</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <MoaSection title="Active" items={active} />
          <MoaSection title="Rejected" items={rejected} />
          <MoaSection title="Expired" items={expired} />
        </div>
      )}
    </PageContainer>
  );
}
