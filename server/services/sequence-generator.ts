import OpenAI from "openai";
import type { SequenceSections } from "@shared/schema";

// ============================================================
// STAGE 1: HARD-CODED STRUCTURE & RULES (PRE-AI)
// AI never decides platform, pain, anchor, sequence order,
// allowed content, or compliance — all enforced in code below.
// ============================================================

const ALLOWED_PLATFORMS = ["CosMx", "GeoMx", "CellScape"] as const;
type Platform = (typeof ALLOWED_PLATFORMS)[number];

// Structured content outline — ChatGPT never decides any of these values
interface ContentOutline {
  platform: Platform;
  prospectAnchor: string;   // disease area, modality, or translational goal
  pain: string;             // workflow gap from Perplexity research
  spatialAdvantage: string; // concrete spatial capability from Perplexity research
}

/**
 * Extract the recommended platform from the Perplexity research brief.
 * Platform selection is NEVER delegated to the AI.
 * Throws if no valid platform is found.
 */
function extractPlatform(researchBrief: string): Platform {
  const match = researchBrief.match(/Instrument:\s*(CosMx|GeoMx|CellScape)/i);
  if (match) {
    const candidate = match[1] as Platform;
    if (ALLOWED_PLATFORMS.includes(candidate)) return candidate;
  }
  for (const p of ALLOWED_PLATFORMS) {
    if (researchBrief.includes(p)) return p;
  }
  throw new Error(
    `No valid platform found in research brief. Must be one of: ${ALLOWED_PLATFORMS.join(", ")}`
  );
}

/**
 * Extract a section of text from the Perplexity research brief by heading name.
 * Returns up to 3 bullet points merged into a single string.
 */
