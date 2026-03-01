import OpenAI from "openai";
import type { SequenceSections } from "@shared/schema";

// ============================================================
// STAGE 1: HARD-CODED STRUCTURE & RULES (PRE-AI)
// AI never decides platform, pain, anchor, sequence order,
// allowed content, or compliance — all enforced in code below.
// ============================================================

const ALLOWED_PLATFORMS = ["CosMx", "GeoMx", "CellScape"] as const;
type Platform = (typeof ALLOWED_PLATFORMS)[number];

// Phrases that must never appear in final output — auto-rewritten if detected
const FORBIDDEN_PHRASES = [
  "on your radar",
  "compare notes",
  "decision point",
  "walk through",
  "walkthrough",
  "show you",
  "closing the loop",
] as const;

// Additional pattern-based violations: no demo language, no meeting duration,
// no competitor mentions, no parentheses
const VIOLATION_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Demo language",      pattern: /\bdemo(?:nstrat(?:ion|e))?\b/i },
  { label: "Meeting duration",   pattern: /\b\d+[-\s]?minute(?:s)?\b/i },
  { label: "Meeting duration",   pattern: /\bhalf[-\s]?hour\b/i },
  { label: "Meeting duration",   pattern: /\bquick\s+call\b/i },
  { label: "Competitor mention", pattern: /\b10[xX]\s*[Gg]enomics\b/i },
  { label: "Competitor mention", pattern: /\bVisium\b/i },
  { label: "Competitor mention", pattern: /\bMERFISH\b/i },
  { label: "Competitor mention", pattern: /\bseqFISH\b/i },
  { label: "Competitor mention", pattern: /\bXenium\b/i },
  { label: "Parentheses",        pattern: /\([^)]{1,200}\)/ },
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
    .slice(0, 3)
    .join(" ")
    .trim();
}

/**
 * STAGE 1: Build a deterministic content outline from the Perplexity research output.
 *
 * ChatGPT NEVER decides:
 *   - what the pain is
 *   - what the prospect anchor is
 *   - which angle to use
 *   - which platform to reference
 *
 * It only writes sentences that express these pre-determined points.
 */
