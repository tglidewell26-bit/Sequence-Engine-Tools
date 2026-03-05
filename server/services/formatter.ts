import type { SequenceSections } from "@shared/schema";

export function enforceIntroRules(sections: SequenceSections): SequenceSections {
  return sections;
}

const EMAIL_KEYS_WITH_AVAILABILITY = ["email1", "email2", "email3"];

function formatAvailabilityBlock(blockText: string): string {
  const lines = blockText.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";

  const headerLine = lines[0];

  const datePattern = /((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2})/g;
  const formattedHeader = headerLine.replace(datePattern, "<strong>$1</strong>");

  const timeLines = lines.slice(1).filter(l => !/^available\s+times:?$/i.test(l));
  const formattedTimeLines = timeLines.map(l => `<strong>${l}</strong>`);

  const parts = [formattedHeader];
  if (formattedTimeLines.length > 0) {
    parts.push("");
    parts.push(...formattedTimeLines);
  }

  return parts.join("\n");
}

export function injectAvailability(
  sections: SequenceSections,
  availabilityBlock?: string
): SequenceSections {
  if (!availabilityBlock?.trim()) return sections;

  const result = { ...sections };
  const formatted = formatAvailabilityBlock(availabilityBlock);
  if (!formatted) return sections;

  for (const key of EMAIL_KEYS_WITH_AVAILABILITY) {
    const section = result[key];
    if (!section?.body) continue;

    let body = section.body;

    body = body
      .replace(/\{\{availability\}\}/gi, "")
      .replace(/\[availability\]/gi, "")
      .replace(/\{availability\}/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    body = `${body}\n\n${formatted}`;

    result[key] = { ...section, body };
  }

  return result;
}
