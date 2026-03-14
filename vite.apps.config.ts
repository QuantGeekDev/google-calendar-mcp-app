import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

const app = process.env.APP_NAME;
if (!app) {
  throw new Error("APP_NAME environment variable is required");
}

export default defineConfig({
  root: resolve(__dirname, `apps/${app}`),
  plugins: [viteSingleFile()],
  build: {
    outDir: resolve(__dirname, `dist/apps/${app}`),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, `apps/${app}/index.html`),
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "apps/shared"),
    },
  },
});
