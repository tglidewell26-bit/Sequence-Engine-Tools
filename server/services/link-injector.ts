const LINK_MAP: Record<string, string> = {
  GeoMx: "https://nanostring.com/products/geomx-digital-spatial-profiler/geomx-dsp-overview/",
  CosMx: "https://nanostring.com/products/cosmx-spatial-molecular-imager/single-cell-imaging-overview/",
  CellScape: "https://brukerspatialbiology.com/",
};

export function injectLinks(body: string): string {
  let result = body;
  for (const [instrument, url] of Object.entries(LINK_MAP)) {
    const regex = new RegExp(`\\b${instrument}\\b`);
    const match = result.match(regex);
    if (match && match.index !== undefined) {
      result =
        result.slice(0, match.index) +
        `${instrument} (${url})` +
        result.slice(match.index + instrument.length);
    }
  }
  return result;
}

export function injectLinksInSections(
  sections: Record<string, { subject: string; body: string }>
): Record<string, { subject: string; body: string }> {
  const result = { ...sections };
  for (const key of Object.keys(result)) {
    result[key] = {
      ...result[key],
      body: injectLinks(result[key].body),
    };
  }
  return result;
}
