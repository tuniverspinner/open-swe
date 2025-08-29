#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.resolve(__dirname, "..");
const agentSourcePath = path.resolve(__dirname, "../../../apps/open-swe-v2");
const bundleDir = path.join(packageRoot, "bundle");

async function bundle() {
  console.log("🚀 Bundling OpenSWE CLI with Agent and CLI...");

  // Clean bundle directory
  await fs.remove(bundleDir);
  await fs.ensureDir(bundleDir);

  // Copy agent source files
  const agentSrcPath = path.join(agentSourcePath, "src");
  const bundleAgentPath = path.join(bundleDir, "agent");

  if (await fs.pathExists(agentSrcPath)) {
    await fs.copy(agentSrcPath, bundleAgentPath);
    console.log("✓ Copied agent source files");
  } else {
    console.error("❌ Agent source path not found:", agentSrcPath);
    process.exit(1);
  }

  // Copy CLI compiled files
  const cliSourcePath = path.resolve(__dirname, "../../../apps/cli");
  const cliDistPath = path.join(cliSourcePath, "dist");
  const bundleCliPath = path.join(bundleDir, "cli");

  if (await fs.pathExists(cliDistPath)) {
    await fs.copy(cliDistPath, bundleCliPath);
    console.log("✓ Copied CLI compiled files");
  } else {
    console.error("❌ CLI dist path not found:", cliDistPath);
    console.error('Make sure to run "yarn build" in apps/cli first');
    process.exit(1);
  }

  // Copy langgraph.json config
  const langGraphConfigSource = path.join(agentSourcePath, "langgraph.json");
  const langGraphConfigDest = path.join(bundleDir, "langgraph.json");

  if (await fs.pathExists(langGraphConfigSource)) {
    await fs.copy(langGraphConfigSource, langGraphConfigDest);

    // Update the config to point to bundled agent
    const config = await fs.readJson(langGraphConfigDest);
    if (config.graphs && config.graphs.coding) {
      config.graphs.coding = "./agent/agent.ts:agent";
    }
    await fs.writeJson(langGraphConfigDest, config, { spaces: 2 });
    console.log("✓ Copied and updated langgraph.json");
  } else {
    console.error("❌ LangGraph config not found:", langGraphConfigSource);
    process.exit(1);
  }

  // Copy to package root for easy access
  await fs.copy(langGraphConfigDest, path.join(packageRoot, "langgraph.json"));
  await fs.copy(bundleAgentPath, path.join(packageRoot, "agent"));
  await fs.copy(bundleCliPath, path.join(packageRoot, "cli"));

  console.log(
    "✅ Bundle complete! Agent and CLI files copied to package root.",
  );
}

bundle().catch(console.error);
