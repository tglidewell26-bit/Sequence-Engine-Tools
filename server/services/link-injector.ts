const LINK_MAP: Record<string, string> = {
  "GeoMx Digital Spatial Profiler": "https://nanostring.com/products/geomx-digital-spatial-profiler/geomx-dsp-overview/",
  "GeoMx": "https://nanostring.com/products/geomx-digital-spatial-profiler/geomx-dsp-overview/",
  "CosMx Spatial Molecular Imager": "https://nanostring.com/products/cosmx-spatial-molecular-imager/single-cell-imaging-overview/",
  "CosMx": "https://nanostring.com/products/cosmx-spatial-molecular-imager/single-cell-imaging-overview/",
  "CellScape": "https://brukerspatialbiology.com/cellscape/",
  "Bruker Spatial Biology": "https://brukerspatialbiology.com/",
};

const LINKEDIN_KEYS = ["linkedinConnection", "linkedinMessage"];

export function injectLinks(body: string): string {
  let result = body;
  const sortedEntries = Object.entries(LINK_MAP).sort((a, b) => b[0].length - a[0].length);
  const linkedRanges: { start: number; end: number }[] = [];

  for (const [term, url] of sortedEntries) {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedTerm}(?:™)?\\b`, "i");
    const match = result.match(regex);
    if (match && match.index !== undefined) {
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;

      const overlaps = linkedRanges.some(
        (r) => matchStart < r.end && matchEnd > r.start
      );
      if (overlaps) continue;

      const replacement = `<a href="${url}">${match[0]}</a>`;
      result =
        result.slice(0, match.index) +
        replacement +
        result.slice(match.index + match[0].length);

      linkedRanges.push({
        start: match.index,
        end: match.index + replacement.length,
      });
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
