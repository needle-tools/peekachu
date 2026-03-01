import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Peekachu",
    identifier: "tools.needle.peekachu",
    version: "0.1.0",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      mainview: {
        entrypoint: "src/mainview/index.ts",
      },
    },
    copy: {
      "src/mainview/index.html": "views/mainview/index.html",
      "src/mainview/style.css": "views/mainview/style.css",
    },
  },
} satisfies ElectrobunConfig;
