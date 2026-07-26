"use client";
import { useParams } from "next/navigation";
import { useUniversityControllerGetMoaDetail } from "@/app/api";
import { UniversityMoaDetail } from "@/components/university/university-moa-detail";

export default function UniversityMoaDetailPage() {
  const { moaId } = useParams<{ moaId: string }>();

  const { data, isLoading } = useUniversityControllerGetMoaDetail(moaId, {
    query: { refetchInterval: 25 * 60 * 1000 },
  });

  return (
    <UniversityMoaDetail
      data={data}
      isLoading={isLoading}
      backHref="/partners#active-partners"
      backLabel="Active Partners"
    />
  );
}
