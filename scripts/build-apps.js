import { execSync } from "child_process";
import { readdirSync, statSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const appsDir = join(process.cwd(), "apps");
const distDir = join(process.cwd(), "dist", "apps");

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

const apps = readdirSync(appsDir).filter((d) => {
  if (d === "shared") return false;
  const dir = join(appsDir, d);
  return (
    statSync(dir).isDirectory() && existsSync(join(dir, "index.html"))
  );
});

console.log(`Building ${apps.length} MCP Apps: ${apps.join(", ")}`);

let failed = 0;
for (const app of apps) {
  process.stdout.write(`  Building ${app}...`);
  try {
    execSync(`npx vite build --config vite.apps.config.ts`, {
      stdio: "pipe",
      env: { ...process.env, APP_NAME: app },
    });
    console.log(` done`);
  } catch (error) {
    console.log(` FAILED`);
    console.error(error.stderr?.toString() || error.message);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${apps.length} apps failed to build.`);
  process.exit(1);
}

console.log(`\nAll ${apps.length} apps built successfully.`);
