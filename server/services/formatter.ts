import type { SequenceSections } from "@shared/schema";

const INTRO_LINE_1 = "Hello {{first_name}},";
const INTRO_LINE_2 =
  "My name is Tim Glidewell, and I'm the Spatial Regional Account Manager at Bruker Spatial Biology.";

export function enforceIntroRules(sections: SequenceSections): SequenceSections {
  const emailKeys = ["email1", "email2", "email3", "email4"];
  const result = { ...sections };

  for (const key of emailKeys) {
    if (!result[key]) continue;
    const body = result[key].body;
    const lines = body.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    const hasHello = lines[0]?.toLowerCase().startsWith("hello");
    const hasIntro = lines.length > 1 && lines[1].includes("Tim Glidewell");

    if (hasHello && hasIntro) continue;

    const contentLines = lines.filter((l) => {
      const lower = l.toLowerCase();
      return !lower.startsWith("hello") && !l.includes("Tim Glidewell");
    });

    result[key] = {
      ...result[key],
      body: [INTRO_LINE_1, INTRO_LINE_2, "", ...contentLines].join("\n"),
    };
  }

  return result;
}

export function injectDates(sections: SequenceSections, timeSlots: string[]): SequenceSections {
  if (!timeSlots || timeSlots.length === 0) return sections;

  const dateBlock = [
    "I am available:",
    "",
    ...timeSlots.map((slot) => `**[${slot}]**`),
    "",
  ].join("\n");

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
