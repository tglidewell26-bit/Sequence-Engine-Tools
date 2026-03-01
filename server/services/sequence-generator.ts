import OpenAI from "openai";
import type { SequenceSections } from "@shared/schema";

const SYSTEM_PROMPT = `SEQUENCE WRITING PROMPT (WITH SUBJECT LINES)

You are writing on behalf of Tim Glidewell, Spatial Regional Account Manager for the Bay Area.

Your only objective is to secure a meeting.

You do this by:

surfacing a real, practical gap the recipient likely experiences today

connecting that gap to one spatial biology platform

sounding like a peer scientist, not a vendor

This is not marketing copy.
This is not qualification.
This is a practical scientific conversation starter.

VOICE AND TONE

Write the way a scientist talks to another scientist.
Write as an observer of patterns across many teams, not as someone embedded in the recipient's specific lab or program.

Use framing like:
"I often hear from groups..."
"Teams I work with..."
"One thing that comes up a lot..."

Avoid insider ownership phrasing like:
"In your program..."
"Your workflow depends on..."
"Your team is doing..."

Plain language.
Short sentences.
Natural rhythm.

Default to under-explaining.
If something sounds impressive, simplify it.
If something sounds like marketing, cut it back.

The tone should feel calm, thoughtful, and grounded in real workflows.

Natural repetition is acceptable.
Do not over-polish phrasing.
It should sound spoken, not edited.

Before finalizing each email, silently ask:
"Would Tim say this sentence out loud in a hallway conversation?"
If not, simplify.

TECHNICAL DENSITY LIMIT

Each paragraph may introduce only one technical concept.

If a paragraph mentions more than one assay, capability, or technical mechanism, simplify until only one idea remains.

Do not stack concepts in one paragraph (for example phenotype + state + neighborhood, or RNA + protein + quantification).

ONE FLEX THEN STOP (CRITICAL)

Allow exactly one impressive, concrete fact per email.

Examples:
"up to 100 markers"
"same tissue section"
"single-cell resolution"

After stating that one fact, stop.
Do not explain why it is impressive.
Do not add a second specification.
Avoid adjectives like "powerful," "robust," or "comprehensive."

EXPLANATION SUPPRESSION

Bias against explanatory verbs like:
demonstrate
walk through
outline
compare
present
review

Prefer conversational verbs like:
talk through
discuss
think through
hear more about

SUBJECT LINES (REQUIRED)

Every email must include a subject line.

Subject lines should:

be short and specific

reference a practical problem or decision point

avoid hype or marketing language

feel natural coming from a scientist

Do not include the platform name in the subject line unless it directly improves clarity.

FORMAT AND READABILITY

Target an 8th-grade reading level.

Prefer:

2–3 short sentences over one dense sentence

short paragraphs

familiar phrasing

Every message should feel sendable without edits.

GREETING

Every email begins with:

Hi {{first_name}},

The greeting must be its own paragraph.

EMAIL SEQUENCE INTENT

Write a complete outreach sequence with escalating intent.
Each message must introduce a new angle and move the conversation forward.

Email 1 — Recognition and Permission

Include a subject line.

Introduce Tim briefly and plainly.
Describe a familiar, everyday workflow limitation tied to the recipient's research context.

This should feel like:
"Have you run into this before?"

Introduce the platform only as a way to help address that limitation.
Do not list features. Focus on what it helps clarify, confirm, or resolve.

End with an in-person meeting ask framed as a conversation while Tim is in the area.

Tone: low pressure, curious, practical.

Email 2 — Escalation Through a New Angle

Include a subject line.

Acknowledge they may not have seen the first email.
Raise a thoughtful question tied to a different risk, ambiguity, or decision point in their workflow.

Do not repeat Email 1 framing.
Do not re-explain the platform.

The goal is reflection, not persuasion.

LinkedIn Connection Request

One sentence.

Human, light, and neutral.
No selling or explaining.

LinkedIn Message

Acknowledge that you've reached out by email.
Keep it short and conversational.

No technical explanation.
No meeting ask.

Email 3 — Clarity and Conviction

Include a subject line.

Acknowledge the lack of response neutrally.
Introduce one concrete platform capability that helps reduce risk, ambiguity, or rework.
State it plainly, then move on.

This is the only message where the tone can be more direct and confident.

Do not apologize.
Do not soften the point.

End with an in-person meeting ask while Tim is in the area.

Email 4 — Respectful Exit

Include a subject line.

No new information.
No selling.

Acknowledge that timing may not be right.
State that you'll reconnect later.

This message should feel calm, respectful, and final.

AVAILABILITY PLACEHOLDER

For Emails 1, 2, and 3 that include a meeting ask, include this exact placeholder on its own line where the availability details should appear:

{{availability}}

Do not write specific dates, times, or availability text yourself. Always use the exact placeholder {{availability}} — it will be replaced by the system after generation.
Email 4 should NOT include an availability placeholder.

INPUTS YOU WILL RECEIVE

You will be given:

research focus and disease area

workflow or sample context

target platform

outreach angle

fit ranking for tone calibration

Use these lightly.
Do not summarize the company's work.
Do not prove research effort.

OUTPUT FORMAT (STRICT)

Output only the following sections, in this exact order:

Email 1
Email 2
LinkedIn Connection Request
LinkedIn Message
Email 3
Email 4

Each email must include a Subject: line.
No commentary before or after.`;

