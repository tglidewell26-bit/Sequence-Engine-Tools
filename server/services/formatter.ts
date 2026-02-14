import type { SequenceSections } from "@shared/schema";

export function enforceIntroRules(sections: SequenceSections): SequenceSections {
  return sections;
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
      const matches = body.match(dateTimePattern);
      if (matches && timeLines.length === 1) {
        if (matches.length > 1) {
          let replaced = false;
          body = body.replace(dateTimePattern, () => {
            if (!replaced) {
              replaced = true;
              return timeLines[0];
            }
            return "";
          });
          body = body.replace(/\n{3,}/g, "\n\n");
        } else {
          body = body.replace(dateTimePattern, timeLines[0]);
        }

        const availHeaderPattern = /I am available on the following dates and times\.?\s*\n/gi;
        body = body.replace(availHeaderPattern, "");
      } else {
        let matchIndex = 0;
        body = body.replace(dateTimePattern, () => {
          const replacement = matchIndex < timeLines.length
            ? timeLines[matchIndex]
            : timeLines[timeLines.length - 1];
          matchIndex++;
          return replacement;
        });
      }
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
