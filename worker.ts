/// <reference types="@cloudflare/workers-types" />
import { runSyncTick } from "./src/lib/sync/tick";
import { runReleaseScan } from "./src/lib/metadata/release-scan";
import { runNotifyTick } from "./src/lib/mail/tick";

// The OpenNext handler is generated at build time.
// This file is the Cloudflare Worker entry point.
const worker = {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      // Generated at build time by opennextjs-cloudflare (may not exist before first build)
      const { default: handler } = await import("./.open-next/worker.js");
      return handler.fetch(request, env, ctx);
    } catch {
      return new Response("Build the app first with: opennextjs-cloudflare build", { status: 500 });
    }
  },
  async scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    if (controller.cron === "*/5 * * * *") ctx.waitUntil(runSyncTick(env));
    if (controller.cron === "0 */6 * * *") ctx.waitUntil(runReleaseScan(env));
    if (controller.cron === "0 16 * * *") ctx.waitUntil(runNotifyTick(env));
  },
};

export default worker;
