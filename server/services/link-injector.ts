const LINK_MAP: Record<string, string> = {
  "GeoMx": "https://nanostring.com/products/geomx-digital-spatial-profiler/geomx-dsp-overview/",
  "CosMx": "https://nanostring.com/products/cosmx-spatial-molecular-imager/single-cell-imaging-overview/",
  "CellScape": "https://brukerspatialbiology.com/cellscape/",
  "Bruker Spatial Biology": "https://brukerspatialbiology.com/",
};

const LINKEDIN_KEYS = ["linkedinConnection", "linkedinMessage"];

export function injectLinks(body: string): string {
  let result = body;
  const sortedEntries = Object.entries(LINK_MAP).sort((a, b) => b[0].length - a[0].length);

  for (const [term, url] of sortedEntries) {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedTerm}(?:™)?\\b`, "i");
    const match = result.match(regex);
    if (match && match.index !== undefined) {
      const beforeMatch = result.slice(Math.max(0, match.index - 1), match.index);
      const afterMatch = result.slice(match.index + match[0].length, match.index + match[0].length + 2);
      const alreadyLinked = beforeMatch.includes("(") || afterMatch.includes("(");
      if (!alreadyLinked) {
        result =
          result.slice(0, match.index) +
          `${match[0]} (${url})` +
          result.slice(match.index + match[0].length);
      }
    }
  }
  return result;
}

export function injectLinksInSections(
  sections: Record<string, { subject: string; body: string }>
): Record<string, { subject: string; body: string }> {
  const result = { ...sections };
  for (const key of Object.keys(result)) {
    if (LINKEDIN_KEYS.includes(key)) continue;
    result[key] = {
      ...result[key],
      body: injectLinks(result[key].body),
    };
  }
  return result;
}
