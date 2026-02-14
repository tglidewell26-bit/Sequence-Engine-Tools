import type { SequenceSections } from "@shared/schema";

const SECTION_PATTERNS: { key: string; patterns: RegExp[] }[] = [
  { key: "email1", patterns: [/^email\s*1\b/i, /^e-?mail\s*#?\s*1\b/i] },
  { key: "email2", patterns: [/^email\s*2\b/i, /^e-?mail\s*#?\s*2\b/i] },
  { key: "linkedinConnection", patterns: [/^linkedin\s*connection/i, /^li\s*connection/i] },
  { key: "linkedinMessage", patterns: [/^linkedin\s*message/i, /^li\s*message/i] },
  { key: "email3", patterns: [/^email\s*3\b/i, /^e-?mail\s*#?\s*3\b/i] },
  { key: "email4", patterns: [/^email\s*4\b/i, /^e-?mail\s*#?\s*4\b/i] },
];

const GREETING_PATTERNS = [
  /^hi\s+\{\{first_name\}\}/i,
  /^hello\s+\{\{first_name\}\}/i,
  /^hey\s+\{\{first_name\}\}/i,
  /^dear\s+\{\{first_name\}\}/i,
  /^greetings\s+\{\{first_name\}\}/i,
  /^hi\s+there\s*,?/i,
  /^hello\s+there\s*,?/i,
  /^hey\s+there\s*,?/i,
  /^hi\s*,/i,
  /^hello\s*,/i,
  /^hey\s*,/i,
  /^dear\s+/i,
  /^greetings\s*,?/i,
  /^good\s+(morning|afternoon|evening)\s*,?/i,
];

function matchSection(line: string): string | null {
  const trimmed = line.trim();
  for (const { key, patterns } of SECTION_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) return key;
    }
  }
  return null;
}

function isGreetingLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function extractSubjectAndBody(text: string): { subject: string; body: string } {
  const lines = text.split("\n");
  let subjectLine = "";
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) continue;

    if (/^subject\s*:/i.test(trimmed)) {
      subjectLine = trimmed.replace(/^subject\s*:\s*/i, "").trim();
      bodyStartIndex = i + 1;
      break;
    }

    if (isGreetingLine(trimmed)) {
      bodyStartIndex = i;
      break;
    }

    subjectLine = trimmed;
    bodyStartIndex = i + 1;
    break;
  }

  while (bodyStartIndex < lines.length && lines[bodyStartIndex].trim().length === 0) {
    bodyStartIndex++;
  }

  let body = lines.slice(bodyStartIndex).join("\n").trim();
  if (/^body\s*:/i.test(body)) {
    body = body.replace(/^body\s*:\s*/i, "").trim();
  }

  return { subject: subjectLine, body };
}

export function parseSequence(rawInput: string): SequenceSections {
  const lines = rawInput.split("\n");
  const sectionBlocks: { key: string; startLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const sectionKey = matchSection(lines[i]);
    if (sectionKey) {
      sectionBlocks.push({ key: sectionKey, startLine: i + 1 });
    }
  }

  const sections: SequenceSections = {};

  for (let i = 0; i < sectionBlocks.length; i++) {
    const start = sectionBlocks[i].startLine;
    const end = i + 1 < sectionBlocks.length ? sectionBlocks[i + 1].startLine - 1 : lines.length;
    const sectionText = lines.slice(start, end).join("\n").trim();
    const { subject, body } = extractSubjectAndBody(sectionText);
    sections[sectionBlocks[i].key] = { subject, body };
  }

  if (Object.keys(sections).length === 0) {
    const { subject, body } = extractSubjectAndBody(rawInput.trim());
    sections.email1 = { subject, body };
  }

  return sections;
}

export function detectInstrument(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("geomx")) return "GeoMx";
  if (lower.includes("cosmx")) return "CosMx";
  if (lower.includes("cellscape")) return "CellScape";
  return "GeoMx";
}