function extractSection(researchBrief: string, headingFragment: string): string {
  const escaped = headingFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `${escaped}[^\\n]*\\n([\\s\\S]*?)(?=\\n[A-Z][^\\n]{3,}\\n|$)`,
    "i"
  );
  const match = researchBrief.match(regex);
  if (!match) return "";
  return match[1]
    .replace(/^[-•*\s]+/gm, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Strip third-party framing, hedge words, and "I hear / comes up" language
 * from an extracted outline field — BEFORE it reaches the AI.
 *
 * The model must never receive text like "many teams struggle with X" or
 * "something I hear a lot". Those patterns cause dancing. Kill them here.
 */
function sanitizeField(text: string): string {
  if (!text) return text;
  let s = text;

  // Remove "many/other/most teams/groups/labs [verb]"
  s = s.replace(/\b(?:many|other|most)\s+(?:teams?|groups?|labs?)\s+(?:often\s+|typically\s+|commonly\s+)?(?:running|using|do(?:ing)?|face|struggle|lack|tend)\b/gi, "");
  s = s.replace(/\b(?:teams?|groups?|labs?)\s+(?:often|typically|tend\s+to|commonly|usually|face|struggle|lack)\b/gi, "");

  // Remove "something I/we hear [a lot]", "comes up [a lot]", "a question that comes up"
  s = s.replace(/\bsomething\s+(?:i\s+|we\s+)?(?:hear|see)\s+(?:a\s+lot\s+|often\s+|frequently\s+)?(?:is\s+)?/gi, "");
  s = s.replace(/\ba\s+(?:common\s+)?question\s+that\s+comes?\s+up\b/gi, "");
  s = s.replace(/\bcomes?\s+up\s+(?:a\s+lot\s*|often\s*|frequently\s*)(?:is\s+)?/gi, "");

  // Strip standalone hedge words that survive the above
  s = s.replace(/\boften\b/gi, "");
  s = s.replace(/\btypically\b/gi, "");
  s = s.replace(/\bcommonly\b/gi, "");
  s = s.replace(/\btend[s]?\s+to\b/gi, "");

  // Remove leading conjunction artifacts
  s = s.replace(/^[,;]\s*/, "").replace(/^(?:and|but|or)\s+/i, "");

  return s.replace(/\s{2,}/g, " ").trim();
}

/**
 * Convert an extracted pain/gap blurb into a hard, second-person declarative
 * sentence — e.g. "You can measure X, but you cannot see Y."
 *
 * The model receives a statement of fact, not a description of a gap.
 * This eliminates the model's ability to re-frame or soften the pain.
 */
function toPainStatement(text: string): string {
  if (!text) return text;
  let s = text.trim().replace(/^[-•*]\s*/, "");

  // Already second-person
  if (/^you\b/i.test(s)) return s;

  // "Can X but cannot/not Y" — prepend "You"
  if (/^can\b/i.test(s)) return `You ${s[0].toLowerCase()}${s.slice(1)}`;

  // "Cannot / Can't X" — prepend "You"
  if (/^cannot\b|^can't\b/i.test(s)) return `You ${s[0].toLowerCase()}${s.slice(1)}`;

  // "Limited to X" / "Limited ability to X"
  s = s.replace(/^[Ll]imited\s+to\s+/, "You are limited to ");
  s = s.replace(/^[Ll]imited\s+ability\s+to\s+/, "You cannot ");

  // "Rely on X"
  s = s.replace(/^[Rr]el(?:y|ying)\s+on\s+/, "You rely on ");

  // "Lack of X" / "Lacking X"
  s = s.replace(/^[Ll]ack\s+of\s+/, "You lack ");
  s = s.replace(/^[Ll]acking\s+/, "You lack ");

  // "Unable to X"
  s = s.replace(/^[Uu]nable\s+to\s+/, "You cannot ");

  // "Difficulty with/in X"
  s = s.replace(/^[Dd]ifficulty\s+(?:with\s+|in\s+)?/, "You cannot ");

  // "Miss X" / "Missing X"
  s = s.replace(/^[Mm]issing\s+/, "You are missing ");

  // If still no second-person subject, add "You" for capability/limitation verbs
  if (!/^[Yy]ou\b/.test(s)) {
    s = `You ${s[0].toLowerCase()}${s.slice(1)}`;
  }

  // Grammar cleanup for malformed "cannot <verb>ing" patterns
  s = s.replace(/\bcannot\s+([a-z]+)izing\b/gi, "cannot $1ize");
  s = s.replace(/\bcannot\s+([a-z]+)ing\b/gi, "cannot $1");

  return s;
}

/**
 * Convert a spatial advantage blurb into a concrete capability sentence:
 * "With {platform}, you can [specific thing]."
 */
function toCapabilityStatement(text: string, platform: Platform): string {
  if (!text) return text;
  let s = text.trim().replace(/^[-•*]\s*/, "");

  // Already well-formed
  if (/^(?:with\s+|you\s+can\b)/i.test(s)) return s;

  // "Ability to X" → "With {platform}, you can X"
  const abilityMatch = s.match(/^[Aa]bility\s+to\s+(.+)/);
  if (abilityMatch) return `With ${platform}, you can ${abilityMatch[1]}`;

  // Leading action verb — wrap it
  const verbMatch = s.match(/^([Rr]esolve|[Ii]dentify|[Ss]ee|[Mm]ap|[Dd]etect|[Qq]uantify|[Pp]rofile|[Cc]haracterize|[Cc]onfirm|[Tt]rack|[Vv]isualize)\s+(.+)/);
  if (verbMatch) return `With ${platform}, you can ${verbMatch[1].toLowerCase()} ${verbMatch[2]}`;

  // Default: wrap the whole statement
  return `With ${platform}, you can ${s[0].toLowerCase()}${s.slice(1)}`;
}


/**
 * STAGE 1: Build a deterministic content outline from the Perplexity research output.
 *
 * All fields are converted to hard, assertive, second-person factual statements
 * before the AI sees them. The AI receives statements, not topics.
 *
 * ChatGPT NEVER decides:
 *   - what the pain is
 *   - what the prospect anchor is
 *   - which angle to use
 *   - which platform to reference
 */
function buildContentOutline(researchBrief: string): ContentOutline {
  const platform = extractPlatform(researchBrief);

  // Extract raw text from Perplexity sections
  const rawAnchor =
    extractSection(researchBrief, "Research focus and disease area") ||
    extractSection(researchBrief, "Research focus") ||
    "their research area";

  const rawPain =
    extractSection(researchBrief, "Likely pain") ||
    extractSection(researchBrief, "pain / gap") ||
    "cannot see the spatial organization of immune cells in tissue";


  const rawAdvantage =
    extractSection(researchBrief, "Concrete spatial advantage") ||
    extractSection(researchBrief, "Why this instrument") ||
    "";

  // 1. Strip third-party framing and hedge language (pre-AI, hard-coded)
  // 2. Convert to assertive, second-person declarative statements
  const prospectAnchor = sanitizeField(rawAnchor);
  const pain          = toPainStatement(sanitizeField(rawPain));
  const spatialAdvantage = toCapabilityStatement(sanitizeField(rawAdvantage), platform);

  return { platform, prospectAnchor, pain, spatialAdvantage };
}

/**
 * STAGE 1: Serialize the content outline into a structured user message for ChatGPT.
 *
 * All structure, sequencing, and constraints are stated here explicitly.
 * The AI prompt itself contains none of these rules.
 */
function buildUserMessage(outline: ContentOutline): string {
  const { platform, prospectAnchor, pain, spatialAdvantage } = outline;

  return `Write a 6-part outreach sequence using the structure below.

Output only these sections in this exact order with these exact headers:

Email 1
Email 2
LinkedIn Connection Request
LinkedIn Message
Email 3
Email 4


GENERAL RULES

Sender identity:
Tim Glidewell
Spatial Regional Account Manager
Bruker Spatial Biology

Platform constraint:
Only reference ${platform}. Never reference any other spatial platform.

Formatting rules:
• Every email begins with its own paragraph: Hi {{first_name}},
• Every email includes a subject line on its own line formatted exactly:
Subject: [short subject]

Subject line rules:
• Short and specific
• No marketing language
• No metaphors or clever phrasing
• Should reference a practical scientific or workflow issue

Availability rules:
Emails 1, 2, and 3 must include this placeholder on its own line:

{{availability}}

Email 4 must NOT include {{availability}}.

Meeting rules:
For Emails 1, 2, and 3, meeting requests are in-person while Tim is in the area.
Email 4 may also offer a virtual call option.
Never write specific dates or times — only use {{availability}} for Emails 1-3.


CONTENT INPUTS

Platform:
${platform}

Prospect research context:
${prospectAnchor}

Pain / gap:
${pain}


Concrete capability:
${spatialAdvantage}

Source mapping from the research brief (use these as source material, not copy/paste text):
• For research context in Emails 1–3: primarily use "Research focus and disease area", with optional supporting context from "Workflow or sample context".
• For pain point in Emails 1–3: primarily use "Likely pain / gap to reference", with optional supporting context from "Workflow or sample context".
• For platform value in Emails 1–3: use "Why this instrument" and "Concrete spatial advantage to feed into ChatGPT".


EMAIL STRUCTURE

Emails 1, 2, and 3 must all use the same four-part structure below:

SECTION 1 — RESEARCH CONTEXT  
Two sentences.
• Reference the company’s research naturally.
• Show familiarity with their work without copying language from their website.
• Mention the biological area or study context.

SECTION 2 — PAIN POINT  
Two sentences.
• Clearly describe the scientific or workflow gap using ${pain}.
• Frame it as a common challenge in this type of research.

SECTION 3 — PLATFORM VALUE  
Two sentences.
• Explain how ${platform} addresses this problem.
• Use the concept in ${spatialAdvantage}.
• Keep the explanation concrete and scientific.

SECTION 4 — CALL TO ACTION  
Two sentences.
• Ask for a short in-person meeting while Tim is in the area.
• Immediately place {{availability}} on its own line.


EMAIL 1 — INTRODUCTION
Purpose: introduce Bruker Spatial Biology and establish relevance.

Do NOT write any self-introduction line (e.g. "My name is Tim Glidewell…" or "I'm Tim Glidewell…"). The introduction is injected automatically after the greeting. Start the body with the research context section immediately after "Hi {{first_name}},".

Do NOT write any attachment reference sentence. Attachments are handled automatically.

Tone:
• Curious
• Professional
• Not salesy


EMAIL 2 — FOLLOW UP
Purpose: reframe the problem and reinforce importance.

Rules:
• Acknowledge they may have missed the first email.
• Reinforce why solving this gap matters now.
• Follow the same four-section structure.
• Do NOT write any attachment reference sentence. Attachments are handled automatically.


LINKEDIN CONNECTION REQUEST

Rules:
• One sentence only
• Human and neutral
• No selling
• No technical explanation
• No questions


LINKEDIN MESSAGE

Rules:
• Mention you reached out by email
• Conversational tone
• No pain explanation
• No platform explanation
• No meeting ask
• No questions


EMAIL 3 — DIRECT VALUE

Purpose:
Show one clear capability of ${platform}.

Rules:
• Acknowledge lack of response neutrally
• Use ${spatialAdvantage} as the single capability
• More confident tone
• Follow the same four-section structure
• Do NOT ask any questions


EMAIL 4 — RELEASE

Purpose:
Graceful disengagement.

Rules:
• Short email
• No new information
• No platform explanation
• Keep tone hopeful, not final
• Explicitly acknowledge now may not be a good time
• Say you will follow up in a few months
• Offer either an in-person meeting while in the area OR a virtual call
• No questions
• Do not include {{availability}}`;
}

// ============================================================
// STAGE 2: CONSTRAINED CHATGPT WRITER PROMPT (MINIMAL)
// AI role: phrasing, sentence construction, natural language flow.
// AI does NOT decide: structure, compliance, sequencing,
// allowed content, platform selection, or meeting framing.
// ============================================================

const CONSTRAINED_WRITER_PROMPT = `You are writing short, natural outreach emails on behalf of Tim Glidewell.

Your job is to phrase ideas clearly and conversationally.

All structure, rules, sequencing, and constraints are enforced elsewhere.
Do not invent facts.
Do not introduce new ideas.
Do not add explanations beyond what is provided.
Do not introduce framing sentences. Do not contextualize the problem. Write the statements you are given as plainly as possible.

Write at an 8th-grade reading level.
Use short sentences.
Sound like a peer scientist, not a vendor.
Under-explain rather than over-explain.

Assume the content outline you receive is correct.
Your task is only to turn it into clean, human language.`;

const TIM_VOICE_REWRITE_PROMPT = `You are editing outreach copy into Tim Glidewell's concise voice.

Rules:
- Keep all existing section headers and overall meaning.
- Keep wording direct, plain, and human.
- Remove fluff and marketing language.
- Do not add new claims, tools, or competitor mentions.
- Preserve placeholders like {{first_name}} and {{availability}} exactly.`;

const EMAIL1_REQUIRED_INTRO_LINE = "My name is Tim Glidewell, and I am your Spatial Regional Account Manager for Bruker Spatial Biology. It's nice to e-meet you.";

const EMAIL4_REQUIRED_BODY = `Hi {{first_name}},

It sounds like now may not be the right time, and that is completely okay.

I will follow up in a few months.

If you would still like to meet while I am in the area, I am happy to meet in person, or we can schedule a virtual call anytime.

Best,
Tim Glidewell
Spatial Regional Account Manager
Bruker Spatial Biology`;

const EMAIL4_REQUIRED_SUBJECT = "Checking in again in a few months";

// ============================================================
// INTERNAL REWRITE PASS IMPLEMENTATIONS
// These prompts are intentionally active and used in Stage 3a/3b + suppression.
// ============================================================

async function rewriteInTimVoice(
  openai: OpenAI,
  sequenceText: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    temperature: 0,
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: TIM_VOICE_REWRITE_PROMPT },
      { role: "user", content: sequenceText },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI during Tim voice compression");
  }
  return content;
}

