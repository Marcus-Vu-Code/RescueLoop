import "./sites-env.mjs";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
const root = process.cwd(),
  wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
const stateFile = path.join(root, ".sites-runtime/cloudflare-deployment.json");
const accountFlag = process.argv.indexOf("--account-id");
if (accountFlag >= 0) {
  const account = process.argv[accountFlag + 1];
  if (!/^[a-f0-9]{32}$/i.test(account || ""))
    throw new Error("Pass a valid Cloudflare account ID.");
  process.env.CLOUDFLARE_ACCOUNT_ID = account;
}
const name = "rescueloop-live";
function run(args, capture = false) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || "");
    throw new Error(
      "Cloudflare command failed. Review the Wrangler error above. For a first deployment, configure a workers.dev subdomain in Cloudflare; for expired credentials, run npm run hosting:login.",
    );
  }
  return result.stdout || "";
}
function parseJSON(output) {
  try {
    return JSON.parse(output);
  } catch {
    const match = output.match(/(\[[\s\S]*\]|\{[\s\S]*\})\s*$/);
    if (!match)
      throw new Error(
        "Cloudflare did not return valid JSON. No deployment was attempted.",
      );
    return JSON.parse(match[1]);
  }
}
const identity = parseJSON(run(["whoami", "--json"], true));
if (!identity.loggedIn)
  throw new Error("Sign in first with npm run hosting:login.");
const accounts = identity.accounts || [];
if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  if (accounts.length !== 1) {
    console.log(
      "Choose the destination account, then run this command with --account-id <id>.",
    );
    for (const account of accounts)
      console.log(`${account.name}: ${account.id}`);
    process.exit(2);
  }
  process.env.CLOUDFLARE_ACCOUNT_ID = accounts[0].id;
}
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const built = spawnSync(
  process.execPath,
  [path.join(root, "scripts/run-framework.mjs"), "build"],
  { cwd: root, env: process.env, stdio: "inherit" },
);
if (built.status !== 0)
  throw new Error("The app build failed; deployment stopped.");
mkdirSync(path.join(root, "outputs/cloudflare"), { recursive: true });
const configPath = path.join(root, "outputs/cloudflare/wrangler.json");
const output = JSON.parse(
  readFileSync(path.join(root, "dist/server/wrangler.json"), "utf8"),
);
// Keep the framework's generated runtime configuration, but bind resources in
// the user's Cloudflare account instead of the managed Sites placeholders.
const config = {
  ...output,
  name,
  account_id: accountId,
  main: path.join(root, "dist/server/index.js"),
  assets: { ...output.assets, directory: path.join(root, "dist/client") },
  workers_dev: true,
  triggers: { crons: ["*/5 * * * *"] },
  d1_databases: [],
  services: [],
};
delete config.topLevelName;
delete config.dev;
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
const databases = parseJSON(
  run(["d1", "list", "--json", "--config", configPath], true),
);
const saved = existsSync(stateFile)
  ? JSON.parse(readFileSync(stateFile, "utf8"))
  : null;
if (saved && saved.accountId !== accountId)
  throw new Error(
    "This checkout has a deployment for a different account. Review .sites-runtime/cloudflare-deployment.json before choosing a new destination.",
  );
let database =
  databases.find((db) => db.uuid === saved?.databaseId) ||
  databases.find((db) => db.name === name);
if (!database) {
  run([
    "d1",
    "create",
    name,
    "--binding",
    "DB",
    "--update-config",
    "--config",
    configPath,
  ]);
  const createdConfig = JSON.parse(readFileSync(configPath, "utf8"));
  const binding = createdConfig.d1_databases?.find((db) => db.binding === "DB");
  if (!binding?.database_id)
    throw new Error(
      "Database creation needs reconciliation. Run d1 list before retrying.",
    );
  database = { uuid: binding.database_id, name };
}
if (!/^[a-f0-9-]{36}$/i.test(database.uuid))
  throw new Error("Cloudflare returned an invalid database ID.");
config.d1_databases = [
  {
    binding: "DB",
    database_name: database.name,
    database_id: database.uuid,
    migrations_dir: path.join(root, "drizzle"),
    migrations_table: "rescueloop_migrations",
  },
];
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
writeFileSync(
  stateFile,
  JSON.stringify(
    { accountId, databaseId: database.uuid, worker: name, configPath },
    null,
    2,
  ) + "\n",
);
run(["d1", "migrations", "apply", "DB", "--remote", "--config", configPath]);
run(["deploy", "--config", configPath]);
console.log(
  "RescueLoop deployed. Use the exact workers.dev URL printed above. Accounts, sessions, and shared records are stored in your D1 database.",
);
