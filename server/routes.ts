import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { storage } from "./storage";
import { parseSequence, detectInstrument } from "./services/parser";
import { enforceIntroRules, injectAvailability } from "./services/formatter";
import { injectLinksInSections } from "./services/link-injector";
import { selectAssets } from "./services/asset-selector";
import { summarizePdf } from "./services/asset-summarizer";
import { checkRedundancy } from "./services/redundancy-checker";
import { insertAssetsIntoEmail1 } from "./services/asset-inserter";

const generateSchema = z.object({
  rawInput: z.string().min(1, "Sequence content is required").max(50000),
  name: z.string().optional(),
  availabilityWindow: z.string().optional(),
  timeRanges: z.string().optional(),
  instrumentOverride: z.string().optional(),
});

const updateSequenceSchema = z.object({
  sections: z.record(z.object({
    subject: z.string(),
    body: z.string(),
  })).optional(),
  name: z.string().optional(),
});

const REQUIRED_SECTIONS = ["email1", "email2", "linkedinConnection", "linkedinMessage", "email3", "email4"];

const DEFAULT_SUBJECTS: Record<string, (instrument: string) => string> = {
  email1: (inst) => `${inst} for Your Research`,
  email2: (inst) => `Following Up — ${inst}`,
  email3: (inst) => `New ${inst} Data Available`,
  email4: (inst) => `Final Note — ${inst} Opportunity`,
};

function ensureAllSections(
  sections: Record<string, { subject: string; body: string }>,
  instrument: string
): Record<string, { subject: string; body: string }> {
  const result = { ...sections };

  for (const key of REQUIRED_SECTIONS) {
    if (!result[key]) {
      const isLinkedIn = key.startsWith("linkedin");
      result[key] = {
        subject: "",
        body: isLinkedIn ? "" : "",
      };
    }

    if (!result[key].subject && key.startsWith("email")) {
      const generator = DEFAULT_SUBJECTS[key];
      result[key] = {
        ...result[key],
        subject: generator ? generator(instrument) : `${instrument} Spatial Biology`,
      };
    }
  }

  return result;
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
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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
      const seq = await storage.getSequence(parseInt(req.params.id));
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
      const { rawInput, name, availabilityWindow, timeRanges, instrumentOverride } = parseResult.data;

      let sections = parseSequence(rawInput);

      const instrument = instrumentOverride && instrumentOverride !== "auto"
        ? instrumentOverride
        : detectInstrument(rawInput);

      sections = enforceIntroRules(sections);
      sections = injectLinksInSections(sections);

      if (availabilityWindow || timeRanges) {
        sections = injectAvailability(sections, availabilityWindow, timeRanges);
      }

      sections = await checkRedundancy(sections);

      sections = ensureAllSections(sections, instrument);

      let selectedAssets = null;
      const allAssets = await storage.getAssets();
      if (allAssets.length > 0 && sections.email1) {
        selectedAssets = await selectAssets(sections.email1.body, allAssets, instrument);
        sections = insertAssetsIntoEmail1(sections, selectedAssets);
      }

      const sequence = await storage.createSequence({
        name: name || "Untitled Sequence",
        instrument,
        rawInput,
        availabilityWindow,
        timeRanges,
        sections,
        selectedAssets,
      });

      res.json({
        sections,
        selectedAssets,
        sequenceId: sequence.id,
      });
    } catch (error: any) {
      console.error("Generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/sequences/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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
      await storage.deleteSequence(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
