import type { Asset, SelectedAssets } from "@shared/schema";

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;


function isUnavailableSummary(summary?: string | null): boolean {
  if (!summary) return true;
  const normalized = summary.trim().toLowerCase();
  return normalized === "pdf summary unavailable." || normalized === "pdf summary unavailable";
}

function cleanToken(token?: string | null): string {
  return (token || "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\.(?:pdf|png|jpg|jpeg)$/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function inferAttachmentTopic(asset: Asset): string {
  const keyword = (asset.keywords || []).find((k) => k && k.trim().length > 3);
  if (keyword) return cleanToken(keyword.toLowerCase());

  if (!isUnavailableSummary(asset.summary)) {
    const summary = cleanToken((asset.summary || "").toLowerCase());
    if (summary) return summary;
  }

  const fromName = cleanToken(asset.fileName.toLowerCase());
  const tokens = fromName
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .filter((t) => !["case", "study", "publication", "publications", "v", "and"].includes(t))
    .slice(0, 6);

  if (tokens.length > 0) return tokens.join(" ");
  return "spatial biology applications";
}

function buildAttachmentReference(selectedDocAssets: Asset[]): string {
  if (selectedDocAssets.length === 0) return "";

  const uniqueTopics = Array.from(
    new Set(selectedDocAssets.map(inferAttachmentTopic).filter(Boolean))
  );
  const referencePrefix = selectedDocAssets.length > 1 ? "a couple of documents" : "a document";

  if (uniqueTopics.length >= 2) {
    return `I've also attached ${referencePrefix} on ${uniqueTopics[0]} and ${uniqueTopics[1]}.`;
  }

  return `I've also attached ${referencePrefix} on ${uniqueTopics[0] || "spatial biology applications"}.`;
}

function scoreAsset(asset: Asset, emailBody: string, detectedInstrument: string): number {
  let score = 0;
  const lower = emailBody.toLowerCase();
  const assetLower = (asset.summary || "").toLowerCase();
  const keywordsLower = (asset.keywords || []).map(k => k.toLowerCase());

  if (asset.instrument === detectedInstrument) {
    score += 3;
  }

  const diseaseTerms = ["cancer", "tumor", "oncology", "immuno", "fibrosis", "inflammation", "neurodegen", "alzheimer", "parkinson"];
  for (const term of diseaseTerms) {
    if (lower.includes(term) && (assetLower.includes(term) || keywordsLower.some(k => k.includes(term)))) {
      score += 2;
      break;
    }
  }

  const bioAngles = ["transcriptom", "proteom", "spatial", "single-cell", "single cell", "multiplex", "morpholog", "rna", "protein"];
  for (const angle of bioAngles) {
    if (lower.includes(angle) && (assetLower.includes(angle) || keywordsLower.some(k => k.includes(angle)))) {
      score += 2;
      break;
    }
  }

  const techTerms = ["resolution", "sensitivity", "throughput", "plex", "whole slide", "subcellular", "high-plex", "fov"];
  for (const term of techTerms) {
    if (lower.includes(term) && (assetLower.includes(term) || keywordsLower.some(k => k.includes(term)))) {
      score += 1;
      break;
    }
  }

  if (asset.instrument === "MultiPlatform" || asset.instrument === "General") {
    score -= 5;
  }

  return score;
}

export async function selectAssets(
  emailBody: string,
  assets: Asset[],
  detectedInstrument: string = "GeoMx",
  excludeFileNames: string[] = []
): Promise<SelectedAssets> {
  const excluded = new Set(excludeFileNames);
  const images = assets.filter((a) => a.type === "Image" && !excluded.has(a.fileName));
  const documents = assets.filter((a) => a.type === "Document" && !excluded.has(a.fileName));

  if (images.length === 0 && documents.length === 0) {
    return { image: "", documents: [], justificationSentence: "" };
  }

  const scoredImages = images
    .map(a => ({ asset: a, score: scoreAsset(a, emailBody, detectedInstrument) }))
    .sort((a, b) => b.score - a.score);

  const scoredDocs = documents
    .map(a => ({ asset: a, score: scoreAsset(a, emailBody, detectedInstrument) }))
    .filter(a => a.asset.size <= MAX_ATTACHMENT_SIZE)
    .sort((a, b) => b.score - a.score);

  let combinedSize = 0;
  const candidateDocs: Asset[] = [];
  for (const { asset } of scoredDocs) {
    if (candidateDocs.length >= 2) break;
    if (combinedSize + asset.size <= MAX_ATTACHMENT_SIZE) {
      candidateDocs.push(asset);
      combinedSize += asset.size;
    }
  }

  const selectedDocuments = candidateDocs.map(d => d.fileName);
  const attachmentReference = buildAttachmentReference(candidateDocs);

  return {
    image: scoredImages.length > 0 ? scoredImages[0].asset.fileName : "",
    documents: selectedDocuments,
    justificationSentence: "",
    attachmentReference,
  };
}
