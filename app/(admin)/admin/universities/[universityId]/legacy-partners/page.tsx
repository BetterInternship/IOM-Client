import { redirect } from "next/navigation";

export default async function AdminLegacyPartnersRedirectPage({
  params,
}: {
  params: Promise<{ universityId: string }>;
}) {
  const { universityId } = await params;
  redirect(`/admin/universities/${universityId}`);
}
