import OpenAI from "openai";
import type { SequenceSections } from "@shared/schema";

// ============================================================
// STAGE 1: HARD-CODED STRUCTURE & RULES (PRE-AI)
// AI never decides platform, pain, anchor, sequence order,
// allowed content, or compliance — all enforced in code below.
// ============================================================

const ALLOWED_PLATFORMS = ["CosMx", "GeoMx", "CellScape"] as const;
type Platform = (typeof ALLOWED_PLATFORMS)[number];

type SequenceIntent =
  | "recognition"
  | "tension"
  | "humanity"
  | "redundancy"
  | "decision"
  | "release";

const INTENT_BY_SECTION: Record<string, SequenceIntent> = {
  email1: "recognition",
  email2: "tension",
  linkedinConnection: "humanity",
  linkedinMessage: "redundancy",
  email3: "decision",
  email4: "release",
} as const;

interface IntentPermissions {
  mayStatePain: boolean;
  mayAskQuestion: boolean;
  maxQuestions: number;
  mayStateCapability: boolean;
  maxCapabilities: number;
  mayAddConsequence: boolean;
}

const PERMISSION_MATRIX: Record<SequenceIntent, IntentPermissions> = {
  recognition:  { mayStatePain: true,  mayAskQuestion: true,  maxQuestions: 1, mayStateCapability: false, maxCapabilities: 0, mayAddConsequence: false },
  tension:      { mayStatePain: true,  mayAskQuestion: true,  maxQuestions: 1, mayStateCapability: false, maxCapabilities: 0, mayAddConsequence: true },
  humanity:     { mayStatePain: false, mayAskQuestion: false, maxQuestions: 0, mayStateCapability: false, maxCapabilities: 0, mayAddConsequence: false },
  redundancy:   { mayStatePain: false, mayAskQuestion: false, maxQuestions: 0, mayStateCapability: false, maxCapabilities: 0, mayAddConsequence: false },
  decision:     { mayStatePain: false, mayAskQuestion: false, maxQuestions: 0, mayStateCapability: true,  maxCapabilities: 1, mayAddConsequence: true },
  release:      { mayStatePain: false, mayAskQuestion: false, maxQuestions: 0, mayStateCapability: false, maxCapabilities: 0, mayAddConsequence: false },
};

const PRESSURE_VERBS = [
  "should we",
  "would you",
  "can i",
  "are you open",
  "could we",
  "are you interested",
  "would you be open",
  "can we",
];


