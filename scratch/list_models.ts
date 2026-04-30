/**
 * Diagnostic script: List all available Gemini models and test embeddings.
 * Reads the user's encrypted API key from the SQLite DB, decrypts it,
 * then queries the Gemini API for available models.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import crypto from "crypto";
import { createClient } from "@libsql/client";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_SECRET not configured");
  }
  return crypto.scryptSync(secret, "gitdocify-salt", 32);
}

function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, "base64");
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

async function main() {
  // 1. Get the user's encrypted key from the DB
  const client = createClient({ url: process.env.DATABASE_URL || "file:./dev.db" });
  const result = await client.execute("SELECT encrypted_gemini_key FROM users WHERE encrypted_gemini_key IS NOT NULL LIMIT 1");
  
  if (result.rows.length === 0) {
    console.error("❌ No user with a Gemini API key found in the database.");
    process.exit(1);
  }

  const encryptedKey = result.rows[0].encrypted_gemini_key as string;
  const apiKey = decrypt(encryptedKey);
  console.log(`✅ Decrypted API key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);

  // 2. List all available models
  console.log("\n📋 Listing available models...\n");
  const listRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  
  if (!listRes.ok) {
    console.error(`❌ ListModels failed: ${listRes.status} ${listRes.statusText}`);
    const body = await listRes.text();
    console.error(body);
    process.exit(1);
  }

  const data = await listRes.json();
  
  // Filter for embedding-capable models
  const embeddingModels = data.models.filter((m: any) => 
    m.supportedGenerationMethods?.includes("embedContent")
  );

  console.log("=== EMBEDDING-CAPABLE MODELS ===");
  for (const m of embeddingModels) {
    console.log(`  ${m.name} (${m.displayName})`);
    console.log(`    Methods: ${m.supportedGenerationMethods.join(", ")}`);
  }

  if (embeddingModels.length === 0) {
    console.log("  (none found)");
    // Show all models instead
    console.log("\n=== ALL MODELS ===");
    for (const m of data.models) {
      console.log(`  ${m.name} — ${m.supportedGenerationMethods?.join(", ")}`);
    }
  }

  // 3. Test embedding with the first available embedding model
  if (embeddingModels.length > 0) {
    const modelName = embeddingModels[0].name; // e.g. "models/xxx"
    console.log(`\n🧪 Testing embedContent with ${modelName}...`);
    
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${modelName}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: "Hello world" }] },
        }),
      }
    );

    if (embedRes.ok) {
      const embedData = await embedRes.json();
      console.log(`✅ Success! Embedding dimensions: ${embedData.embedding.values.length}`);
      console.log(`   Model to use: ${modelName.replace("models/", "")}`);
    } else {
      console.error(`❌ embedContent failed: ${embedRes.status}`);
      const body = await embedRes.text();
      console.error(body);
    }
  }
}

main().catch(console.error);
