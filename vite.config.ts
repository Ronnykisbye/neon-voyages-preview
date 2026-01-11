// ============================================================
// AFSNIT 01 – Imports
// ============================================================
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// ============================================================
// AFSNIT 02 – Vite config
// (Preview-repo base path skal matche repo-navn på GitHub Pages)
// ============================================================
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Preview repo (vigtigt!)
  base: "/neon-voyages-preview/",

  // ==========================================================
  // AFSNIT 03 – Dev server
  // ==========================================================
  server: {
    host: "::",
    port: 8080,
  },

  // ==========================================================
  // AFSNIT 04 – Plugins
  // ==========================================================
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),

  // ==========================================================
  // AFSNIT 05 – Resolve aliases
  // ==========================================================
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

