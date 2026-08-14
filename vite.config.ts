import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "public",
  publicDir: "static",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "public/index.html"),
        privacy: resolve(import.meta.dirname, "public/personvernerklaering.html"),
        notFound: resolve(import.meta.dirname, "public/404.html"),
        admin: resolve(import.meta.dirname, "public/admin/submissions.html")
      }
    }
  }
});
