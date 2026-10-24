import "./sites-env.mjs";
import { loadEnvFile } from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { mailConfiguration, sendMail } from "../lib/mail.ts";
import { watsonxConfiguration, PROVIDER_KEYS } from "../lib/provider-config.ts";
import { extractWithWatsonx } from "../lib/watsonx.ts";
if (existsSync(".dev.vars")) loadEnvFile(".dev.vars");
const args = process.argv.slice(2),
  selected = args.includes("--email")
    ? "email"
    : args.includes("--ibm")
      ? "ibm"
      : "all",
  checkOnly = args.includes("--check-only");
const ownerTest = args.includes("--owner-test");
if (ownerTest) {
  process.env.MAIL_FROM ||= "RescueLoop <onboarding@resend.dev>";
  process.env.MAIL_TEST_RECIPIENT = process.env.INTEGRATION_TEST_EMAIL || "";
} else if (selected !== "ibm") {
  process.env.MAIL_TEST_RECIPIENT = "";
}
const needs =
  selected === "email"
    ? ["RESEND_API_KEY", "MAIL_FROM", "APP_ORIGIN"]
    : selected === "ibm"
      ? [
          "WATSONX_API_KEY",
          "WATSONX_PROJECT_ID",
          "WATSONX_MODEL_ID",
          "WATSONX_URL",
        ]
      : PROVIDER_KEYS.filter((k) => k !== "MAIL_TEST_RECIPIENT");
const missing = needs.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(
    "Add these values to ignored .dev.vars first: " + missing.join(", "),
  );
  process.exit(2);
}
const mail = mailConfiguration(process.env),
  ibm = watsonxConfiguration(process.env);
try {
  if (selected !== "email") {
    const draft = await extractWithWatsonx(
      "Name: Synthetic test vegetable rice. Weight: 20 kg. Category: Prepared meals. Pickup location: Synthetic test kitchen. Pickup: 15:00 to 17:00. Storage: Chilled. Dietary label: vegan. Allergens: soy.",
      ibm,
    );
    if (draft.verified !== false || draft.kg !== 20 || !draft.name)
      throw new Error(
        "IBM connected but the synthetic extraction check needs review. No secrets were uploaded.",
      );
    console.log(
      "IBM IAM authentication and live model extraction passed. The draft requires human review.",
    );
  }
  if (selected !== "ibm") {
    if (!mail) throw new Error("Check MAIL_FROM and the HTTPS APP_ORIGIN.");
    if (/@resend\.dev>?$/i.test(mail.from) && !ownerTest)
      throw new Error(
        "Use a Resend-verified domain for production email; the shared resend.dev sender is limited to owner tests.",
      );
    const recipient = process.env.INTEGRATION_TEST_EMAIL?.trim();
    if (!recipient)
      throw new Error(
        "Add INTEGRATION_TEST_EMAIL using a mailbox you control to verify delivery before activation.",
      );
    await sendMail(
      mail,
      recipient,
      "RescueLoop delivery check",
      "RescueLoop is connected to your email provider. This is a setup test requested by the app owner. No action is needed.",
      `setup/${crypto.randomUUID()}`,
    );
    console.log(
      "The email provider accepted the setup message. Check your test inbox to confirm receipt.",
    );
  }
  if (checkOnly) {
    console.log("Checks completed. No production secrets were changed.");
    process.exit(0);
  }
  const config = "outputs/cloudflare/wrangler.json";
  if (!existsSync(config))
    throw new Error(
      "Deploy RescueLoop first to generate its Cloudflare configuration.",
    );
  const state = JSON.parse(
      readFileSync(".sites-runtime/cloudflare-deployment.json", "utf8"),
    ),
    target = JSON.parse(readFileSync(config, "utf8"));
  if (target.name !== state.worker || target.account_id !== state.accountId)
    throw new Error(
      "Cloudflare deployment identity does not match this checkout.",
    );
  const values = Object.fromEntries(
    needs.map((k) => [k, process.env[k].trim()]),
  );
  if (selected !== "ibm")
    values.MAIL_TEST_RECIPIENT = ownerTest
      ? process.env.INTEGRATION_TEST_EMAIL.trim()
      : "";
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("node_modules/wrangler/bin/wrangler.js"),
      "secret",
      "bulk",
      "--config",
      config,
    ],
    {
      input: JSON.stringify(values),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    },
  );
  if (child.error || child.status !== 0)
    throw new Error(
      "Secret upload failed. Check your Wrangler login and retry. Secret values were not printed.",
    );
  console.log(
    "Verified integration settings were uploaded securely to RescueLoop. Other Worker secrets were preserved.",
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Integration setup could not complete.",
  );
  process.exitCode = 1;
}