// ============================================================
// SEQUENCE PARSER (unchanged)
// ============================================================

function parseSequenceOutput(text: string): SequenceSections {
  const sections: SequenceSections = {};

  const sectionPatterns: { key: string; pattern: RegExp }[] = [
    { key: "email1",            pattern: /(?:\*{0,2}#{0,3}\s*)?Email\s*1(?:\s*[—–\-:])?\s*(?:Recognition|Permission)?/i },
    { key: "email2",            pattern: /(?:\*{0,2}#{0,3}\s*)?Email\s*2(?:\s*[—–\-:])?\s*(?:Escalation)?/i },
    { key: "linkedinConnection", pattern: /(?:\*{0,2}#{0,3}\s*)?LinkedIn\s*Connection\s*Request/i },
    { key: "linkedinMessage",   pattern: /(?:\*{0,2}#{0,3}\s*)?LinkedIn\s*Message/i },
    { key: "email3",            pattern: /(?:\*{0,2}#{0,3}\s*)?Email\s*3(?:\s*[—–\-:])?\s*(?:Clarity)?/i },
    { key: "email4",            pattern: /(?:\*{0,2}#{0,3}\s*)?Email\s*4(?:\s*[—–\-:])?\s*(?:Respectful|Exit)?/i },
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
      if (sectionPatterns.some((sp) => sp.pattern.test(lines[j].trim()))) {
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

function removeTriggerLanguageFromEmails123(sections: SequenceSections): SequenceSections {
  const keys: Array<"email1" | "email2" | "email3"> = ["email1", "email2", "email3"];
  const triggerPattern = /\b(?:astellas|collaboration|hiring|upfront|funding|payment|announced|\$\d|\d+\s*million)\b/i;

  const next: SequenceSections = { ...sections };

  for (const key of keys) {
    const section = next[key];
    if (!section?.body) continue;

    const paragraphs = section.body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const cleaned = paragraphs.filter((p) => {
      if (/^Hi\s+\{\{first_name\}\},?$/i.test(p)) return true;
      if (/^\{\{availability\}\}$/i.test(p)) return true;
      if (/^(?:Best|Thanks|Regards|Cheers),?$/i.test(p)) return true;
      if (/^Tim\s+Glidewell$/i.test(p)) return true;
      if (/^Spatial\s+Regional\s+Account\s+Manager$/i.test(p)) return true;
      if (/^Bruker\s+Spatial\s+Biology$/i.test(p)) return true;
      return !triggerPattern.test(p);
    });

    next[key] = {
      ...section,
      body: cleaned.join("\n\n").trim(),
    };
  }

  return next;
}

function checkEmails123Structure(sections: SequenceSections): string[] {
  const issues: string[] = [];
  const keys: Array<"email1" | "email2" | "email3"> = ["email1", "email2", "email3"];

  const dropLines = [
    /^Hi\s+\{\{first_name\}\},?$/i,
    /^\{\{availability\}\}$/i,
    /^Best,?$/i,
    /^Thanks,?$/i,
    /^Regards,?$/i,
    /^Cheers,?$/i,
    /^Tim\s+Glidewell$/i,
    /^Spatial\s+Regional\s+Account\s+Manager$/i,
    /^Bruker\s+Spatial\s+Biology$/i,
  ];

  for (const key of keys) {
    const body = (sections[key]?.body || "").trim();
    if (!body) {
      issues.push(`[${key}] body is empty`);
      continue;
    }

    const paragraphs = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !dropLines.some((rx) => rx.test(p)));

    if (contentParagraphs.length < 4) {
      issues.push(`[${key}] expected 4 core content paragraphs (research, pain, value, CTA) but found ${contentParagraphs.length}`);
    }
  }

  return issues;
}


function isIntroParagraph(paragraph: string): boolean {
  const p = paragraph.trim();
  if (p === EMAIL1_REQUIRED_INTRO_LINE) return true;
  const lower = p.toLowerCase().replace(/[\u2018\u2019\u0060]/g, "'");
  const hasTimName = /\btim\s+glidewell\b/i.test(lower);
  const hasRole = /account\s+manager|spatial\s+biology|bruker\s+spatial|e-meet|nice\s+to\s+meet/i.test(lower);
  if (hasTimName && hasRole) return true;
  if (/^(?:my name is|i'm|i am)\s+tim\s+glidewell/i.test(lower)) return true;
  return false;
}

function isAttachmentReferenceLine(line: string): boolean {
  const lower = line.trim().toLowerCase();
  if (/attach.*document/i.test(lower)) return true;
  if (/pdf\s+summary\s+unavailable/i.test(lower)) return true;
  return false;
}

function stripAttachmentReferences(sections: SequenceSections): SequenceSections {
  const result = { ...sections };
  for (const key of Object.keys(result)) {
    const section = result[key];
    if (!section?.body) continue;
    const paragraphs = section.body.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
    const cleaned = paragraphs.filter((p: string) => !isAttachmentReferenceLine(p));
    if (cleaned.length !== paragraphs.length) {
      result[key] = { ...section, body: cleaned.join("\n\n") };
    }
  }
  return result;
}

function enforceEmail1IntroLine(sections: SequenceSections): SequenceSections {
  const email1 = sections.email1;
  if (!email1) return sections;

  const requiredLine = EMAIL1_REQUIRED_INTRO_LINE;
  const body = (email1.body || "").trim();

  const paragraphs = body.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
  const cleaned = paragraphs.filter((p: string) => !isIntroParagraph(p));

  const greetingIdx = cleaned.findIndex((p: string) => /^hi\s+\{\{first_name\}\}/i.test(p.trim()));

  let rebuilt: string;
  if (greetingIdx >= 0) {
    const before = cleaned.slice(0, greetingIdx + 1);
    const after = cleaned.slice(greetingIdx + 1);
    rebuilt = [...before, requiredLine, ...after].join("\n\n");
  } else {
    rebuilt = ["Hi {{first_name}},", requiredLine, ...cleaned].join("\n\n");
  }

  return {
    ...sections,
    email1: {
      ...email1,
      body: rebuilt,
    },
  };
}

function enforceEmail4HopefulClose(sections: SequenceSections): SequenceSections {
  const email4 = sections.email4;
  if (!email4) return sections;

  return {
    ...sections,
    email4: {
      ...email4,
      subject: EMAIL4_REQUIRED_SUBJECT,
      body: EMAIL4_REQUIRED_BODY,
    },
  };
}

// ============================================================
// MAIN ORCHESTRATION — THREE STAGES
//
//   Stage 1: Hard-coded structure & rules (pre-AI)
//            → buildContentOutline() + buildUserMessage()
//
//   Stage 2: Constrained ChatGPT write
//            → CONSTRAINED_WRITER_PROMPT (phrasing only)
//
//   Stage 3: Tim voice compression pass
// ============================================================

export async function generateSequence(
  researchBrief: string,
  availabilityBlock?: string
): Promise<SequenceSections> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.openai.com/v1",
  });

  // ── STAGE 1: Build deterministic content outline (no AI involved) ──
  const outline = buildContentOutline(researchBrief);
  console.log(
    `[Stage 1] Platform: ${outline.platform} | Anchor: ${outline.prospectAnchor.slice(0, 60)}...`
  );
  const userMessage = buildUserMessage(outline);

  // ── STAGE 2: Constrained ChatGPT write (phrasing and language only) ──
  const stage2Response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: CONSTRAINED_WRITER_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const rawContent = stage2Response.choices[0]?.message?.content;
  if (!rawContent) throw new Error("No response from OpenAI API in Stage 2");

  console.log("[Stage 2] Raw output (first 300 chars):", rawContent.slice(0, 300));

  // ── STAGE 3: Tim voice compression ──
  const compressedContent = await rewriteInTimVoice(openai, rawContent);
  console.log("[Stage 3] Tim voice compression complete");

  // ── PARSE ──
  const parsed = parseSequenceOutput(compressedContent);
  const parsedSubjects = Object.entries(parsed)
    .map(([k, v]) => `${k}: "${v.subject}"`)
    .join(", ");
  console.log("Parsed subjects:", parsedSubjects);

  const triggerCleaned = removeTriggerLanguageFromEmails123(parsed);

  const structureIssues = checkEmails123Structure(triggerCleaned);
  if (structureIssues.length > 0) {
    console.log(`[Structure check] Found ${structureIssues.length} issue(s):`);
    for (const issue of structureIssues) console.log(`  ${issue}`);
  } else {
    console.log("[Structure check] Emails 1-3 follow expected four-part format");
  }

  const withNoAttachRefs = stripAttachmentReferences(triggerCleaned);
  const withRequiredEmail1Intro = enforceEmail1IntroLine(withNoAttachRefs);
  const withHopefulEmail4 = enforceEmail4HopefulClose(withRequiredEmail1Intro);

  if (availabilityBlock?.trim()) {
    console.log("[Info] Availability block will be injected by formatter post-parse");
  }

  return withHopefulEmail4;
}
