import type { ElectrobunConfig } from "electrobun";

const webBuildDir = "../web/dist";
const appVersion = process.env.DAAN_VERSION?.replace(/^v/, "") ?? "0.0.1";

export default {
  app: {
    name: "daan",
    identifier: "dev.bettertstack.daan.desktop",
    version: appVersion,
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    mainProcess: "cottontail",
    cottontail: {
      entrypoint: "src/bun/index.ts",
    },
    copy: {
      [webBuildDir]: "views/mainview",
    },
    watchIgnore: [`${webBuildDir}/**`],
    mac: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    linux: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    win: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
  },
} satisfies ElectrobunConfig;
