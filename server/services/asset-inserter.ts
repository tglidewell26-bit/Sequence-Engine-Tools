import type { SequenceSections, SelectedAssets } from "@shared/schema";

export function insertAssetsIntoEmail1(
  sections: SequenceSections,
  selectedAssets: SelectedAssets | null
): SequenceSections {
  if (!selectedAssets || !sections.email1) return sections;

  const result = { ...sections };
  let body = result.email1.body;

  if (selectedAssets.image) {
    const paragraphs = body.split("\n\n");
    let insertIndex = 1;

    for (let i = 0; i < paragraphs.length; i++) {
      const lower = paragraphs[i].toLowerCase();
      if (
        lower.includes("geomx") ||
        lower.includes("cosmx") ||
        lower.includes("cellscape") ||
        lower.includes("spatial")
      ) {
        insertIndex = i + 1;
        break;
      }
    }

    const imageBlock = `\nExample of spatial profiling capabilities:\n[Insert Image: ${selectedAssets.image}]\n`;
    paragraphs.splice(insertIndex, 0, imageBlock);
    body = paragraphs.join("\n\n");
  }

  if (selectedAssets.documents.length > 0 || selectedAssets.justificationSentence) {
    const lines = body.split("\n");
    let ctaIndex = lines.length;

    for (let i = lines.length - 1; i >= 0; i--) {
      const lower = lines[i].toLowerCase().trim();
      if (
        lower.includes("best regards") ||
        lower.includes("warm regards") ||
        lower.includes("sincerely") ||
        lower.includes("thank you") ||
        lower.includes("thanks") ||
        lower.includes("looking forward") ||
        lower.includes("let me know")
      ) {
        ctaIndex = i;
        break;
      }
    }

    const attachBlock: string[] = [];
    if (selectedAssets.justificationSentence) {
      attachBlock.push("", selectedAssets.justificationSentence);
    }
    if (selectedAssets.documents.length > 0) {
      attachBlock.push("", "Attachments:");
      for (const doc of selectedAssets.documents) {
        attachBlock.push(doc);
      }
    }
    attachBlock.push("");

    lines.splice(ctaIndex, 0, ...attachBlock);
    body = lines.join("\n");
  }

  result.email1 = { ...result.email1, body };
  return result;
}
