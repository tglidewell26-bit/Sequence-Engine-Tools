import { db } from "./db";
import { assets, sequences, type Asset, type InsertAsset, type Sequence, type InsertSequence } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  deleteAsset(id: number): Promise<void>;
  getSequences(): Promise<Sequence[]>;
  getSequence(id: number): Promise<Sequence | undefined>;
  createSequence(seq: InsertSequence): Promise<Sequence>;
  updateSequence(id: number, data: Partial<InsertSequence>): Promise<Sequence>;
  deleteSequence(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAssets(): Promise<Asset[]> {
    return db.select().from(assets).orderBy(desc(assets.createdAt));
  }

  async getAsset(id: number): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [created] = await db.insert(assets).values(asset).returning();
    return created;
  }

  async deleteAsset(id: number): Promise<void> {
    await db.delete(assets).where(eq(assets.id, id));
  }

  async getSequences(): Promise<Sequence[]> {
    return db.select().from(sequences).orderBy(desc(sequences.createdAt));
  }

  async getSequence(id: number): Promise<Sequence | undefined> {
    const [seq] = await db.select().from(sequences).where(eq(sequences.id, id));
    return seq;
  }

  async createSequence(seq: InsertSequence): Promise<Sequence> {
    const [created] = await db.insert(sequences).values(seq).returning();
    return created;
  }

  async updateSequence(id: number, data: Partial<InsertSequence>): Promise<Sequence> {
    const [updated] = await db.update(sequences).set(data).where(eq(sequences.id, id)).returning();
    return updated;
  }

  async deleteSequence(id: number): Promise<void> {
    await db.delete(sequences).where(eq(sequences.id, id));
  }
}

export const storage = new DatabaseStorage();
