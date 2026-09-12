// The document-free government-agency/body claim (Docs/plans/
// GOVERNMENT_BODY_REGISTRATION_PLAN.md §3.1). Company-writable, never read
// as identity — mirrors Partners-Server's src/moa/identity-claim.ts.
export interface IdentityClaims {
  claimed_company_type?: "government_agency";
  claimed_registered_name?: string;
  claimed_registered_address?: string;
}

export function getIdentityClaims(claims: unknown): IdentityClaims {
  return (claims ?? {}) as IdentityClaims;
}

export function isGovernmentClaim(claims: unknown): boolean {
  return getIdentityClaims(claims).claimed_company_type === "government_agency";
}


export function isGovEmailDomain(email: string | null | undefined): boolean {
  return /(?:^|\.)gov(\.[a-z]{2,3})?$/i.test(email?.split("@")[1]?.trim() ?? "");
}
