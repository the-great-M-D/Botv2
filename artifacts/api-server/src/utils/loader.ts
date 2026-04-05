import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";
import chokidar from "chokidar";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = new Map();
const dir = path.resolve(process.cwd(), "src/commands");

function log(msg) {
  console.log(`[DEV-MODE] ${msg}`);
}

async function loadCommand(file) {
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

    log(`✅ Loaded: ${cmd.name}`);
  } catch (err) {
    log(`❌ Failed to load ${file}: ${err.message}`);
  }
}

function unloadCommand(file) {
  const nameGuess = path.basename(file, path.extname(file));

  for (const [name, cmd] of commands.entries()) {
    if (cmd.file === file || name === nameGuess) {
      commands.delete(name);
      log(`🗑 Unloaded: ${name}`);
      break;
    }
  }
}

export async function loadCommands() {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log("Created commands folder");
  }
  log("📂 COMMAND DIR: " + dir);
  const files = fs.readdirSync(dir);
  log("📁 FILES FOUND: " + JSON.stringify(files));

  for (const file of files) {
    if (file.endsWith(".js") || file.endsWith(".ts")) {
      await loadCommand(file);
    }
  }

  // 👀 WATCH MODE (DEV MAGIC)
  const watcher = chokidar.watch(dir, {
    ignoreInitial: true,
  });

  watcher.on("add", async (filePath) => {
    const file = path.basename(filePath);
    log(`📥 New file detected: ${file}`);
    await loadCommand(file);
  });

  watcher.on("change", async (filePath) => {
    const file = path.basename(filePath);
    log(`♻ Changed: ${file}`);

    unloadCommand(file);
    await loadCommand(file);
  });

  watcher.on("unlink", (filePath) => {
    const file = path.basename(filePath);
    log(`🧹 Deleted: ${file}`);

    unloadCommand(file);
  });

  log("🔥 DEV MODE ACTIVE — hot reload enabled");
  return commands;
}

export { commands };
