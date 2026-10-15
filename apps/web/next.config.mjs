import { fileURLToPath } from "node:url";
import { deploymentOrigins } from "../../scripts/deployment/origins.mjs";
const origins = deploymentOrigins();
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
export default (phase) => ({
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  env: {
    NEXT_PUBLIC_API_ORIGIN: origins.api,
    NEXT_PUBLIC_EXECUTOR_ORIGIN: origins.executor,
  },
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
});
