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
  // Whoever is actually sending this email — distinct from the university's
  // MOA representative (rep_name/rep_title), who only ever signs documents
  // and may not be the person composing invites at all.
  accountHolderName?: string | null;
  accountHolderTitle?: string | null;
  personalMessage?: string | null;
  inviteLink: string;
}

// §8 — subject line by kind. Falls back if the profile's registered_name
// is somehow blank, rather than rendering a bare leading em dash.
export function buildInviteSubject(
  input: Pick<InviteMessageInput, "kind" | "universityName">,
): string {
  const name = input.universityName || "Our University";
  return input.kind === "moa"
    ? `${name} — internship partnership`
    : `${name} — invitation to post internship listings`;
}

// The greeting and closing are fixed, uneditable copy — the coordinator
// only writes the paragraph in between. Exported so the invite form can
// render the exact same text as a static preview around the message
// textarea, instead of it being a surprise once the email is opened.
export function buildInviteGreeting(companyName?: string | null): string {
  return companyName ? `Hi ${companyName},` : "Hello,";
}

export function buildInviteClosingIntro(kind: "moa" | "listing"): string {
  return kind === "moa"
    ? "You can review the partnership agreement and get started here:"
    : "Students will see your listings on BetterInternship.\nPost them through:";
}

// §8 — plain text (the templates' HTML can't survive a `body` URL param,
// and arguably shouldn't: a branded card undercuts the "a person at the
// university wrote this" effect manual send is buying).
export function buildInviteBody(input: InviteMessageInput): string {
  const hasAccountHolder =
    !!input.accountHolderName && !!input.accountHolderTitle;

  const paragraphs = [buildInviteGreeting(input.companyName)];

  if (input.personalMessage) paragraphs.push(input.personalMessage);

  paragraphs.push(
    `${buildInviteClosingIntro(input.kind)}\n${input.inviteLink}`,
  );

  if (hasAccountHolder) {
    const universityName = input.universityName || "the university";
    // Blank paragraph in place of the old "valid for 7 days" line — keeps
    // the extra breathing room before the sign-off without the text.
    paragraphs.push("");
    paragraphs.push(
      `${input.accountHolderName}\n${input.accountHolderTitle}, ${universityName}`,
    );
  }

  return paragraphs.join("\n\n");
}
