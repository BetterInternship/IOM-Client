// Manual invite send (plan §7/§8) — a prefilled compose window in the
// university's own webmail replaces sending through SES. Everything here is
// pure/client-only: no network calls, safe to call on every render.

export type ComposeProvider = "gmail" | "outlook";

export const INVITE_CC_EMAIL = "invites@betterinternship.com";

// D7/D8 — one welcome-message draft + provider choice, remembered per
// university account (not per university) so two coordinators sharing a
// browser don't inherit each other's draft. Shared between the invite form
// (which writes it) and the invites table's "Re-open compose" action (which
// only reads the remembered provider).
export interface InviteComposeDraft {
  welcomeMessage: string;
  provider: ComposeProvider;
}

const DRAFT_STORAGE_PREFIX = "iom-university-invite-compose-draft";

export function loadInviteDraft(accountId: string): InviteComposeDraft | null {
  try {
    const raw = window.localStorage.getItem(
      `${DRAFT_STORAGE_PREFIX}:${accountId}`,
    );
    return raw ? (JSON.parse(raw) as InviteComposeDraft) : null;
  } catch {
    return null;
  }
}

export function saveInviteDraft(
  accountId: string,
  draft: InviteComposeDraft,
): void {
  try {
    window.localStorage.setItem(
      `${DRAFT_STORAGE_PREFIX}:${accountId}`,
      JSON.stringify(draft),
    );
  } catch {
    // Private browsing / quota exceeded — the draft is a nicety, not required.
  }
}

interface ComposeMailInput {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}

// §7 — every value goes through encodeURIComponent, which is what renders
// newlines as %0A; both providers expect that. Gmail omits /u/0/ so it
// targets whichever account is currently signed in rather than pinning to
// the first one. outlook.office.com (not outlook.live.com) is the work/
// school endpoint, the right default for university staff.
export function buildComposeUrl(
  provider: ComposeProvider,
  input: ComposeMailInput,
): string {
  const to = encodeURIComponent(input.to);
  const cc = input.cc ? encodeURIComponent(input.cc) : null;
  const subject = encodeURIComponent(input.subject);
  const body = encodeURIComponent(input.body);

  if (provider === "gmail") {
    const params = [
      "view=cm",
      "fs=1",
      `to=${to}`,
      cc ? `cc=${cc}` : null,
      `su=${subject}`,
      `body=${body}`,
    ].filter((p): p is string => p !== null);
    return `https://mail.google.com/mail/?${params.join("&")}`;
  }

  const params = [
    `to=${to}`,
    cc ? `cc=${cc}` : null,
    `subject=${subject}`,
    `body=${body}`,
  ].filter((p): p is string => p !== null);
  return `https://outlook.office.com/mail/deeplink/compose?${params.join("&")}`;
}

export interface InviteMessageInput {
  kind: "moa" | "listing";
  universityName: string;
  companyName?: string | null;
  repName?: string | null;
  repTitle?: string | null;
  personalMessage?: string | null;
  inviteLink: string;
}

// §8 — subject line by kind.
export function buildInviteSubject(
  input: Pick<InviteMessageInput, "kind" | "universityName">,
): string {
  return input.kind === "moa"
    ? `${input.universityName}: Internship Partnership`
    : `${input.universityName}: Invitation to Post Internship Listings`;
}

function buildIntro(input: InviteMessageInput, hasRep: boolean): string {
  if (input.kind === "moa") {
    // Hard-gated server-side (company-invite.service.ts sendInvite) —
    // rep_name/rep_title are guaranteed present for a moa-kind invite.
    return `I'm ${input.repName}, ${input.repTitle} at ${input.universityName}. We'd like to establish an internship partnership with your company. We handle our MOAs through BetterInternship, so I've set up an invitation for you there.`;
  }
  if (hasRep) {
    return `I'm ${input.repName}, ${input.repTitle} at ${input.universityName}. We'd like to invite your company to post internship listings on BetterInternship.`;
  }
  // listing-kind only: rep_name/rep_title aren't gated, so this drops the
  // first-person framing entirely when they're absent (plan §8).
  return `${input.universityName} would like to invite your company to post internship listings on BetterInternship.`;
}

// §8 — plain text (the templates' HTML can't survive a `body` URL param,
// and arguably shouldn't: a branded card undercuts the "a person at the
// university wrote this" effect manual send is buying).
export function buildInviteBody(input: InviteMessageInput): string {
  const greeting = input.companyName ? `Hi ${input.companyName},` : "Hello,";
  const hasRep = !!input.repName && !!input.repTitle;

  const paragraphs = [greeting, buildIntro(input, hasRep)];

  if (input.personalMessage) paragraphs.push(input.personalMessage);

  paragraphs.push(
    `You can review the details and get started here:\n${input.inviteLink}`,
  );
  paragraphs.push("This link is valid for 7 days.");

  if (hasRep) {
    paragraphs.push(`${input.repName}\n${input.repTitle}, ${input.universityName}`);
  }

  return paragraphs.join("\n\n");
}
