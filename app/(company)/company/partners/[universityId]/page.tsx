"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useCompanyControllerListMoas } from "@/app/api";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import { PageContainer } from "@/components/page-header";
import {
  CompanyPartnerMoasTable,
  type CompanyPartnerMoa,
} from "@/components/company/company-partner-moas-table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function universityInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function UniversityLogo({
  university,
}: {
  university: CompanyPartnerMoa["university"];
}) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.33em] border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600">
      {university.logo_url ? (
        // University logos are user-uploaded external assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={university.logo_url}
          alt={`${university.registered_name} logo`}
          className="h-full w-full object-contain"
        />
      ) : (
        <span aria-hidden="true">
          {universityInitials(university.registered_name)}
        </span>
      )}
    </div>
  );
}

export default function CompanyPartnerDetailPage() {
  const { universityId } = useParams<{ universityId: string }>();
  const router = useRouter();
  const { company, isLoading: companyLoading } = useCompanyProfile();
  const { data, isLoading: moasLoading } = useCompanyControllerListMoas(
    { limit: 100 },
    { query: { enabled: !!company } },
  );

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/dashboard");
  };

  const moas = (data?.moas ?? []) as unknown as CompanyPartnerMoa[];
  const partnerMoas = moas
    .filter((moa) => moa.university?.id === universityId)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const university = partnerMoas[0]?.university;
  const activeCount = partnerMoas.filter(
    (moa) => moa.status === "active" && !moa.is_expired,
  ).length;
  if (companyLoading || moasLoading) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-12 w-72 max-w-full" />
        <Skeleton className="h-72 w-full" />
      </PageContainer>
    );
  }
  if (!company) return null;

  if (!university) {
    return (
      <PageContainer className="space-y-4">
        <button
          type="button"
          onClick={goBack}
          className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Partners
        </button>
        <Card>
          <CardContent className="text-destructive py-8 text-center text-sm">
            Partner university not found.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-4">
      <button
        type="button"
        onClick={goBack}
        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Partners
      </button>

      <div className="flex items-center gap-4">
        <UniversityLogo university={university} />
        <div className="min-w-0">
          <h1 className="truncate text-lg leading-tight font-semibold text-gray-900 sm:text-2xl">
            {university.registered_name}
          </h1>
        </div>
      </div>

      <CompanyPartnerMoasTable moas={partnerMoas} activeCount={activeCount} />
    </PageContainer>
  );
}
