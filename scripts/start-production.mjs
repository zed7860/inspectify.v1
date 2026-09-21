import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
const standalone = resolve(".next/standalone");
if (!existsSync(resolve(standalone, "server.js"))) {
  console.error("Production build missing. Run npm run build first.");
  process.exit(1);
}
mkdirSync(resolve(standalone, ".next"), { recursive: true });
cpSync(".next/static", resolve(standalone, ".next/static"), { recursive: true });
if (existsSync("public")) cpSync("public", resolve(standalone, "public"), { recursive: true });
const child = spawn(process.execPath, [resolve(standalone, "server.js")], {
  stdio: "inherit", env: { ...process.env, HOSTNAME: "0.0.0.0", PORT: process.env.PORT || "3000" }
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
