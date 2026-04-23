#!/usr/bin/env node

/**
 * ChatGPT Desktop MCP Configuration Script
 * Automatically configures mcp-ssh-tool for ChatGPT Desktop
 */

import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

// Platform-specific config paths
const CONFIG_PATHS = {
  darwin: path.join(os.homedir(), "Library", "Application Support", "ChatGPT", "mcp.json"),
  win32: path.join(process.env.APPDATA || "", "ChatGPT", "mcp.json"),
  linux: path.join(os.homedir(), ".config", "chatgpt", "mcp.json"),
};

const MCP_CONFIG = {
  name: "ssh-mcp-server",
  description: "SSH client server for remote automation",
  command: "npx",
  args: ["-y", "mcp-ssh-tool"],
  env: {},
};

function getConfigPath() {
  const platform = process.platform;
  if (CONFIG_PATHS[platform]) {
    return CONFIG_PATHS[platform];
  }
  console.error(`❌ Unsupported platform: ${platform}`);
  process.exit(1);
}

function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

function loadExistingConfig(configPath) {
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.warn(`⚠️ Could not parse existing config, creating new one`);
      return { mcpServers: {} };
    }
  }
  return { mcpServers: {} };
}

function main() {
  console.log("🔧 MCP SSH Tool - ChatGPT Desktop Setup\n");

  const configPath = getConfigPath();
  console.log(`📄 Config path: ${configPath}\n`);

  ensureDirectoryExists(configPath);

  // Load existing config
  const config = loadExistingConfig(configPath);

  // Check if already configured
  if (config.mcpServers && config.mcpServers["ssh-mcp-server"]) {
    console.log("✅ MCP SSH Tool is already configured!");
    console.log("\nCurrent configuration:");
    console.log(JSON.stringify(config.mcpServers["ssh-mcp-server"], null, 2));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("\n🔄 Do you want to update the configuration? (y/N): ", (answer) => {
      rl.close();
      if (answer.toLowerCase() === "y") {
        addOrUpdateConfig(config, configPath);
      } else {
        console.log("No changes made.");
      }
    });
  } else {
    addOrUpdateConfig(config, configPath);
  }
}

function addOrUpdateConfig(config, configPath) {
  // Ensure mcpServers object exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Add/update SSH MCP server
  config.mcpServers["ssh-mcp-server"] = MCP_CONFIG;

  // Write config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  console.log("\n✅ Configuration saved successfully!\n");

  console.log("📋 Next steps:");
  console.log("   1. Restart ChatGPT Desktop");
  console.log("   2. Open a new chat");
  console.log("   3. Use the MCP icon (🔌) to access SSH tools");
  console.log("\n🎉 Setup complete!");
}

main();
