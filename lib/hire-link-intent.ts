export interface HireLinkIntentPreview {
  employerName: string;
  email: string;
}

/**
 * The signature is verified by IOM Server before a link is created. This only
 * reads the payload to explain the active BetterInternship connection in UI.
 */
export function peekHireLinkIntent(
  token: string,
): HireLinkIntentPreview | null {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as {
      employer_name?: string;
      email?: string;
    };
    if (!payload.employer_name) return null;
    return {
      employerName: payload.employer_name,
      email: payload.email ?? "",
    };
  } catch {
    return null;
  }
}
