import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig, type Plugin } from "vite";

function cloudflareExternalPlugin(): Plugin {
  const stubs: Record<string, string> = {
    "cloudflare:email": `export class EmailMessage { constructor() {} }`,
    "cloudflare:workers": `
      export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }
      export class WorkflowEntrypoint { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }
      export const env = {};
    `,
  };

  return {
    name: "cloudflare-external",
    enforce: "pre",
    resolveId(id) {
      if (id.startsWith("cloudflare:")) {
        return "\0virtual:" + id;
      }
    },
    load(id) {
      if (id.startsWith("\0virtual:cloudflare:")) {
        const originalId = id.slice("\0virtual:".length);
        return stubs[originalId] || "export default {};";
      }
    },
  };
}

export default defineConfig({
  plugins: [cloudflareExternalPlugin(), agents(), react(), cloudflare(), tailwindcss()],
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: "cloudflare-external",
          setup(build) {
            build.onResolve({ filter: /^cloudflare:/ }, (args) => ({ path: args.path, external: true }));
          },
        },
      ],
    },
  },
  build: {
    rollupOptions: {
      external: [/^cloudflare:/],
    },
  },
});
