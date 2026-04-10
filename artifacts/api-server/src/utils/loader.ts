import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";
import chokidar from "chokidar";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = new Map();
const dir = path.resolve(process.cwd(), "src/commands");
console.log(`✅ Resolved DIR ✨️✨️:` + dir);

function log(msg) {
  console.log(`[DEV-MODE] ${msg}`);
}

async function loadCommand(file: string) {
  const fullPath = path.join(dir, file);

  try {
    const module = await import(pathToFileURL(fullPath).href + `?update=${Date.now()}`);
    const cmd = module.default || module;

    if (!cmd.name || !cmd.execute) {
      log(`⚠️ Invalid command: ${file}`);
      return;
    }

    commands.set(cmd.name.toLowerCase(), {
      ...cmd,
      file,
    });

    log(`✅ Loaded: ${cmd.name} (${file})`);
  } catch (err) {
    log(`❌ Failed to load ${file}: ${err.message}`);
  }
}

function unloadCommand(file: string) {
  const nameGuess = path.basename(file, path.extname(file));

  for (const [name, cmd] of commands.entries()) {
    if (cmd.file === file || name === nameGuess) {
      commands.delete(name);
      log(`🗑 Unloaded: ${name}`);
      break;
    }
  }
}

/**
 * Recursively walks a directory and returns all .js/.ts files
 * as paths relative to the base commands dir.
 * e.g. "admin/kick.ts", "owner/status.ts", "ping.ts"
 */
function collectFiles(baseDir: string, subDir = ""): string[] {
  const results: string[] = [];
  const current = subDir ? path.join(baseDir, subDir) : baseDir;

  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const relative = subDir ? path.join(subDir, entry.name) : entry.name;

    if (entry.isDirectory()) {
      // Recurse into subfolder
      results.push(...collectFiles(baseDir, relative));
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".ts"))) {
      results.push(relative);
    }
  }

  return results;
}

export async function loadCommands() {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log("Created commands folder");
  }

  log("📂 COMMAND DIR: " + dir);

  const files = collectFiles(dir);
  log("📁 FILES FOUND: " + JSON.stringify(files));

  for (const file of files) {
    await loadCommand(file);
  }

  log("✨️  WATCH MODE DEV MAGIC ✨️");

  // chokidar with recursive: true watches all subdirectories automatically
  const watcher = chokidar.watch(dir, {
    ignoreInitial: true,
    recursive: true,
  });

  watcher.on("add", async (filePath) => {
    // Store as relative path so unloadCommand can match correctly
    const file = path.relative(dir, filePath);
    if (!file.endsWith(".js") && !file.endsWith(".ts")) return;
    log(`📥 New file detected: ${file}`);
    await loadCommand(file);
  });

  watcher.on("change", async (filePath) => {
    const file = path.relative(dir, filePath);
    if (!file.endsWith(".js") && !file.endsWith(".ts")) return;
    log(`♻ Changed: ${file}`);
    unloadCommand(file);
    await loadCommand(file);
  });

  watcher.on("unlink", (filePath) => {
    const file = path.relative(dir, filePath);
    log(`🧹 Deleted: ${file}`);
    unloadCommand(file);
  });

  log("🔥 DEV MODE ACTIVE — hot reload enabled");
  return commands;
}

export { commands };

