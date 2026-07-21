/**
 * Tab-assignment + renewal-fork predicates (plan §4.1). Mirrors — not
 * shares, the row shapes differ — IOM-Server's
 * src/university/partner-predicates.ts. Both sides must stay in lockstep;
 * the server re-checks at send time regardless (D8), so client drift only
 * ever shows a stale badge, never a wrong send.
 */

export interface OutstandingMoaRow {
  isImported: boolean;
  hasActiveMoa: boolean;
  legacyEntry: {
    hasMoa: boolean;
    hasPerpetualMoa: boolean;
    valid_until: string | null;
  } | null;
}

/** Matches the pre-existing initialKind derivation (partners/page.tsx:731-737). */
export function isOutstandingMoa(
  row: OutstandingMoaRow,
  nowIso: string = new Date().toISOString(),
): boolean {
  if (!row.isImported) return row.hasActiveMoa;
  if (!row.legacyEntry?.hasMoa) return false;
  if (row.legacyEntry.hasPerpetualMoa) return true;
  if (!row.legacyEntry.valid_until) return true;
  return row.legacyEntry.valid_until >= nowIso;
}

/**
 * companyId(row) — the one predicate behind both the "No account yet" chip
 * and the renewal fork, so the label always describes what a renewal will
 * actually do (plan §6, "Legacy row with an account").
 */
export function resolvePartnerCompanyId(row: {
  partnerCompany: { id: string } | null;
  legacyEntry: { registered_company_id: string | null } | null;
}): string | null {
  return row.partnerCompany?.id ?? row.legacyEntry?.registered_company_id ?? null;
}
