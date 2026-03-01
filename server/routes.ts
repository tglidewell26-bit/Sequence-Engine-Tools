import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { storage } from "./storage";
import { detectInstrument } from "./services/parser";
import { injectAvailability } from "./services/formatter";
import { injectLinksInSections } from "./services/link-injector";
import { selectAssets } from "./services/asset-selector";
import { summarizePdf } from "./services/asset-summarizer";
import { insertAssetsIntoEmail } from "./services/asset-inserter";
import { researchCompany } from "./services/perplexity-research";
import { generateSequence } from "./services/sequence-generator";
import { extractKeywords, filterAssetsByKeywords } from "./services/keyword-matcher";

const generateSchema = z.object({
  leadIntel: z.string().min(1, "Lead intel is required").max(50000),
  name: z.string().optional(),
  availabilityBlock: z.string().optional(),
});

function autoGenerateName(leadIntel: string): string {
  const fields = leadIntel.split("\t");

  let company = (fields[1] || "").trim();
  company = company
    .replace(/,?\s*(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Co\.?|Incorporated|Limited|L\.?P\.?)$/i, "")
    .trim();

  let city = "";
  const location = (fields[3] || "").trim();
  if (location) {
    const commaIdx = location.lastIndexOf(",");
    city = commaIdx > 0 ? location.slice(0, commaIdx).trim() : location;
  }

  const instrument = (fields[12] || "").trim();

  const parts = [company, city, instrument].filter(p => p.length > 0);
  return parts.length > 0 ? parts.join(" ") : "Untitled Sequence";
}

const updateSequenceSchema = z.object({
  sections: z.record(z.object({
    subject: z.string(),
    body: z.string(),
  })).optional(),
  name: z.string().optional(),
});

function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/assets", async (_req, res) => {
    try {
      const assets = await storage.getAssets();
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/assets/upload", upload.array("files", 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

      const { instrument, type } = req.body;
      if (!instrument || !type) {
        return res.status(400).json({ error: "Instrument and type are required" });
      }

      const results: any[] = [];
      const errors: string[] = [];

      for (const file of files) {
        try {
          let summary: string | undefined;
          let keywords: string[] | undefined;

          if (file.mimetype === "application/pdf") {
            try {
              const pdfParse = (await import("pdf-parse")).default;
              const pdfBuffer = fs.readFileSync(file.path);
              const pdfData = await pdfParse(pdfBuffer);
              const result = await summarizePdf(pdfData.text, file.originalname);
              summary = result.summary;
              keywords = result.keywords;
            } catch (pdfError) {
              console.error("PDF parsing error:", pdfError);
              summary = "PDF summary unavailable.";
              keywords = [];
            }
          }

          const asset = await storage.createAsset({
            fileName: file.originalname,
            instrument,
            type,
            size: file.size,
            summary,
            keywords,
            filePath: file.path,
          });

          results.push(asset);
        } catch (fileError: any) {
          errors.push(`${file.originalname}: ${fileError.message}`);
        }
      }

      res.status(201).json({ assets: results, errors });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/assets/:id/download", async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (id === null) return res.status(400).json({ error: "Invalid asset id" });
      const asset = await storage.getAsset(id);
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      if (!fs.existsSync(asset.filePath)) return res.status(404).json({ error: "File not found" });
      res.download(asset.filePath, asset.fileName);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/assets/:id", async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (id === null) return res.status(400).json({ error: "Invalid asset id" });
      const asset = await storage.getAsset(id);
      if (asset && fs.existsSync(asset.filePath)) {
        fs.unlinkSync(asset.filePath);
      }
      await storage.deleteAsset(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sequences", async (_req, res) => {
    try {
      const sequences = await storage.getSequences();
      res.json(sequences);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sequences/:id", async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (id === null) return res.status(400).json({ error: "Invalid sequence id" });
      const seq = await storage.getSequence(id);
      if (!seq) return res.status(404).json({ error: "Sequence not found" });
      res.json(seq);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sequences/generate", async (req, res) => {
    try {
      const parseResult = generateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid input" });
      }
      const { leadIntel, availabilityBlock } = parseResult.data;
      const name = parseResult.data.name?.trim() || autoGenerateName(leadIntel);

      console.log("Step 1: Calling Perplexity for company research...");
      const researchBrief = await researchCompany(leadIntel);
      console.log("Step 1 complete: Research brief received");

      console.log("Step 2: Calling OpenAI for sequence generation...");
      let sections = await generateSequence(leadIntel, researchBrief, availabilityBlock);
      console.log("Step 2 complete: Sequence generated");

      sections = injectLinksInSections(sections);

      if (availabilityBlock && availabilityBlock.trim()) {
        sections = injectAvailability(sections, availabilityBlock.trim());
      }

      const allSectionText = Object.values(sections).map(s => `${s.subject} ${s.body}`).join(" ");
      const instrument = detectInstrument(allSectionText);

      const keywords = extractKeywords(leadIntel, researchBrief);
      console.log(`Extracted ${keywords.length} keywords for asset matching`);

      let selectedAssets = null;
      let selectedAssetsEmail2 = null;
      const allAssets = await storage.getAssets();
      const filteredAssets = filterAssetsByKeywords(allAssets, keywords);
      console.log(`Filtered assets: ${filteredAssets.length} of ${allAssets.length} match keywords`);

      if (filteredAssets.length > 0 && sections.email1) {
        selectedAssets = await selectAssets(sections.email1.body, filteredAssets, instrument);
        sections = insertAssetsIntoEmail(sections, selectedAssets, "email1");
      }

      if (filteredAssets.length > 0 && sections.email2) {
        const email1UsedFiles: string[] = [];
        if (selectedAssets) {
          if (selectedAssets.image) email1UsedFiles.push(selectedAssets.image);
          email1UsedFiles.push(...selectedAssets.documents);
        }
        selectedAssetsEmail2 = await selectAssets(sections.email2.body, filteredAssets, instrument, email1UsedFiles);
        sections = insertAssetsIntoEmail(sections, selectedAssetsEmail2, "email2");
      }

      res.json({
        sections,
        selectedAssets,
        selectedAssetsEmail2,
        name: name || "Untitled Sequence",
        instrument,
        rawInput: leadIntel,
        researchBrief,
      });
    } catch (error: any) {
      console.error("Generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sequences/save", async (req, res) => {
    try {
      const { name, instrument, rawInput, researchBrief, sections, selectedAssets, selectedAssetsEmail2 } = req.body;
      const sequence = await storage.createSequence({
        name: name || "Untitled Sequence",
        instrument,
        rawInput,
        researchBrief,
        sections,
        selectedAssets,
        selectedAssetsEmail2,
      });
      res.json(sequence);
    } catch (error: any) {
      console.error("Save error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/sequences/:id", async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (id === null) return res.status(400).json({ error: "Invalid sequence id" });
      const parseResult = updateSequenceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid input" });
      }
      const updated = await storage.updateSequence(id, parseResult.data);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/sequences/:id", async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (id === null) return res.status(400).json({ error: "Invalid sequence id" });
      await storage.deleteSequence(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
