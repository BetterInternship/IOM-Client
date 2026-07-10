"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircleQuestion, Search } from "lucide-react";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import {
  useCompanyControllerListUniversities,
  type CompanyUniversityDirectoryItemDto,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RequestDialog } from "@/components/moa-request-dialog";
import { useModal } from "@/app/providers/modal-provider";

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
  university: CompanyUniversityDirectoryItemDto;
}) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[0.33em] border border-gray-200 bg-gray-50 text-lg font-semibold text-gray-600 sm:h-20 sm:w-20">
      {university.logo_url ? (
        // University logos are user-uploaded and served from signed external URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={university.logo_url}
          alt={`${university.registered_name} logo`}
          className="h-full w-full object-contain p-2"
        />
      ) : (
        <span aria-hidden="true">
          {universityInitials(university.registered_name)}
        </span>
      )}
    </div>
  );
}

export default function UniversityDirectoryPage() {
  const [search, setSearch] = useState("");
  const { company, isLoading } = useCompanyProfile();
  const { data: verification, isLoading: vLoading } =
    useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const { openModal, closeModal } = useModal();

  const { data, isLoading: uniLoading } = useCompanyControllerListUniversities({
    query: { enabled: !!company && verified },
  });

  const requestableUniversities = useMemo(
    () =>
      (data?.universities ?? []).filter((university) => university.requestable),
    [data?.universities],
  );

  const visibleUniversities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requestableUniversities;
    return requestableUniversities.filter(
      (university) =>
        university.registered_name.toLowerCase().includes(query) ||
        university.address?.toLowerCase().includes(query),
    );
  }, [requestableUniversities, search]);

  const openRequestDialog = (university: CompanyUniversityDirectoryItemDto) => {
    openModal(
      "request-moa",
      <RequestDialog
        universityId={university.id}
        verified={verified}
        onClose={() => closeModal("request-moa")}
      />,
      {
        title: (
          <h2 className="text-2xl leading-snug font-semibold tracking-tight">
            Requesting a MOA with{" "}
            <span className="text-primary">{university.registered_name}</span>
          </h2>
        ),
        panelClassName: "sm:!max-w-none",
        headerClassName: "request-moa-header",
        exitAnimation: "fade",
      },
    );
  };

  if (isLoading || vLoading) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-8 w-64" />
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
    <PageContainer className="space-y-8 pb-12">
      <PageHeader
        title="Request MOA"
        description="This is a list of universities you can request a MOA with."
      />

      {uniLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-11 w-full max-w-xl" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="relative w-full max-w-xl">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 z-20 h-4 w-4 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search universities..."
                aria-label="Search universities"
                className="placeholder:text-muted-foreground/60 focus:border-primary h-11 w-full rounded-[0.33em] border border-gray-200 bg-white pr-4 pl-11 text-sm outline-none transition-colors"
              />
            </div>
          </div>

          {visibleUniversities.length ? (
            <div className="space-y-4">
              {visibleUniversities.map((university) => (
                <article
                  key={university.id}
                  className="group grid cursor-pointer gap-6 rounded-[0.33em] border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300 hover:bg-gray-50/40 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.7fr)_auto] lg:items-center"
                  onClick={() => openRequestDialog(university)}
                >
                  <div className="flex min-w-0 items-center gap-5">
                    <UniversityLogo university={university} />
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
                        {university.registered_name}
                      </h2>
                      <p className="text-muted-foreground mt-1 text-sm leading-5">
                        {university.address || "Address not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center lg:justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/60 px-3 py-1.5 text-sm font-medium text-emerald-800">
                      <span>Instant Approval</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Learn what instant approval means"
                            className="text-primary cursor-help rounded-full focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MessageCircleQuestion className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={8}
                          className="max-w-64 bg-gray-900 px-3 py-2 leading-5 text-white shadow-sm"
                          arrowClassName="fill-gray-900"
                        >
                          MOAs are approved instantly upon submission.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex items-center lg:py-3 lg:pl-6">
                    <Button
                      size="md"
                      className="w-full lg:w-auto"
                      onClick={(event) => {
                        event.stopPropagation();
                        openRequestDialog(university);
                      }}
                    >
                      Request MOA
                      <ArrowRight />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[0.33em] border border-dashed border-gray-300 px-6 py-12 text-center">
              <p className="text-sm font-medium text-gray-700">
                No universities found
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Try searching by university name or address.
              </p>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
