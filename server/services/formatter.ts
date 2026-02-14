import type { SequenceSections } from "@shared/schema";

const INTRO_LINE_1 = "Hello {{first_name}},";
const INTRO_LINE_2 =
  "My name is Tim Glidewell, and I'm the Spatial Regional Account Manager at Bruker Spatial Biology.";

const LINKEDIN_INTRO = "Hi {{first_name}},";

const GREETING_PATTERNS: RegExp[] = [
  /^hi\s+\{\{first_name\}\}\s*[,—\u2014\u2013\-]?\s*/i,
  /^hello\s+\{\{first_name\}\}\s*[,—\u2014\u2013\-]?\s*/i,
  /^hey\s+\{\{first_name\}\}\s*[,—\u2014\u2013\-]?\s*/i,
  /^dear\s+\{\{first_name\}\}\s*[,—\u2014\u2013\-]?\s*/i,
  /^greetings\s+\{\{first_name\}\}\s*[,—\u2014\u2013\-]?\s*/i,
  /^hi\s+there\s*[,—\u2014\u2013\-]?\s*/i,
  /^hello\s+there\s*[,—\u2014\u2013\-]?\s*/i,
  /^hey\s+there\s*[,—\u2014\u2013\-]?\s*/i,
  /^hi\s*[,—\u2014\u2013\-]\s*/i,
  /^hello\s*[,—\u2014\u2013\-]\s*/i,
  /^hey\s*[,—\u2014\u2013\-]\s*/i,
  /^dear\s+\S+\s*[,—\u2014\u2013\-]?\s*/i,
  /^greetings\s*[,—\u2014\u2013\-]?\s*/i,
  /^good\s+(morning|afternoon|evening)\s*[,—\u2014\u2013\-]?\s*/i,
];

const TIM_INTRO_PATTERNS: RegExp[] = [
  /my name is tim glidewell/i,
  /^i'?m tim glidewell/i,
  /^i am tim glidewell/i,
  /tim glidewell.*spatial.*(?:regional|account|manager)/i,
  /spatial.*(?:regional|account|manager).*tim glidewell/i,
  /^nice to e-?meet you\.?$/i,
];

function isGreetingLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function extractAfterGreeting(line: string): string {
  const trimmed = line.trim();
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return trimmed.replace(pattern, "").trim();
    }
  }
  return "";
}

function isTimIntroLine(line: string): boolean {
  const trimmed = line.trim();
  for (const pattern of TIM_INTRO_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function stripGreetingsAndIntro(body: string): { cleaned: string; preservedContent: string } {
  const lines = body.split("\n");
  const filtered: string[] = [];
  let foundContent = false;
  let preservedContent = "";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!foundContent) {
      if (isGreetingLine(trimmed)) {
        const afterGreeting = extractAfterGreeting(trimmed);
        if (afterGreeting.length > 0) {
          preservedContent = afterGreeting;
        }
        continue;
      }
      if (isTimIntroLine(trimmed) || trimmed.length === 0) {
        continue;
      }
      foundContent = true;
    }

    if (isTimIntroLine(trimmed)) {
      continue;
    }

    if (isGreetingLine(trimmed)) {
      continue;
    }

    filtered.push(lines[i]);
  }

  const cleaned = collapseTripleNewlines(filtered.join("\n").trim());
  return { cleaned, preservedContent };
}

function collapseTripleNewlines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n");
}

export function enforceIntroRules(sections: SequenceSections): SequenceSections {
  const emailKeys = ["email1", "email2", "email3", "email4"];
  const linkedinKeys = ["linkedinConnection", "linkedinMessage"];
  const result = { ...sections };

  for (const key of emailKeys) {
    if (!result[key]) continue;
    const { cleaned } = stripGreetingsAndIntro(result[key].body);
    result[key] = {
      ...result[key],
      body: [INTRO_LINE_1, INTRO_LINE_2, "", cleaned].join("\n"),
    };
  }

  for (const key of linkedinKeys) {
    if (!result[key]) continue;
    const { cleaned, preservedContent } = stripGreetingsAndIntro(result[key].body);
    const bodyParts: string[] = [];

    if (preservedContent && cleaned) {
      bodyParts.push(`${LINKEDIN_INTRO} ${preservedContent}`);
      bodyParts.push(cleaned);
    } else if (preservedContent) {
      bodyParts.push(`${LINKEDIN_INTRO} ${preservedContent}`);
    } else if (cleaned) {
      bodyParts.push(LINKEDIN_INTRO);
      bodyParts.push(cleaned);
    } else {
      bodyParts.push(LINKEDIN_INTRO);
    }

    result[key] = {
      ...result[key],
      body: bodyParts.join("\n"),
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

  const result = { ...sections };

  const timeLines = timeRanges
    ? timeRanges.split("\n").map(l => l.trim()).filter(l => l.length > 0)
    : [];

  for (const key of Object.keys(result)) {
    let body = result[key].body;

    if (availabilityWindow) {
      body = body.replace(/\[Dates\]/gi, availabilityWindow);
    }

    if (timeLines.length > 0) {
      const dateTimePattern = /\[Date\]\s*[—–\-]\s*\[Time\]/g;
      let matchIndex = 0;
      body = body.replace(dateTimePattern, () => {
        const replacement = matchIndex < timeLines.length
          ? timeLines[matchIndex]
          : timeLines[timeLines.length - 1];
        matchIndex++;
        return replacement;
      });
    }

    if (availabilityWindow || timeRanges) {
      body = body
        .replace(/\{\{availability\}\}/gi, availabilityWindow || "")
        .replace(/\[availability\]/gi, availabilityWindow || "")
        .replace(/\{availability\}/gi, availabilityWindow || "");
    }

    result[key] = { ...result[key], body };
  }

  return result;
}
