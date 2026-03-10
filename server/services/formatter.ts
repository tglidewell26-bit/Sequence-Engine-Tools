import type { SequenceSections } from "@shared/schema";

export function enforceIntroRules(sections: SequenceSections): SequenceSections {
  return sections;
}

const EMAIL_KEYS_WITH_AVAILABILITY = ["email1", "email2", "email3"];

function stripCoreEmailFraming(text: string): string {
  return text
    .replace(/\bthe\s+company\b/gi, "the lab")
    .replace(/\bcompany'?s\b/gi, "lab's")
    .replace(/\btheir\s+company\b/gi, "their lab");
}

function applyLabNameToBody(body: string, labName: string): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const transformed = paragraphs.map((paragraph) => {
    if (/^Hi\s+\{\{first_name\}\},?$/i.test(paragraph)) return paragraph;

    const normalized = stripCoreEmailFraming(paragraph);

    if (/\blab\b/i.test(normalized)) {
      return normalized;
    }

    if (/\bwork\b|\bresearch\b|\bprogram\b/i.test(normalized)) {
      return normalized.replace(/\b(your|you)\b/gi, `${labName}`);
    }

    return normalized;
  });

  return transformed.join("\n\n");
}

export function convertToProfessorLabTargeting(
  sections: SequenceSections,
  labName: string,
): SequenceSections {
  if (!labName.trim()) return sections;

  const result = { ...sections };

  for (const [key, section] of Object.entries(result)) {
    if (!section?.body) continue;
    result[key] = {
      ...section,
      body: applyLabNameToBody(section.body, labName),
    };
  }

  return result;
}

export function injectCTALine(
  sections: SequenceSections,
  instrument: string,
  targetType: "company" | "professor" = "company",
): SequenceSections {
  const result = { ...sections };

  const defaultCta = `I would love to stop by and discuss how the ${instrument} can fit into your research.`;

  const ctaByEmail: Record<string, string> = targetType === "professor"
    ? {
      email1: defaultCta,
      email2: `I know that not every lab has the space, budget, or need for capital equipment in your lab. I can provide options for accessing this technology without committing to purchasing the instrument. If the technology sounds interesting, but you would need to outsource it, I would still love to meet and discuss its value to your work. Are you available to meet at the following times?`,
      email3: `As I said in my previous email, you may not have the lab space, budget, or need for capital equipment in your lab. I can provide options for accessing this technology without committing to purchasing the instrument. Are you available to meet at the following times?`,
    }
    : {
      email1: defaultCta,
      email2: defaultCta,
      email3: defaultCta,
    };

  for (const key of EMAIL_KEYS_WITH_AVAILABILITY) {
    const section = result[key];
    if (!section?.body) continue;
    const ctaLine = ctaByEmail[key] ?? defaultCta;
    result[key] = { ...section, body: `${section.body.trim()}\n\n${ctaLine}` };
  }

  return result;
}

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