function buildContentOutline(
  _leadIntel: string,
  researchBrief: string
): ContentOutline {
  const platform = extractPlatform(researchBrief);

  const prospectAnchor =
    extractSection(researchBrief, "Research focus and disease area") ||
    extractSection(researchBrief, "Research focus") ||
    "their research area";

  const pain =
    extractSection(researchBrief, "Likely pain") ||
    extractSection(researchBrief, "pain / gap") ||
    "workflow gaps in spatial context";

  const trigger =
    extractSection(researchBrief, "Recent trigger") ||
    extractSection(researchBrief, "trigger / pressure") ||
    "";

  const spatialAdvantage =
    extractSection(researchBrief, "Concrete spatial advantage") ||
    extractSection(researchBrief, "Why this instrument") ||
    "";

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

  return `Write a 6-part outreach sequence using this fixed content outline.

Output only these sections in this exact order, with these exact headers:
Email 1
Email 2
LinkedIn Connection Request
LinkedIn Message
Email 3
Email 4

FIXED CONSTRAINTS (enforced — do not deviate):
- Sender identity: Tim Glidewell, Spatial Regional Account Manager, Bruker Spatial Biology
- Platform: ${platform} (mention only ${platform}, no other platforms)
- Every email starts with its own paragraph: Hi {{first_name}},
- Every email has a subject line on its own line formatted exactly as: Subject: [subject text]
- Subject lines must be short and specific — no marketing language, no metaphors, no clever phrasing
- Emails 1, 2, and 3 each include this exact placeholder on its own line: {{availability}}
- Email 4 does NOT include {{availability}}
- Meeting ask is always in-person while Tim is in the area — never a video call or phone call
- Never write specific dates or times — use only the {{availability}} placeholder

EMAIL 1 CONTENT:
- Subject: short and specific, references a practical problem, no marketing language
- Introduce Tim briefly and plainly
- Reference this pain: ${pain}
- Anchor the pain to this prospect context: ${prospectAnchor}
- Reference ${platform} only as a way to address that pain — do not list features
- Close: in-person meeting ask while Tim is in the area, then {{availability}} on its own line

EMAIL 2 CONTENT:
- Subject: different angle from Email 1
- Acknowledge they may not have seen the first email
- Raise this new angle: ${escalationAngle}
- Do not re-explain ${platform}
- Close: {{availability}} on its own line

LINKEDIN CONNECTION REQUEST CONTENT:
- One sentence only
- Human and neutral
- No selling or explaining

LINKEDIN MESSAGE CONTENT:
- Acknowledge reaching out by email
- Short and conversational
- No technical explanation
- No meeting ask

EMAIL 3 CONTENT:
- Subject: short and specific
- Acknowledge lack of response neutrally — no apology
- Introduce this one capability: ${spatialAdvantage || pain}
- More direct and confident tone
- Close: in-person meeting ask while Tim is in the area, then {{availability}} on its own line

EMAIL 4 CONTENT:
- Subject: short and specific
- No new information
- No selling
- Acknowledge timing may not be right
- State Tim will reconnect later
- Calm, respectful, final tone
- No meeting ask
- No {{availability}}`;
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

Write at an 8th-grade reading level.
Use short sentences.
Sound like a peer scientist, not a vendor.
Under-explain rather than over-explain.

Assume the content outline you receive is correct.
Your task is only to turn it into clean, human language.`;

// ============================================================
// STAGE 3a: INTERNAL REWRITE — PROSPECT ANCHOR ENFORCEMENT
// Prevents generic spatial messaging. Ensures Email 1 and Email 2
// anchor the pain to the prospect's specific research context.
// ============================================================

const PROSPECT_ANCHOR_PROMPT = `Rewrite Email 1 and Email 2 so the pain clearly maps to the prospect's specific research context (disease, modality, or translational goal).

If the pain could apply to any lab, rewrite it to anchor it to the provided prospect context.

Do not add facts.
Do not increase specificity beyond what was provided.

Preserve all other sections unchanged.
Output the full rewritten sequence.`;

// ============================================================
// STAGE 3b: INTERNAL REWRITE — TIM VOICE COMPRESSION
// Verbatim prompt — do not modify.
// ============================================================

const TIM_VOICE_REWRITE_PROMPT = `Rewrite the text so it sounds exactly like Tim Glidewell wrote it.

This is a voice compression pass only.

Rules for Tim's voice:
- Prefer questions over statements
- Speak as someone who sees patterns across teams
- Use simple, direct language
- Allow light repetition
- No marketing language
- No metaphors or clever phrasing
- No sales idioms
- One concrete impressive fact per email, then stop
- Remove explanations and stacked features
- Replace arguments with questions
- Be comfortable being blunt
- Admit lack of understanding if present

Constraints:
- Preserve meaning
- Preserve structure
- Preserve platform and context
- Preserve placeholders
- Do not add information
- Do not remove the single strongest capability
- Shorten sentences where possible

If a sentence would not be said out loud in a hallway conversation,
rewrite it.

Output only the rewritten text.`;

// ============================================================
// EXPLICIT SUPPRESSIONS — HARD-CODED
// If forbidden content is detected, auto-rewrite or fail.
// AI is never trusted to self-enforce these rules.
// ============================================================

const SUPPRESSION_REWRITE_PROMPT = `You are performing a targeted cleanup pass on outreach email text.

Rewrite only to fix the specific violations listed below. Do not change anything else.

Violations to remove or rewrite:
- Forbidden phrases (rewrite the sentence naturally without them): "on your radar", "compare notes", "decision point", "walk through", "walkthrough", "show you", "closing the loop"
- Demo language: remove words like "demo", "demonstration", "let me demo", "schedule a demo" — replace with conversational verbs like "talk through" or "discuss"
- Meeting duration language: remove phrases like "30 minutes", "15-minute call", "quick call", "half hour" — do not replace with other durations
- Competitor names: remove entirely, do not replace
- Parentheses: remove parentheses and their contents — integrate any essential meaning into surrounding text without parentheses

Preserve:
- All section headers (Email 1, Email 2, LinkedIn Connection Request, LinkedIn Message, Email 3, Email 4)
- All subject lines
- All placeholders: {{first_name}}, {{availability}}
- All platform references (CosMx, GeoMx, CellScape)
- All structure and order

Output only the cleaned text.`;

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

  return [...new Set(found)];
}

// ============================================================
// INTERNAL REWRITE PASS IMPLEMENTATIONS
// ============================================================

async function rewriteWithProspectAnchoring(
  openai: OpenAI,
  sequenceText: string,
  prospectContext: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    temperature: 0,
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
// MAIN ORCHESTRATION — THREE DETERMINISTIC STAGES
//
//   Stage 1: Hard-coded structure & rules (pre-AI)
//            → buildContentOutline() + buildUserMessage()
//
//   Stage 2: Constrained ChatGPT write
//            → CONSTRAINED_WRITER_PROMPT (phrasing only)
//
//   Stage 3: Two internal rewrite passes
//     3a: Prospect anchor enforcement
//     3b: Tim voice compression
//
//   + Suppression pass: auto-rewrite forbidden phrases if detected
// ============================================================

export async function generateSequence(
  leadIntel: string,
  researchBrief: string,
  availabilityBlock?: string
): Promise<SequenceSections> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.openai.com/v1",
  });

  // ── STAGE 1: Build deterministic content outline (no AI involved) ──
  const outline = buildContentOutline(leadIntel, researchBrief);
  console.log(
    `[Stage 1] Platform: ${outline.platform} | Anchor: ${outline.prospectAnchor.slice(0, 60)}...`
  );
  const userMessage = buildUserMessage(outline);

  // ── STAGE 2: Constrained ChatGPT write (phrasing and language only) ──
  const stage2Response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: CONSTRAINED_WRITER_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const rawContent = stage2Response.choices[0]?.message?.content;
  if (!rawContent) throw new Error("No response from OpenAI API in Stage 2");

  console.log("[Stage 2] Raw output (first 300 chars):", rawContent.slice(0, 300));

  // ── STAGE 3a: Prospect anchor enforcement ──
  const anchoredContent = await rewriteWithProspectAnchoring(
    openai,
    rawContent,
    outline.prospectAnchor
  );
  console.log("[Stage 3a] Prospect anchor pass complete");

  // ── STAGE 3b: Tim voice compression ──
  const compressedContent = await rewriteInTimVoice(openai, anchoredContent);
  console.log("[Stage 3b] Tim voice compression complete");

  // ── SUPPRESSION: Auto-rewrite forbidden phrases if detected ──
  const finalContent = await suppressViolations(openai, compressedContent);

  // ── PARSE & RETURN ──
  const parsed = parseSequenceOutput(finalContent);
  const parsedSubjects = Object.entries(parsed)
    .map(([k, v]) => `${k}: "${v.subject}"`)
    .join(", ");
  console.log("Parsed subjects:", parsedSubjects);

  if (availabilityBlock?.trim()) {
    console.log("[Info] Availability block will be injected by formatter post-parse");
  }

  return parsed;
}
