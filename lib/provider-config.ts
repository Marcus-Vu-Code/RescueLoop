import { mailConfiguration } from "./mail.ts";
import { type WatsonxConfig } from "./watsonx.ts";
export const PROVIDER_KEYS = [
  "RESEND_API_KEY",
  "MAIL_FROM",
  "APP_ORIGIN",
  "MAIL_TEST_RECIPIENT",
  "WATSONX_API_KEY",
  "WATSONX_PROJECT_ID",
  "WATSONX_MODEL_ID",
  "WATSONX_URL",
] as const;
export function providerValues(bindings: Record<string, unknown> = {}) {
  return Object.fromEntries(
    PROVIDER_KEYS.map((key) => [
      key,
      typeof bindings[key] === "string" ? bindings[key] : process.env[key],
    ]),
  ) as Record<string, string | undefined>;
}
export function watsonxConfiguration(
  values: Record<string, string | undefined>,
): WatsonxConfig | null {
  const apiKey = values.WATSONX_API_KEY?.trim(),
    projectId = values.WATSONX_PROJECT_ID?.trim(),
    modelId = values.WATSONX_MODEL_ID?.trim();
  if (!apiKey || !projectId || !modelId) return null;
  return {
    apiKey,
    projectId,
    modelId,
    url: values.WATSONX_URL?.trim() || "https://us-south.ml.cloud.ibm.com",
  };
}
export function integrationConfiguration(
  bindings: Record<string, unknown> = {},
) {
  const values = providerValues(bindings);
  return {
    mail: mailConfiguration(values),
    watsonx: watsonxConfiguration(values),
  };
}