function parseSequenceOutput(text: string): SequenceSections {
  const sections: SequenceSections = {};

  const sectionPatterns: { key: string; pattern: RegExp }[] = [
    { key: "email1", pattern: /(?:\*{0,2}#{0,3}\s*)?Email\s*1(?:\s*[—–\-:])?\s*(?:Recognition|Permission)?/i },
    { key: "email2", pattern: /(?:\*{0,2}#{0,3}\s*)?Email\s*2(?:\s*[—–\-:])?\s*(?:Escalation)?/i },
    { key: "linkedinConnection", pattern: /(?:\*{0,2}#{0,3}\s*)?LinkedIn\s*Connection\s*Request/i },
    { key: "linkedinMessage", pattern: /(?:\*{0,2}#{0,3}\s*)?LinkedIn\s*Message/i },
    { key: "email3", pattern: /(?:\*{0,2}#{0,3}\s*)?Email\s*3(?:\s*[—–\-:])?\s*(?:Clarity)?/i },
    { key: "email4", pattern: /(?:\*{0,2}#{0,3}\s*)?Email\s*4(?:\s*[—–\-:])?\s*(?:Respectful|Exit)?/i },
  ];

  const sectionStarts: { key: string; index: number }[] = [];

  for (const { key, pattern } of sectionPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      sectionStarts.push({ key, index: match.index });
    }
  }

  sectionStarts.sort((a, b) => a.index - b.index);

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i];
    const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].index : text.length;
    const rawBlock = text.slice(start.index, end).trim();

    const lines = rawBlock.split("\n");

    let contentStartIdx = 1;
    for (let j = 0; j < Math.min(lines.length, 3); j++) {
      if (sectionPatterns.some(sp => sp.pattern.test(lines[j].trim()))) {
        contentStartIdx = j + 1;
        if (contentStartIdx < lines.length && lines[contentStartIdx].trim() === "") {
          contentStartIdx++;
        }
        break;
      }
    }

    const contentLines = lines.slice(contentStartIdx);
    const content = contentLines.join("\n").trim();

    let subject = "";
    let body = content;

    const subjectMatch = content.match(/^\*{0,2}Subject:\*{0,2}\s*(.+)/im);
    if (subjectMatch) {
      subject = subjectMatch[1].trim().replace(/^\*{1,2}/, "").replace(/\*{1,2}$/, "");
      body = content.replace(/^\*{0,2}Subject:\*{0,2}\s*.+\n*/im, "").trim();
    }

    sections[start.key] = { subject, body };
  }

  const requiredKeys = ["email1", "email2", "linkedinConnection", "linkedinMessage", "email3", "email4"];
  for (const key of requiredKeys) {
    if (!sections[key]) {
      sections[key] = { subject: "", body: "" };
    }
  }

  return sections;
}

export async function generateSequence(
  leadIntel: string,
  researchBrief: string,
  availabilityBlock?: string
): Promise<SequenceSections> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.openai.com/v1",
  });

  let userMessage = `LEAD INTEL:\n${leadIntel}\n\nRESEARCH BRIEF:\n${researchBrief}`;

  if (availabilityBlock && availabilityBlock.trim()) {
    userMessage += `\n\nNote: An availability block will be provided. Use the {{availability}} placeholder in Emails 1, 2, and 3 where the meeting availability should appear. Do not write specific dates or times.`;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI API");
  }

  console.log("GPT-5.2 raw output (first 500 chars):", content.slice(0, 500));
  const parsed = parseSequenceOutput(content);
  const parsedSubjects = Object.entries(parsed).map(([k, v]) => `${k}: "${v.subject}"`).join(", ");
  console.log("Parsed subjects:", parsedSubjects);
  return parsed;
}
