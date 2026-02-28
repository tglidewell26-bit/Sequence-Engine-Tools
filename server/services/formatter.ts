import type { SequenceSections } from "@shared/schema";

export function enforceIntroRules(sections: SequenceSections): SequenceSections {
  return sections;
}

const EMAIL_KEYS_WITH_AVAILABILITY = ["email1", "email2", "email3"];

export function injectAvailability(
  sections: SequenceSections,
  availabilityBlock?: string,
  timeRanges?: string
): SequenceSections {
  if (!availabilityBlock && !timeRanges) return sections;

  const result = { ...sections };

  const blockText = availabilityBlock || "";

  function boldWrap(text: string): string {
    return `<strong>${text}</strong>`;
  }

  for (const key of Object.keys(result)) {
    let body = result[key].body;

    if (blockText) {
      const hasPlaceholder = /\{\{availability\}\}/i.test(body) ||
        /\[availability\]/i.test(body) ||
        /\{availability\}/i.test(body);

      if (hasPlaceholder) {
        body = body
          .replace(/\{\{availability\}\}/gi, boldWrap(blockText))
          .replace(/\[availability\]/gi, boldWrap(blockText))
          .replace(/\{availability\}/gi, boldWrap(blockText));
      } else if (EMAIL_KEYS_WITH_AVAILABILITY.includes(key)) {
        const lines = body.split("\n");
        const lastNonEmpty = lines.map((l, i) => ({ l: l.trim(), i }))
          .filter(x => x.l.length > 0)
          .pop();

        if (lastNonEmpty) {
          lines.splice(lastNonEmpty.i, 0, "", boldWrap(blockText), "");
          body = lines.join("\n").replace(/\n{3,}/g, "\n\n");
        }
      }
    }

    if (availabilityBlock) {
      body = body.replace(/\[Dates\]/gi, boldWrap(availabilityBlock));
    }

    if (timeRanges) {
      const timeLines = timeRanges.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (timeLines.length > 0) {
        const dateTimePattern = /\[Date\]\s*[—–\-]\s*\[Time\]/g;
        const matches = body.match(dateTimePattern);
        if (matches && timeLines.length === 1) {
          if (matches.length > 1) {
            let replaced = false;
            body = body.replace(dateTimePattern, () => {
              if (!replaced) {
                replaced = true;
                return boldWrap(timeLines[0]);
              }
              return "";
            });
            body = body.replace(/\n{3,}/g, "\n\n");
          } else {
            body = body.replace(dateTimePattern, boldWrap(timeLines[0]));
          }

          const availHeaderPattern = /I am available on the following dates and times\.?\s*\n/gi;
          body = body.replace(availHeaderPattern, "");
        } else if (matches) {
          let matchIndex = 0;
          body = body.replace(dateTimePattern, () => {
            const replacement = matchIndex < timeLines.length
              ? timeLines[matchIndex]
              : timeLines[timeLines.length - 1];
            matchIndex++;
            return boldWrap(replacement);
          });
        }
      }
    }

    result[key] = { ...result[key], body };
  }

  return result;
}
