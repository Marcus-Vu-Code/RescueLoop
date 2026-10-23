import { env } from "cloudflare:workers";
import { handleLiveRequest } from "../../../lib/live-service";
const handler = (request: Request) => {
  if (!env.DB)
    return Response.json(
      { error: "The shared database is unavailable. Please try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  return handleLiveRequest(request, env.DB, {
    providerConfigured: !!(
      process.env.WATSONX_API_KEY &&
      process.env.WATSONX_PROJECT_ID &&
      process.env.WATSONX_MODEL_ID
    ),
  });
};
export const GET = handler;
export const POST = handler;
