import OpenAI from "openai";
import type { Asset, SelectedAssets } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function selectAssets(
  emailBody: string,
  assets: Asset[]
): Promise<SelectedAssets> {
  const images = assets.filter((a) => a.type === "Image");
  const documents = assets.filter((a) => a.type === "Document");

  if (images.length === 0 && documents.length === 0) {
    return { image: "", documents: [], justificationSentence: "" };
  }

  const assetMetadata = assets.map((a) => ({
    file_name: a.fileName,
    instrument: a.instrument,
    type: a.type,
    summary: a.summary || "No summary available",
    keywords: a.keywords || [],
  }));

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are an asset selector for scientific outreach emails at Bruker Spatial Biology.

Given an email body and available assets, select the best matching assets.

Rules:
- Select exactly 1 image (if available)
- Select 1-2 documents (if available)
- Generate 1 concise justification sentence explaining the value of attachments
- Identify: instrument, disease, sample type, pain point, value proposition
- Prefer: publication figures, case studies, high technical credibility
- Return ONLY valid JSON, no prose

Response format:
{
  "image": "file_name.png",
  "documents": ["file1.pdf", "file2.pdf"],
  "justification_sentence": "One concise sentence explaining value."
}`,
        },
        {
          role: "user",
          content: `Email body:\n${emailBody}\n\nAvailable assets:\n${JSON.stringify(assetMetadata, null, 2)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from LLM");

    const parsed = JSON.parse(content);
    return {
      image: parsed.image || (images.length > 0 ? images[0].fileName : ""),
      documents: parsed.documents || (documents.length > 0 ? [documents[0].fileName] : []),
      justificationSentence: parsed.justification_sentence || "Please find the attached materials for your reference.",
    };
  } catch (error) {
    console.error("Asset selection LLM error, falling back to defaults:", error);
    return {
      image: images.length > 0 ? images[0].fileName : "",
      documents: documents.length > 0 ? documents.slice(0, 2).map((d) => d.fileName) : [],
      justificationSentence: "Please find the attached materials for your reference.",
    };
  }
}
