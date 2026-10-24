import { extractWithWatsonx } from "../../../lib/watsonx";
import { env } from "cloudflare:workers";
import {
  accountForRequest,
  throttle,
  AppError,
} from "../../../lib/live-service";
import { integrationConfiguration } from "../../../lib/provider-config";

function configuration() {
  return integrationConfiguration(env as unknown as Record<string, unknown>)
    .watsonx;
}
const noStore = { "Cache-Control": "no-store" };
export async function GET() {
  return Response.json(
    {
      configured: !!configuration(),
      provider: configuration()
        ? "IBM watsonx.ai"
        : "offline rule-based parser",
    },
    { headers: noStore },
  );
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json(
      { error: "Submit notes from this workspace." },
      { status: 403, headers: noStore },
    );
  const config = configuration();
  if (!config)
    return Response.json(
      {
        error:
          "IBM extraction is not configured. Use the offline parser or manual entry.",
      },
      { status: 503, headers: noStore },
    );
  const account = env.DB ? await accountForRequest(request, env.DB) : null;
  if (!env.DB || !account)
    return Response.json(
      { error: "Sign in to this workspace to use IBM extraction." },
      { status: 401, headers: noStore },
    );
  try {
    await throttle(
      env.DB,
      request,
      "ibm-extraction",
      account.id,
      10,
      new Date(),
    );
    let length = 0;
    const chunks: Uint8Array[] = [];
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Enter a food note.");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 24000) {
        await reader.cancel();
        return Response.json(
          { error: "Note is too large. Limit notes to 6,000 characters." },
          { status: 413, headers: noStore },
        );
      }
      chunks.push(value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    let input;
    try {
      input = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return Response.json(
        { error: "Send a JSON object with a note." },
        { status: 400, headers: noStore },
      );
    }
    if (
      typeof input?.note !== "string" ||
      !input.note.trim() ||
      input.note.length > 6000
    )
      return Response.json(
        { error: "Enter a food note between 1 and 6,000 characters." },
        { status: 400, headers: noStore },
      );
    const draft = await extractWithWatsonx(input.note, config);
    return Response.json(
      { draft, provider: "IBM watsonx.ai", requiresReview: true },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof AppError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers: noStore },
      );
    const message = error instanceof Error ? error.message : "";
    const safe =
      message.startsWith("IBM ") ||
      message.startsWith("The model ") ||
      message === "Invalid IBM regional endpoint."
        ? message
        : "Extraction timed out or could not be completed. Try manual entry.";
    return Response.json({ error: safe }, { status: 502, headers: noStore });
  }
}