// Structured content outline — ChatGPT never decides any of these values
interface ContentOutline {
  platform: Platform;
  prospectAnchor: string;   // disease area, modality, or translational goal
  pain: string;             // workflow gap from Perplexity research
  trigger: string;          // recent pressure or trigger from Perplexity research
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
 * Strip hedge words from trigger/pressure text to make it a factual statement.
 */
function toTriggerStatement(text: string): string {
  if (!text) return text;
  let s = text.trim().replace(/^[-•*]\s*/, "");

  s = s.replace(/\bsuggests?\b/gi, "means");
  s = s.replace(/\bsignals?\b/gi, "means");
  s = s.replace(/\bindicates?\b/gi, "means");
  s = s.replace(/\blikely\b/gi, "");
  s = s.replace(/\bpossibly\b/gi, "");
  s = s.replace(/\bprobably\b/gi, "");

  return s.replace(/\s{2,}/g, " ").trim();
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

  const rawTrigger =
    extractSection(researchBrief, "Recent trigger") ||
    extractSection(researchBrief, "trigger / pressure") ||
    "";

  const rawAdvantage =
    extractSection(researchBrief, "Concrete spatial advantage") ||
    extractSection(researchBrief, "Why this instrument") ||
    "";

  // 1. Strip third-party framing and hedge language (pre-AI, hard-coded)
  // 2. Convert to assertive, second-person declarative statements
  const prospectAnchor = sanitizeField(rawAnchor);
  const pain          = toPainStatement(sanitizeField(rawPain));
  const trigger       = toTriggerStatement(sanitizeField(rawTrigger));
  const spatialAdvantage = toCapabilityStatement(sanitizeField(rawAdvantage), platform);

  return { platform, prospectAnchor, pain, trigger, spatialAdvantage };
}

/**
 * STAGE 1: Serialize the content outline into a structured user message for ChatGPT.
 *
 * All structure, sequencing, and constraints are stated here explicitly.
 * The AI prompt itself contains none of these rules.
 */
function buildUserMessage(outline: ContentOutline): string {
  const { platform, prospectAnchor, pain, trigger, spatialAdvantage } = outline;
  const escalationAngle = trigger || spatialAdvantage || pain;

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
Meeting requests are always in-person while Tim is in the area.
Never suggest video calls or phone calls.
Never write specific dates or times — only use {{availability}}.


CONTENT INPUTS

Platform:
${platform}

Prospect research context:
${prospectAnchor}

Pain / gap:
${pain}

Escalation angle:
${escalationAngle}

Concrete capability:
${spatialAdvantage}


EMAIL STRUCTURE

Each email must follow this structure:

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

Tone:
• Curious
• Professional
• Not salesy


EMAIL 2 — FOLLOW UP
Purpose: reframe the problem and reinforce importance.

Rules:
• Acknowledge they may have missed the first email.
• Use ${escalationAngle} to highlight why solving the gap matters now.
• Follow the same four-section structure.


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
• No meeting ask
• No questions
• Calm tone
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

const PROSPECT_ANCHOR_PROMPT = `You are an editor.

Goal: ensure every section stays tightly anchored to the provided prospect context.

Rules:
- Keep the same 6 headers and order exactly.
- Do not add or remove sections.
- Do not add new facts.
- Remove generic filler and keep references specific to the prospect context.
- Preserve placeholders like {{first_name}} and {{availability}} exactly.`;

const TIM_VOICE_REWRITE_PROMPT = `You are editing outreach copy into Tim Glidewell's concise voice.

Rules:
- Keep all existing section headers and overall meaning.
- Keep wording direct, plain, and human.
- Remove fluff and marketing language.
- Do not add new claims, tools, or competitor mentions.
- Preserve placeholders like {{first_name}} and {{availability}} exactly.`;

const SUPPRESSION_REWRITE_PROMPT = `Rewrite the sequence to remove policy/style violations while preserving intent.

Requirements:
- Keep the same 6 section headers and order.
- Keep all placeholders exactly as-is.
- Remove demo language, competitor mentions, and prohibited framing.
- Use neutral, scientific, plain language.`;

function detectViolations(text: string): string[] {
  const found: string[] = [];

  for (const phrase of FORBIDDEN_PHRASES) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      found.push(`Forbidden phrase: "${phrase}"`);
    }
  }

  for (const { label, pattern } of VIOLATION_PATTERNS) {
    if (pattern.test(text)) {
      found.push(label);
    }
  }

  return Array.from(new Set(found));
}

// ============================================================
// INTERNAL REWRITE PASS IMPLEMENTATIONS
// These prompts are intentionally active and used in Stage 3a/3b + suppression.
// ============================================================

