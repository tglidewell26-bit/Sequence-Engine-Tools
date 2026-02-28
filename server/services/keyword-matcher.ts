import type { Asset } from "@shared/schema";

const DISEASE_TERMS = [
  "cancer", "tumor", "tumour", "oncology", "immuno-oncology", "io",
  "lymphoma", "leukemia", "melanoma", "carcinoma", "sarcoma", "glioma", "glioblastoma",
  "breast cancer", "lung cancer", "prostate cancer", "colorectal", "pancreatic",
  "fibrosis", "inflammation", "autoimmune", "rheumatoid",
  "neurodegen", "alzheimer", "parkinson", "neurolog", "neuro",
  "infectious disease", "immunology", "hematolog",
  "renal", "kidney", "liver", "hepat", "cardiac", "cardiovascular",
];

const SAMPLE_TERMS = [
  "ffpe", "fresh frozen", "biopsy", "biopsies", "organoid", "organoids",
  "tissue", "blood", "pbmc", "tma", "whole slide", "xenograft",
  "patient-derived", "pdx", "clinical sample", "translational",
];

const TECHNIQUE_TERMS = [
  "transcriptom", "proteom", "spatial", "single-cell", "single cell",
  "multiplex", "morpholog", "rna", "protein", "genomic", "epigenom",
  "ihc", "mif", "flow cytometry", "bulk rna-seq", "scrna-seq", "sc-rna",
  "digital pathology", "imaging", "mass spec", "sequencing",
  "high-plex", "multi-omic", "multiomics", "biomarker",
];

const INSTRUMENT_TERMS = [
  "cosmx", "geomx", "cellscape",
  "spatial biology", "spatial profiling", "spatial transcriptomics",
  "dsp", "digital spatial profiler", "smi",
];

const BIOLOGY_TERMS = [
  "t cell", "t-cell", "b cell", "b-cell", "immune", "tumor microenvironment", "tme",
  "checkpoint", "pd-l1", "pd-1", "ctla-4", "car-t", "car t",
  "antibody", "adc", "bispecific", "t cell engager",
  "cytokine", "chemokine", "receptor", "ligand",
  "niche", "stroma", "epithelial", "endothelial", "macrophage", "dendritic",
  "gene expression", "cell type", "cell state", "phenotyp",
  "resolution", "subcellular", "fov", "throughput", "sensitivity",
];

const ALL_PATTERNS = [
  ...DISEASE_TERMS,
  ...SAMPLE_TERMS,
  ...TECHNIQUE_TERMS,
  ...INSTRUMENT_TERMS,
  ...BIOLOGY_TERMS,
];

export function extractKeywords(leadIntel: string, researchBrief: string): string[] {
  const combined = `${leadIntel}\n${researchBrief}`.toLowerCase();
  const matched = new Set<string>();

  for (const term of ALL_PATTERNS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}`, "i");
    if (regex.test(combined)) {
      matched.add(term.toLowerCase());
    }
  }

  return Array.from(matched);
}

export function filterAssetsByKeywords(assets: Asset[], keywords: string[]): Asset[] {
  if (keywords.length === 0 || assets.length === 0) {
    return assets;
  }

  const scored = assets.map(asset => {
    let score = 0;
    const assetText = [
      asset.fileName,
      asset.summary || "",
      ...(asset.keywords || []),
    ].join(" ").toLowerCase();

    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}`, "i");
      if (regex.test(assetText)) {
        score++;
      }
    }

    return { asset, score };
  });

  const matched = scored.filter(s => s.score > 0);

  if (matched.length === 0) {
    return assets;
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.map(s => s.asset);
}
