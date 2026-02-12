import OpenAI from "openai";
import type { SequenceSections } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function calculateSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export async function checkRedundancy(sections: SequenceSections): Promise<SequenceSections> {
  const email3 = sections.email3;
  const email4 = sections.email4;

  if (!email3 || !email4) return sections;

  const similarity = calculateSimilarity(email3.body, email4.body);

  if (similarity < 0.7) return sections;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional email rewriter for Bruker Spatial Biology outreach.
Rewrite the following email to have a distinctly different tone while maintaining the same core message and call to action.
Keep the same formatting structure. Return ONLY the rewritten email body text, no JSON wrapper, no explanation.`,
        },
        {
          role: "user",
          content: `Original Email 4 body:\n${email4.body}`,
        },
      ],
    });

    const rewritten = response.choices[0]?.message?.content?.trim();
    if (rewritten) {
      return {
        ...sections,
        email4: { ...email4, body: rewritten },
      };
    }
  } catch (error) {
    console.error("Redundancy check LLM error:", error);
  }

  return sections;
}
