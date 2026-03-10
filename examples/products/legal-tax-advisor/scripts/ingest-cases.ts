/**
 * Ingest scraped cases into Chroma.
 * Usage: npx tsx scripts/ingest-cases.ts [path-to-scraped-cases]
 *
 * Requires: CHROMA_URL, SCRAPED_CASES_PATH (or pass path as arg)
 * Loads .env.local from project root.
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { absorbAllCases } from "../lib/server/services/caseAbsorption";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const sourcePath = process.argv[2] || process.env.SCRAPED_CASES_PATH;
if (!sourcePath) {
  console.error("Usage: npx tsx scripts/ingest-cases.ts <path-to-scraped-cases>");
  console.error("Or set SCRAPED_CASES_PATH in .env.local");
  process.exit(1);
}

async function main() {
  console.log("Ingesting cases from:", sourcePath);
  const results = await absorbAllCases(sourcePath as string);
  const ok = results.filter((r) => r.success);
  const fail = results.filter((r) => !r.success);
  console.log(`Done. ${ok.length} succeeded, ${fail.length} failed.`);
  if (fail.length) {
    fail.forEach((r) => console.error("  Failed:", r.cnr, r.error));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
