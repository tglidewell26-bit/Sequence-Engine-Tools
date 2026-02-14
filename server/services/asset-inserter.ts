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
    let painIndex = -1;
    let solutionIndex = -1;

    for (let i = 0; i < paragraphs.length; i++) {
      const lower = paragraphs[i].toLowerCase();
      if (painIndex === -1 && (
        lower.includes("challenge") ||
        lower.includes("struggle") ||
        lower.includes("difficult") ||
        lower.includes("pain") ||
        lower.includes("problem") ||
        lower.includes("limitation") ||
        lower.includes("wanted to reach out") ||
        lower.includes("your research") ||
        lower.includes("your work") ||
        lower.includes("your lab")
      )) {
        painIndex = i;
      }

      if (painIndex >= 0 && i > painIndex && solutionIndex === -1 && (
        lower.includes("geomx") ||
        lower.includes("cosmx") ||
        lower.includes("cellscape") ||
        lower.includes("spatial") ||
        lower.includes("platform") ||
        lower.includes("solution") ||
        lower.includes("enable") ||
        lower.includes("profil")
      )) {
        solutionIndex = i;
      }
    }

    let insertIndex: number;
    if (painIndex >= 0 && solutionIndex > painIndex) {
      insertIndex = solutionIndex + 1;
    } else if (painIndex >= 0) {
      insertIndex = painIndex + 1;
    } else {
      let foundInstrument = false;
      for (let i = 0; i < paragraphs.length; i++) {
        const lower = paragraphs[i].toLowerCase();
        if (
          lower.includes("geomx") ||
          lower.includes("cosmx") ||
          lower.includes("cellscape") ||
          lower.includes("spatial")
        ) {
          insertIndex = i + 1;
          foundInstrument = true;
          break;
        }
      }
      if (!foundInstrument) {
        insertIndex = Math.min(2, paragraphs.length);
      }
      insertIndex = insertIndex!;
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
