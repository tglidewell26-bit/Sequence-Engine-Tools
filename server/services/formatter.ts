import type { SequenceSections } from "@shared/schema";

const INTRO_LINE_1 = "Hello {{first_name}},";
const INTRO_LINE_2 =
  "My name is Tim Glidewell, and I'm the Spatial Regional Account Manager at Bruker Spatial Biology.";

const LINKEDIN_INTRO = "Hi {{first_name}},";

const GREETING_PATTERNS = [
  /^hi\s+\{\{first_name\}\}\s*,?/i,
  /^hello\s+\{\{first_name\}\}\s*,?/i,
  /^hey\s+\{\{first_name\}\}\s*,?/i,
  /^dear\s+\{\{first_name\}\}\s*,?/i,
  /^greetings\s+\{\{first_name\}\}\s*,?/i,
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

const TIM_INTRO_PATTERN = /my name is tim glidewell/i;

function isGreetingLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function isTimIntroLine(line: string): boolean {
  return TIM_INTRO_PATTERN.test(line.trim());
}

function stripGreetingsAndIntro(body: string): string {
  const lines = body.split("\n");
  const filtered: string[] = [];
  let foundContent = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!foundContent) {
      if (isGreetingLine(trimmed) || isTimIntroLine(trimmed) || trimmed.length === 0) {
        continue;
      }
      foundContent = true;
    }

    if (foundContent && isTimIntroLine(trimmed)) {
      continue;
    }

    if (foundContent && isGreetingLine(trimmed)) {
      continue;
    }

    filtered.push(line);
  }

  return filtered.join("\n").trim();
}

export function enforceIntroRules(sections: SequenceSections): SequenceSections {
  const emailKeys = ["email1", "email2", "email3", "email4"];
  const linkedinKeys = ["linkedinConnection", "linkedinMessage"];
  const result = { ...sections };

  for (const key of emailKeys) {
    if (!result[key]) continue;
    const cleanedBody = stripGreetingsAndIntro(result[key].body);
    result[key] = {
      ...result[key],
      body: [INTRO_LINE_1, INTRO_LINE_2, "", cleanedBody].join("\n"),
    };
  }

  for (const key of linkedinKeys) {
    if (!result[key]) continue;
    const cleanedBody = stripGreetingsAndIntro(result[key].body);
    result[key] = {
      ...result[key],
      body: [LINKEDIN_INTRO, "", cleanedBody].join("\n"),
    };
  }

  return result;
}

export function injectAvailability(
  sections: SequenceSections,
  availabilityWindow?: string,
  timeRanges?: string
): SequenceSections {
  if (!availabilityWindow && !timeRanges) return sections;

  const lines: string[] = [];

  if (availabilityWindow && timeRanges) {
    const timeLines = timeRanges.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    lines.push(`I am available ${availabilityWindow}:`);
    lines.push("");
    timeLines.forEach(t => lines.push(`• ${t}`));
    lines.push("");
  } else if (availabilityWindow) {
    lines.push(`I am available ${availabilityWindow}.`);
    lines.push("");
  } else if (timeRanges) {
    const timeLines = timeRanges.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    lines.push("I am available:");
    lines.push("");
    timeLines.forEach(t => lines.push(`• ${t}`));
    lines.push("");
  }

  const dateBlock = lines.join("\n");
  const result = { ...sections };

  for (const key of Object.keys(result)) {
    const body = result[key].body;
    if (body.includes("{{availability}}") || body.includes("[availability]") || body.includes("{availability}")) {
      result[key] = {
        ...result[key],
        body: body
          .replace(/\{\{availability\}\}/gi, dateBlock)
          .replace(/\[availability\]/gi, dateBlock)
          .replace(/\{availability\}/gi, dateBlock),
      };
    }
  }

  return result;
}
