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

const IDENTITY_CHOICE_INTENT_KEY = "identity-choice-intent";

// Captured when the invite landing page's two-button prompt
// (app/invite/page.tsx) records an explicit choice before an authenticated
// session exists to write it to. Consumed once, by whichever picker surface
// mounts next (/invite/continue), so it never lingers into a later,
// unrelated visit.
export function saveIdentityChoiceIntent(choice: "company" | "government") {
  try {
    window.sessionStorage.setItem(IDENTITY_CHOICE_INTENT_KEY, choice);
  } catch {
    // Private browsing / disabled storage — the picker just falls back to
    // email detection instead of the explicit choice.
  }
}

export function consumeIdentityChoiceIntent(): "company" | "government" | null {
  try {
    const value = window.sessionStorage.getItem(IDENTITY_CHOICE_INTENT_KEY);
    if (value === "company" || value === "government") {
      window.sessionStorage.removeItem(IDENTITY_CHOICE_INTENT_KEY);
      return value;
    }
  } catch {
    // See saveIdentityChoiceIntent.
  }
  return null;
}
