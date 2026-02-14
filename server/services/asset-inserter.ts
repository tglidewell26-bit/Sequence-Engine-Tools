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

    const isIntroParagraph = (text: string): boolean => {
      const lower = text.toLowerCase();
      return (
        lower.includes("account manager") ||
        lower.includes("nice to meet") ||
        lower.includes("nice to e-meet") ||
        lower.includes("regional manager") ||
        lower.includes("i work with") ||
        /^(hi|hello|hey|dear|greetings)\s/i.test(text.trim())
      );
    };

    const hasInstrumentName = (text: string): boolean => {
      const lower = text.toLowerCase();
      return lower.includes("geomx") || lower.includes("cosmx") || lower.includes("cellscape");
    };

    let lastInstrumentIndex = -1;
    for (let i = 0; i < paragraphs.length; i++) {
      if (isIntroParagraph(paragraphs[i])) continue;
      if (hasInstrumentName(paragraphs[i])) {
        lastInstrumentIndex = i;
      }
    }

    let insertIndex: number;
    if (lastInstrumentIndex >= 0) {
      insertIndex = lastInstrumentIndex + 1;
    } else {
      let fallbackIndex = -1;
      for (let i = 0; i < paragraphs.length; i++) {
        if (isIntroParagraph(paragraphs[i])) continue;
        const lower = paragraphs[i].toLowerCase();
        if (
          lower.includes("spatial") ||
          lower.includes("platform") ||
          lower.includes("solution") ||
          lower.includes("enable") ||
          lower.includes("profil")
        ) {
          fallbackIndex = i;
        }
      }
      if (fallbackIndex >= 0) {
        insertIndex = fallbackIndex + 1;
      } else {
        insertIndex = Math.min(2, paragraphs.length);
      }
    }

    const imageBlock = `[Insert Image: ${selectedAssets.image}]`;
    paragraphs.splice(insertIndex, 0, imageBlock);
    body = paragraphs.join("\n\n");
  }

  if (selectedAssets.documents.length > 0) {
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
        lower.includes("let me know") ||
        lower.includes("best,") ||
        lower === "tim" ||
        lower === "tim glidewell"
      ) {
        ctaIndex = i;
        break;
      }
    }

    const attachBlock: string[] = [];

    const attachRef = selectedAssets.attachmentReference;
    if (attachRef) {
      attachBlock.push("", attachRef);
      attachBlock.push("");
    }

    lines.splice(ctaIndex, 0, ...attachBlock);
    body = lines.join("\n");
  }

  result.email1 = { ...result.email1, body };
  return result;
}
