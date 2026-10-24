import { env } from "cloudflare:workers";
import { integrationConfiguration } from "../../../lib/provider-config";
export function GET() {
  const { mail, watsonx } = integrationConfiguration(
    env as unknown as Record<string, unknown>,
  );
  return Response.json(
    {
      emailConfigured: !!mail,
      emailMode: !mail
        ? "disabled"
        : mail.testRecipient
          ? "owner-test"
          : "production",
      ibmConfigured: !!watsonx,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