async function rewriteWithProspectAnchoring(
  openai: OpenAI,
  sequenceText: string,
  prospectContext: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    temperature: 0,
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: PROSPECT_ANCHOR_PROMPT },
      {
        role: "user",
        content: `Prospect context: ${prospectContext}\n\n${sequenceText}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI during prospect anchor pass");
  }
  return content;
}

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

async function suppressViolations(
  openai: OpenAI,
  sequenceText: string
): Promise<string> {
  const violations = detectViolations(sequenceText);
  if (violations.length === 0) return sequenceText;

  console.log(`[Suppression] Violations detected — auto-rewriting: ${violations.join(", ")}`);

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    temperature: 0,
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: SUPPRESSION_REWRITE_PROMPT },
      { role: "user", content: sequenceText },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI during suppression pass");
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

// ============================================================
// STAGE 4: INTENT ENFORCEMENT (POST-PARSE, DETERMINISTIC)
// Enforces the permission matrix per section. The model never
// decides intent — intent is mapped by section key.
// ============================================================

const PAIN_PATTERNS = [
  /\bcannot\b/i,
  /\bcan't\b/i,
  /\black(?:s|ing)?\b/i,
  /\blimited\s+(?:to|ability|by)\b/i,
  /\bmiss(?:ing|es)?\b/i,
  /\bstruggle\b/i,
  /\bgap\b/i,
  /\bblind\s*spot\b/i,
  /\bunable\s+to\b/i,
  /\bdifficult(?:y|ies)?\b/i,
  /\bwithout\s+(?:knowing|seeing|understanding)\b/i,
];

const CONSEQUENCE_PATTERNS = [
  /\brisk\b/i,
  /\bambiguit(?:y|ies)\b/i,
  /\brework\b/i,
  /\buncertain(?:ty|ties)?\b/i,
  /\bthat\s+matters?\s+because\b/i,
  /\bwhich\s+means?\b/i,
  /\bconsequen(?:ce|tly)\b/i,
  /\bwithout\s+(?:this|that|it)\b/i,
];

const CAPABILITY_PATTERNS = [
  /\bwith\s+(?:CosMx|GeoMx|CellScape)\b/i,
  /\b(?:CosMx|GeoMx|CellScape)\s+(?:can|enables?|allows?|provides?|offers?|lets)\b/i,
  /\byou\s+can\s+(?:see|map|profile|detect|quantify|resolve|identify|visualize|characterize|measure)\b/i,
  /\bsingle[- ]cell\s+(?:resolution|level|spatial)\b/i,
  /\bwhole[- ]transcriptome\b/i,
  /\b(?:up\s+to\s+)?\d+[,+]?\s*(?:markers?|targets?|plex)\b/i,
  /\bspatial\s+(?:profiling|proteomics|transcriptomics|resolution|imaging)\b/i,
  /\bsubcellular\b/i,
  /\bin\s+situ\b/i,
  /\bcyclic\s+(?:mIF|staining)\b/i,
];

function countQuestions(text: string): number {
  const lines = text.split("\n").filter((l) => l.trim());
  let count = 0;
  for (const line of lines) {
    if (line.trim().endsWith("?")) count++;
  }
  return count;
}

function isPainSentence(sentence: string): boolean {
  return PAIN_PATTERNS.some((p) => p.test(sentence));
}

function isConsequenceSentence(sentence: string): boolean {
  return CONSEQUENCE_PATTERNS.some((p) => p.test(sentence));
}

function isCapabilitySentence(sentence: string): boolean {
  return CAPABILITY_PATTERNS.some((p) => p.test(sentence));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isProtectedContent(text: string): boolean {
  const trimmed = text.trim();
  if (/^\s*\{\{availability\}\}\s*$/i.test(trimmed)) return true;
  if (/^Hi\s+\{\{first_name\}\}/i.test(trimmed)) return true;
  if (/^Subject:/i.test(trimmed)) return true;
  if (/^(?:Tim|Best|Thanks|Cheers|Regards)/i.test(trimmed)) return true;
  if (/^Tim\s+Glidewell/i.test(trimmed)) return true;
  return false;
}

function enforceQuestionLimit(body: string, maxQuestions: number, sectionKey: string, intent: string): { body: string; violations: string[] } {
  const violations: string[] = [];
  const sentences = splitSentences(body);
  let questionCount = 0;
  const kept: string[] = [];

  for (const sentence of sentences) {
    if (sentence.trim().endsWith("?")) {
      questionCount++;
      if (maxQuestions > 0 && questionCount <= maxQuestions) {
        kept.push(sentence);
      } else {
        violations.push(`[${sectionKey}/${intent}] Removed excess question: "${sentence.slice(0, 60)}..."`);
      }
    } else {
      kept.push(sentence);
    }
  }

  return { body: kept.join(" "), violations };
}

function enforceIntentForSection(
  sectionKey: string,
  section: { subject: string; body: string }
): { subject: string; body: string; violations: string[] } {
  const intent = INTENT_BY_SECTION[sectionKey];
  if (!intent) return { ...section, violations: [] };

  const perms = PERMISSION_MATRIX[intent];
  const violations: string[] = [];
  let body = section.body;

  const paragraphs = body.split(/\n\n+/);
  const rebuiltParagraphs: string[] = [];

  for (const paragraph of paragraphs) {
    if (isProtectedContent(paragraph)) {
      rebuiltParagraphs.push(paragraph);
      continue;
    }

    const sentences = splitSentences(paragraph);
    const keptSentences: string[] = [];

    for (const sentence of sentences) {
      const isPain = isPainSentence(sentence);
      const isConsequence = isConsequenceSentence(sentence);
      const isCap = isCapabilitySentence(sentence);

      if (!perms.mayStatePain && isPain && !isConsequence && !isCap) {
        violations.push(`[${sectionKey}/${intent}] Removed pain: "${sentence.slice(0, 80)}..."`);
        continue;
      }

      if (!perms.mayStateCapability && isCap) {
        violations.push(`[${sectionKey}/${intent}] Removed capability: "${sentence.slice(0, 80)}..."`);
        continue;
      }

      if (!perms.mayAddConsequence && isConsequence && !isPain && !isCap) {
        violations.push(`[${sectionKey}/${intent}] Removed consequence: "${sentence.slice(0, 80)}..."`);
        continue;
      }

      keptSentences.push(sentence);
    }

    if (keptSentences.length > 0) {
      rebuiltParagraphs.push(keptSentences.join(" "));
    }
  }

  body = rebuiltParagraphs.join("\n\n");

  if (perms.mayAskQuestion && perms.maxQuestions > 0) {
    const qCount = countQuestions(body);
    if (qCount > perms.maxQuestions) {
      const result = enforceQuestionLimit(body, perms.maxQuestions, sectionKey, intent);
      body = result.body;
      violations.push(...result.violations);
    }
  } else if (!perms.mayAskQuestion) {
    const qCount = countQuestions(body);
    if (qCount > 0) {
      const result = enforceQuestionLimit(body, 0, sectionKey, intent);
      body = result.body;
      violations.push(...result.violations);
    }
  }

  if (perms.mayStateCapability && perms.maxCapabilities > 0) {
    const allSentences = splitSentences(body);
    const capSentences = allSentences.filter(isCapabilitySentence);
    if (capSentences.length > perms.maxCapabilities) {
      violations.push(`[${sectionKey}/${intent}] Too many capabilities (${capSentences.length}/${perms.maxCapabilities}) — keeping first`);
      let capKept = 0;
      const rebuilt = allSentences.filter((s) => {
        if (isCapabilitySentence(s)) {
          capKept++;
          return capKept <= perms.maxCapabilities;
        }
        return true;
      });
      body = rebuilt.join(" ");
    }
  }

  if (intent === "release") {
    const releaseSentences = splitSentences(body);
    const cleanedSentences: string[] = [];

    for (const sentence of releaseSentences) {
      if (isProtectedContent(sentence)) {
        cleanedSentences.push(sentence);
        continue;
      }

      let hasPressure = false;
      for (const verb of PRESSURE_VERBS) {
        const regex = new RegExp(`\\b${verb.replace(/\s+/g, "\\s+")}\\b`, "i");
        if (regex.test(sentence)) {
          hasPressure = true;
          violations.push(`[${sectionKey}/release] Removed sentence with pressure verb "${verb}": "${sentence.slice(0, 60)}..."`);
          break;
        }
      }

      if (!hasPressure) {
        cleanedSentences.push(sentence);
      }
    }

    body = cleanedSentences.join(" ");
  }

  return { subject: section.subject, body: body.trim(), violations };
}

function enforceIntentMatrix(
  sections: SequenceSections
): { enforced: SequenceSections; allViolations: string[] } {
  const enforced: SequenceSections = {};
  const allViolations: string[] = [];

  for (const [key, section] of Object.entries(sections)) {
    if (!section) continue;
    const result = enforceIntentForSection(key, section);
    enforced[key] = { subject: result.subject, body: result.body };
    allViolations.push(...result.violations);
  }

  return { enforced, allViolations };
}

// ============================================================
// MAIN ORCHESTRATION — DETERMINISTIC STAGES
//
//   Stage 1: Hard-coded structure & rules (pre-AI)
//            → buildContentOutline() + buildUserMessage()
//
//   Stage 2: Constrained ChatGPT write
//            → CONSTRAINED_WRITER_PROMPT (phrasing only)
//
//   Stage 3: Intent enforcement (post-parse, deterministic)
//            → enforceIntentMatrix() applies permission matrix
//            Pain allowed only in E1/E2, capability only in E3,
//            questions capped, E4 release valve enforced
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

  // ── PARSE ──
  const parsed = parseSequenceOutput(rawContent);
  const parsedSubjects = Object.entries(parsed)
    .map(([k, v]) => `${k}: "${v.subject}"`)
    .join(", ");
  console.log("Parsed subjects:", parsedSubjects);

  // ── STAGE 3: INTENT ENFORCEMENT (deterministic, post-parse) ──
  const { enforced, allViolations } = enforceIntentMatrix(parsed);
  if (allViolations.length > 0) {
    console.log(`[Stage 3] Intent enforcement — ${allViolations.length} violation(s) corrected:`);
    for (const v of allViolations) {
      console.log(`  ${v}`);
    }
  } else {
    console.log("[Stage 3] Intent enforcement — no violations found");
  }

  if (availabilityBlock?.trim()) {
    console.log("[Info] Availability block will be injected by formatter post-parse");
  }

  return enforced;
}
