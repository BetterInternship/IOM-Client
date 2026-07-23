import { PSM, type Worker } from "tesseract.js";
import { loadPdfFromFile } from "@betterinternship/core/pdf-viewer";

export type LegacyMoaOcrResult = {
  companyName: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  isPerpetual: boolean | null;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");
const OCR_DAY_PATTERN = "[0-3OILSZB]?[0-9OILSZB]";
const OCR_YEAR_PATTERN = "2[0O][0-9OILSZB]{2}";

function parseOcrNumber(value: string) {
  const normalized = value
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/Z/g, "2")
    .replace(/S/g, "5")
    .replace(/B/g, "8");
  return /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
}

function isoDate(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseSigningDate(text: string, corroborationText = text) {
  const matches: Array<{ value: string; index: number; score: number }> = [];
  const currentYear = new Date().getFullYear();
  const plausibleYears = [...corroborationText.matchAll(/\b(20\d{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year <= currentYear && year >= currentYear - 15);

  const addMatch = (
    year: number,
    month: number,
    day: number,
    index: number,
  ) => {
    const context = text
      .slice(Math.max(0, index - 120), index + 120)
      .toLowerCase();
    let correctedYear = year;

    // A signed/notarized agreement cannot be executed in the future. Scanned
    // stamps commonly turn a 6 into an 8, so corroborate against nearby years
    // elsewhere in the agreement before accepting the OCR year.
    if (year > currentYear) {
      const corroborated = plausibleYears
        .filter((candidate) => Math.abs(candidate - year) <= 3)
        .sort((a, b) => b - a)[0];
      if (!corroborated) return;
      correctedYear = corroborated;
    }

    const value = isoDate(correctedYear, month, day);
    if (!value) return;

    let score = 0;
    if (
      /before me|personally appeared|on this|day of|executed and signed|signed on/.test(
        context,
      )
    ) {
      score += 12;
    }
    if (/acknowledg|notary public/.test(context)) score += 4;
    if (
      /validity|valid until|until december|prc|mcle|ibp|ptr|roll no|government-issued id/.test(
        context,
      )
    ) {
      score -= 15;
    }
    if (year > currentYear) score -= 2;

    matches.push({ value, index, score });
  };

  const monthFirst = new RegExp(
    `\\b(${MONTH_PATTERN})[\\s.:-]*(${OCR_DAY_PATTERN})(?:st|nd|rd|th)?[,\\s.-]*(${OCR_YEAR_PATTERN})\\b`,
    "gi",
  );
  const dayFirst = new RegExp(
    `\\b(${OCR_DAY_PATTERN})(?:st|nd|rd|th)?[\\s.-]+(${MONTH_PATTERN})[,\\s.-]*(${OCR_YEAR_PATTERN})\\b`,
    "gi",
  );

  for (const match of text.matchAll(monthFirst)) {
    addMatch(
      parseOcrNumber(match[3]),
      MONTHS[match[1].toLowerCase()],
      parseOcrNumber(match[2]),
      match.index ?? 0,
    );
  }
  for (const match of text.matchAll(dayFirst)) {
    addMatch(
      parseOcrNumber(match[3]),
      MONTHS[match[2].toLowerCase()],
      parseOcrNumber(match[1]),
      match.index ?? 0,
    );
  }

  return (
    matches.sort((a, b) => b.score - a.score || a.index - b.index)[0]?.value ??
    null
  );
}

function enhanceAcknowledgmentScan(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < image.data.length; index += 4) {
    const gray =
      image.data[index] * 0.299 +
      image.data[index + 1] * 0.587 +
      image.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.65 + 128));
    const value = contrasted > 235 ? 255 : contrasted;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
  }

  context.putImageData(image, 0, 0);
}

function cropCanvas(
  source: HTMLCanvasElement,
  crop: { left: number; top: number; width: number; height: number },
  outputScale = 1,
) {
  const canvas = document.createElement("canvas");
  const sourceX = Math.round(source.width * crop.left);
  const sourceY = Math.round(source.height * crop.top);
  const sourceWidth = Math.round(source.width * crop.width);
  const sourceHeight = Math.round(source.height * crop.height);
  canvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
  canvas.height = Math.max(1, Math.round(sourceHeight * outputScale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Could not prepare an OCR crop");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

function parseMonthRangeExpiry(text: string) {
  const range = new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(20\\d{2})\\s+(?:to|through|until|-)\\s+(${MONTH_PATTERN})\\s+(20\\d{2})\\b`,
    "i",
  ).exec(text);
  if (!range) return null;

  const month = MONTHS[range[3].toLowerCase()];
  const year = Number(range[4]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return isoDate(year, month, lastDay);
}

function parseExplicitEndDate(text: string) {
  const monthFirst = new RegExp(
    `\\b(?:to|through|until|expires?(?:\\s+on)?|ending(?:\\s+on)?)\\s+(${MONTH_PATTERN})[\\s.]+(\\d{1,2})(?:st|nd|rd|th)?[,\\s]+(20\\d{2})\\b`,
    "i",
  ).exec(text);
  if (monthFirst) {
    return isoDate(
      Number(monthFirst[3]),
      MONTHS[monthFirst[1].toLowerCase()],
      Number(monthFirst[2]),
    );
  }

  const dayFirst = new RegExp(
    `\\b(?:to|through|until|expires?(?:\\s+on)?|ending(?:\\s+on)?)\\s+(\\d{1,2})(?:st|nd|rd|th)?[\\s.-]+(${MONTH_PATTERN})[,\\s.-]+(20\\d{2})\\b`,
    "i",
  ).exec(text);
  if (!dayFirst) return null;
  return isoDate(
    Number(dayFirst[3]),
    MONTHS[dayFirst[2].toLowerCase()],
    Number(dayFirst[1]),
  );
}

function companyFromFilename(filename: string) {
  const parts = filename
    .replace(/\.pdf$/i, "")
    .split(/[_-]+/)
    .filter(
      (part) =>
        !/^(nu|nufv|betterinternship|moa|nonperp|signed|final|copy)$/i.test(
          part,
        ),
    );
  return parts.at(-1)?.trim() || null;
}

function normalizeBlock(value: string) {
  return value.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function legalNameFromPartyParagraph(paragraph: string) {
  const value = normalizeBlock(paragraph).replace(/^[-\s]*and[-\s]*/i, "");
  const descriptor =
    /,\s+(?=(?:a|an|the)\s+|business process outsourcing\b|national government agency\b|government agency\b|financial technology\b|duly (?:organized|registered|existing)\b)/i;
  const boundary = descriptor.exec(value);
  if (boundary?.index) return value.slice(0, boundary.index).trim();

  const firstLine = paragraph
    .split(/\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (firstLine && firstLine.length <= 120) {
    return firstLine.replace(/,\s*$/, "").trim();
  }
  return null;
}

function companyFromPartyStructure(text: string) {
  const universityAnchor = /\bNU\s+FAIRVIEW\b/i.exec(text);
  if (universityAnchor) {
    const afterUniversity = text.slice(
      universityAnchor.index + universityAnchor[0].length,
    );
    const separator = /(?:^|\n)\s*[-–—]*\s*and\s*[-–—]*\s*(?:\n|$)/im.exec(
      afterUniversity,
    );
    if (separator) {
      const afterSeparator = afterUniversity.slice(
        separator.index + separator[0].length,
      );
      const paragraph = afterSeparator.split(/\n\s*\n+/)[0];
      const legalName = legalNameFromPartyParagraph(paragraph);
      if (legalName) return legalName;
    }
  }

  const blocks = text
    .split(/\n\s*\n+/)
    .map((original) => ({ original, normalized: normalizeBlock(original) }))
    .filter((block) => block.normalized);
  const universityIndex = blocks.findIndex((block) =>
    /\bNU\s+FAIRVIEW\b/i.test(block.normalized),
  );
  if (universityIndex === -1) return null;

  const separatorIndex = blocks.findIndex(
    (block, index) =>
      index > universityIndex && /^-*\s*and\s*-*[.:]?$/i.test(block.normalized),
  );
  if (separatorIndex === -1) return null;

  const companyParagraph = blocks[separatorIndex + 1]?.original;
  return companyParagraph
    ? legalNameFromPartyParagraph(companyParagraph)
    : null;
}

function companyFromText(text: string, filename: string) {
  const structuredCompany = companyFromPartyStructure(text);
  if (structuredCompany) return structuredCompany;

  const candidates: string[] = [];
  const organization = /(?:^|\n)\s*([A-Z][^\n]{2,100}?),\s+(?:a|an)\s+/gim;

  for (const match of text.matchAll(organization)) {
    const candidate = match[1]
      .replace(/^[\s-and]+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (
      candidate &&
      !/\b(?:university|college|school|nu fairview|national university)\b/i.test(
        candidate,
      )
    ) {
      candidates.push(candidate);
    }
  }

  return candidates[0] ?? companyFromFilename(filename);
}

function extractEffectivitySection(pageTexts: string[]) {
  for (const pageText of pageTexts) {
    if (hasEffectivityHeading(pageText)) return pageText;
  }
  return null;
}

function normalizeHeadingText(text: string) {
  return text
    .toUpperCase()
    .replace(/[|!]/g, "I")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

function hasEffectivityHeading(text: string) {
  const normalized = normalizeHeadingText(text);
  return (
    /SECT(?:I|1|L)ON\s*(?:7|VII)\s*[:.-]?\s*EFFECT(?:I|1|L)V(?:I|1|L)TY(?:\s*&|\s+AND)?\s*TERM(?:I|1|L)NAT(?:I|1|L)ON/.test(
      normalized,
    ) ||
    /ART(?:I|1|L)CLE\s*(?:9|IX)\s*[:.-]?\s*EFFECT(?:I|1|L)V(?:I|1|L)TY/.test(
      normalized,
    )
  );
}

function hasAcknowledgmentHeading(text: string) {
  return /ACKNOWLEDG(?:E)?M[EI]NT/i.test(normalizeHeadingText(text));
}

async function recognizeAcknowledgmentDate(
  worker: Worker,
  source: HTMLCanvasElement,
) {
  const dateCrop = cropCanvas(
    source,
    { left: 0.08, top: 0.04, width: 0.84, height: 0.44 },
    1.15,
  );
  enhanceAcknowledgmentScan(dateCrop);

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    tessedit_char_whitelist:
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ,.-/",
  });
  try {
    const result = await worker.recognize(dateCrop, { rotateAuto: true });
    return result.data.text;
  } finally {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      tessedit_char_whitelist: "",
    });
  }
}

export async function extractLegacyMoaFields(
  file: File,
  worker: Worker,
  onPage?: (current: number, total: number) => void,
): Promise<LegacyMoaOcrResult> {
  const pdf = await loadPdfFromFile(file);
  try {
    const pageTexts: Array<{
      pageNumber: number;
      text: string;
      dateText: string | null;
    }> = [];
    const pageNumbers = [1];
    for (let page = pdf.numPages; page >= 2; page -= 1) {
      pageNumbers.push(page);
    }

    let foundEffectivity = false;
    let foundAcknowledgment = false;
    for (const [index, pageNumber] of pageNumbers.entries()) {
      if (index > 1 && foundEffectivity && foundAcknowledgment) break;
      onPage?.(index + 1, pageNumbers.length);
      const page = await pdf.getPage(pageNumber);
      const isFirstPage = pageNumber === 1;
      const isLastPage = pageNumber === pdf.numPages;
      const viewport = page.getViewport({
        scale: isFirstPage ? 1.4 : isLastPage ? 1.6 : 1.15,
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Could not prepare a canvas for OCR");
      await page.render({ canvasContext: context, viewport }).promise;

      // The final page is the acknowledgment in this template family. A
      // focused sparse-text pass is much faster than OCRing the full page and
      // then OCRing the date area again.
      if (isLastPage && !isFirstPage) {
        const dateText = await recognizeAcknowledgmentDate(
          worker,
          canvas,
        ).catch(() => null);
        pageTexts.push({
          pageNumber,
          text: dateText ?? "",
          dateText,
        });
        foundAcknowledgment = true;
        page.cleanup();
        continue;
      }

      const contentCanvas = cropCanvas(
        canvas,
        isFirstPage
          ? { left: 0.07, top: 0.02, width: 0.88, height: 0.66 }
          : { left: 0.07, top: 0.01, width: 0.88, height: 0.98 },
      );
      const result = await worker.recognize(contentCanvas, {
        rotateAuto: true,
      });
      const text = result.data.text;
      const looksLikeAcknowledgment = hasAcknowledgmentHeading(text);
      let dateText: string | null = null;
      if (looksLikeAcknowledgment) {
        dateText = await recognizeAcknowledgmentDate(worker, canvas).catch(
          () => null,
        );
      }
      pageTexts.push({ pageNumber, text, dateText });
      foundEffectivity ||= hasEffectivityHeading(text);
      foundAcknowledgment ||= looksLikeAcknowledgment;
      page.cleanup();
    }

    const firstPageText =
      pageTexts.find((page) => page.pageNumber === 1)?.text ?? "";
    const acknowledgmentPage =
      pageTexts.find((page) => hasAcknowledgmentHeading(page.text)) ??
      pageTexts.find((page) => page.pageNumber === pdf.numPages);
    const acknowledgmentText = acknowledgmentPage?.text ?? "";
    const acknowledgmentDateText =
      acknowledgmentPage?.dateText || acknowledgmentText;
    const effectivityText = extractEffectivitySection(
      pageTexts.map((page) => page.text),
    );
    const fallbackEffectivityText = pageTexts
      .filter(
        (page) => page.pageNumber !== 1 && page.pageNumber !== pdf.numPages,
      )
      .map((page) => page.text)
      .join("\n");
    const normalizedEffectivity = normalizeBlock(
      effectivityText ?? fallbackEffectivityText,
    );
    const isExplicitlyNonPerpetual = /nonperp/i.test(file.name);
    const startsUponSigning = /take[s]? effect (?:upon|on) signing/i.test(
      normalizedEffectivity,
    );
    const remainsUntilRevoked =
      /(?:shall\s+)?remain in (?:full )?force and effect unless revoke(?:d)?/i.test(
        normalizedEffectivity,
      );
    const hasIndefiniteTerm =
      /remain in (?:full )?force and effect/i.test(normalizedEffectivity) ||
      /unless revoked|until (?:revoked|terminated)/i.test(
        normalizedEffectivity,
      ) ||
      /right to pre-terminate/i.test(normalizedEffectivity);
    const hasPerpetualLanguage =
      remainsUntilRevoked || (startsUponSigning && hasIndefiniteTerm);
    const expiryDate =
      parseExplicitEndDate(normalizedEffectivity) ??
      parseMonthRangeExpiry(normalizedEffectivity);

    return {
      companyName: companyFromText(firstPageText, file.name),
      effectiveDate: parseSigningDate(
        acknowledgmentDateText,
        pageTexts.map((page) => page.text).join("\n"),
      ),
      expiryDate: hasPerpetualLanguage ? null : expiryDate,
      isPerpetual: isExplicitlyNonPerpetual
        ? false
        : hasPerpetualLanguage
          ? true
          : null,
    };
  } finally {
    await pdf.destroy();
  }
}
