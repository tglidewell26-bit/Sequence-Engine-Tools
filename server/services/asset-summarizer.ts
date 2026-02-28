const MAX_SUMMARY_LENGTH = 320;

const DOMAIN_KEYWORDS = [
  "spatial biology",
  "transcriptomics",
  "proteomics",
  "single cell",
  "ffpe",
  "tumor microenvironment",
  "biomarker",
  "immunology",
  "oncology",
  "neuroscience",
  "high plex",
  "subcellular",
  "rna",
  "protein",
  "imaging",
  "pathology",
  "workflow",
  "validation",
  "clinical",
  "assay",
  "geoMx",
  "cosMx",
  "cellScape",
];

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20);
}

function buildSummary(text: string): string {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return "Summary unavailable.";

  const sentences = splitSentences(cleaned);
  const base = sentences.slice(0, 2).join(" ") || cleaned.slice(0, MAX_SUMMARY_LENGTH);
  const trimmed = base.length > MAX_SUMMARY_LENGTH ? `${base.slice(0, MAX_SUMMARY_LENGTH - 1)}…` : base;

  return trimmed;
}

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();

  const matchedDomainKeywords = DOMAIN_KEYWORDS.filter((keyword) =>
    lower.includes(keyword.toLowerCase())
  );

  const tokens = lower
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);

  const stopWords = new Set([
    "with", "from", "that", "this", "were", "have", "using", "into", "through", "their", "these",
    "study", "data", "analysis", "results", "method", "methods", "sample", "samples", "human", "mouse",
    "figure", "table", "supplementary", "background", "conclusion", "introduction",
  ]);

  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (stopWords.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const frequencyKeywords = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([token]) => token);

  const combined = Array.from(new Set([...matchedDomainKeywords, ...frequencyKeywords]));
  return combined.slice(0, 10);
}

export async function summarizePdf(
  pdfText: string,
  _fileName: string
): Promise<{ summary: string; keywords: string[] }> {
  const truncatedText = pdfText.slice(0, 12000);

  return {
    summary: buildSummary(truncatedText),
    keywords: extractKeywords(truncatedText),
  };
}
