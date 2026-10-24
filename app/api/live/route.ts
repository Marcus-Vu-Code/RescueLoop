import { env, waitUntil } from "cloudflare:workers";
import { handleLiveRequest } from "../../../lib/live-service";
import { integrationConfiguration } from "../../../lib/provider-config";
const handler = (request: Request) => {
  if (!env.DB)
    return Response.json(
      { error: "The shared database is unavailable. Please try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const providers = integrationConfiguration(
    env as unknown as Record<string, unknown>,
  );
  return handleLiveRequest(request, env.DB, {
    providerConfigured: !!providers.watsonx,
    mail: providers.mail,
    defer: waitUntil,
  });
};
export const GET = handler;
export const POST = handler;
