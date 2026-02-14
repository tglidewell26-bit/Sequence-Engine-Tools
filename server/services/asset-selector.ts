import OpenAI from "openai";
import type { Asset, SelectedAssets } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

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
  detectedInstrument: string = "GeoMx"
): Promise<SelectedAssets> {
  const images = assets.filter((a) => a.type === "Image");
  const documents = assets.filter((a) => a.type === "Document");

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

  const assetMetadata = [
    ...scoredImages.slice(0, 3).map(s => ({
      file_name: s.asset.fileName,
      instrument: s.asset.instrument,
      type: s.asset.type,
      summary: s.asset.summary || "No summary available",
      keywords: s.asset.keywords || [],
      score: s.score,
    })),
    ...scoredDocs.slice(0, 4).map(s => ({
      file_name: s.asset.fileName,
      instrument: s.asset.instrument,
      type: s.asset.type,
      summary: s.asset.summary || "No summary available",
      keywords: s.asset.keywords || [],
      score: s.score,
    })),
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are an asset selector for scientific outreach emails at Bruker Spatial Biology.

Given an email body, detected instrument, pre-scored assets, select the best matching assets.

Rules:
- Select exactly 1 image (pick the highest-scored image if available)
- Select 1-2 documents (highest-scored, combined size must be under 5MB)
- Generate a contextual justification sentence referencing the biological angle and technical strength shown in the image
  Format: "Below is an example demonstrating [biological angle] at [technical strength]:"
- Generate a brief attachment reference sentence derived from document summaries
  Format: "I've also attached [brief description] which outlines [specific technical value]."
- Never select assets for LinkedIn sections
- Return ONLY valid JSON

Response format:
{
  "image": "file_name.png",
  "documents": ["file1.pdf"],
  "justification_sentence": "Below is an example demonstrating [bio angle] at [tech strength]:",
  "attachment_reference": "I've also attached [desc] which outlines [value]."
}`,
        },
        {
          role: "user",
          content: `Detected instrument: ${detectedInstrument}\n\nEmail body:\n${emailBody}\n\nPre-scored assets:\n${JSON.stringify(assetMetadata, null, 2)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from LLM");

    const parsed = JSON.parse(content);

    const validImage = parsed.image && images.some(i => i.fileName === parsed.image)
      ? parsed.image
      : (scoredImages.length > 0 ? scoredImages[0].asset.fileName : "");

    const validDocs = (parsed.documents || []).filter((d: string) =>
      documents.some(doc => doc.fileName === d)
    );

    return {
      image: validImage,
      documents: validDocs.length > 0 ? validDocs : candidateDocs.map(d => d.fileName),
      justificationSentence: parsed.justification_sentence || parsed.attachment_reference || "",
      attachmentReference: parsed.attachment_reference || "",
    };
  } catch (error) {
    console.error("Asset selection LLM error, falling back to scored defaults:", error);
    return {
      image: scoredImages.length > 0 ? scoredImages[0].asset.fileName : "",
      documents: candidateDocs.map(d => d.fileName),
      justificationSentence: scoredImages.length > 0
        ? `Below is an example demonstrating spatial profiling capabilities with the ${detectedInstrument} platform:`
        : "",
    };
  }
}
