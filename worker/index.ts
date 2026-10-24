import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { drainEmailOutbox } from "../lib/mail";
import { integrationConfiguration } from "../lib/provider-config";

const worker = {
  async fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>,
  ) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt)
            return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return {
              status: "request_context_expired",
              message: "This request has expired. Please try again.",
            };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response = await runWithConnectorBinding(binding, () =>
      handler.fetch(request, env, ctx),
    );
    const { mail } = integrationConfiguration(
      env as unknown as Record<string, unknown>,
    );
    if (env.DB && mail && request.method === "POST")
      ctx.waitUntil(
        drainEmailOutbox(env.DB, mail).catch(() =>
          console.error(
            "RescueLoop email retry will resume on the next scheduled run.",
          ),
        ),
      );
    return response;
  },
  scheduled(
    _event: ScheduledController,
    env: Cloudflare.Env,
    ctx: ExecutionContext,
  ) {
    const { mail } = integrationConfiguration(
      env as unknown as Record<string, unknown>,
    );
    if (env.DB && mail) ctx.waitUntil(drainEmailOutbox(env.DB, mail));
  },
};

export default worker;
