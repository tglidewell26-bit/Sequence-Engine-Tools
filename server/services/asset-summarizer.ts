import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function summarizePdf(
  pdfText: string,
  fileName: string
): Promise<{ summary: string; keywords: string[] }> {
  try {
    const truncatedText = pdfText.slice(0, 8000);

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a scientific document summarizer for Bruker Spatial Biology.

Given extracted PDF text, generate:
1. A 2-3 sentence technical summary
2. A list of 5-10 keywords

Return ONLY valid JSON:
{
  "summary": "2-3 sentence technical summary",
  "keywords": ["keyword1", "keyword2", ...]
}

No prose. No commentary.`,
        },
        {
          role: "user",
          content: `File: ${fileName}\n\nExtracted text:\n${truncatedText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from LLM");

    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || "No summary generated.",
      keywords: parsed.keywords || [],
    };
  } catch (error) {
    console.error("PDF summarization error:", error);
    return {
      summary: "Summary unavailable.",
      keywords: [],
    };
  }
}
