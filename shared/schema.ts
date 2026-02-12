import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  instrument: text("instrument").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  summary: text("summary"),
  keywords: text("keywords").array(),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sequences = pgTable("sequences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  instrument: text("instrument"),
  rawInput: text("raw_input").notNull(),
  dateRange: text("date_range"),
  timeSlots: jsonb("time_slots").$type<string[]>(),
  sections: jsonb("sections").$type<Record<string, { subject: string; body: string }>>().notNull(),
  selectedAssets: jsonb("selected_assets").$type<{ image: string; documents: string[]; justificationSentence: string }>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
});

export const insertSequenceSchema = createInsertSchema(sequences).omit({
  id: true,
  createdAt: true,
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Sequence = typeof sequences.$inferSelect;
export type InsertSequence = z.infer<typeof insertSequenceSchema>;

export type SequenceSections = Record<string, { subject: string; body: string }>;
export type SelectedAssets = { image: string; documents: string[]; justificationSentence: string };
