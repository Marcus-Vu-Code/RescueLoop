# Public hosting for independent RescueLoop accounts

The public Worker is deployed at **https://rescueloop-live.rescueloop-campus.workers.dev**. The account's free workers.dev subdomain is `rescueloop-campus`; no purchased domain or paid plan was selected by the deployment script.

The existing `rescueloop-campus.san-jose-sta-2217.chatgpt.site` is a managed Site. This workspace currently permits `custom` and `workspace_all` audiences; **public access is unavailable**. Its platform gate cannot be removed by application code. An independent RescueLoop account does not bypass that gate.

The Vercel, Supabase, Render, Railway, and Firebase connectors are also disabled by this workspace's administrator. A direct Cloudflare deployment is supported by this codebase and uses the same Cloudflare Workers/D1 runtime, with independent email/password authentication at the application layer.

## Connect the destination account

From this project directory:

```powershell
npm run hosting:login
```

Open the Cloudflare authorization link printed by Wrangler, sign in to your own account, and review the requested access. Keep tokens out of chat and source control. Wrangler stores its credential using its normal local configuration. This step needs a human login; the app cannot invent an account or deployment credential.

## Deploy

```powershell
npm run deploy:cloudflare
```

The script checks that you are authenticated, builds the app, reuses or creates a D1 database named `rescueloop-live`, applies schema migrations, and publishes a Worker named `rescueloop-live`. It prints the actual `workers.dev` URL after deployment. New public databases start empty; local and demo data are never uploaded.

If your account has multiple Cloudflare accounts, the script stops and lists the destinations rather than choosing one. Rerun with the account ID you select:

```powershell
node scripts/deploy-cloudflare.mjs --account-id YOUR_ACCOUNT_ID
```

The generated deployment configuration is in ignored `outputs/cloudflare/wrangler.json`. The selected database identity is remembered in ignored `.sites-runtime/cloudflare-deployment.json`. Subsequent deployments preserve the database and append pending migrations.

The script does not choose a paid plan, accept billing terms, or register a domain. Password hashing and production traffic need an adequate Worker CPU budget; verify sign-up and sign-in on your chosen Cloudflare plan before inviting users. A custom domain can be connected through your Cloudflare account later.

## Validate the live application

1. Open the printed public URL in a fresh browser. The landing page must load without ChatGPT sign-in.
2. Register a donor and a receiver using separate email addresses. Save each recovery code privately.
3. Publish both directory profiles; configure the receiver's capacity, storage, dietary restrictions, time zone, and receiving hours.
4. Request and accept a partnership. Publish verified food using a real future pickup window.
5. Have the receiver request it, the donor approve, and the receiver confirm collection after the agreed window starts.
6. Verify notifications and the private pickup conversation from both accounts. Check the collection receipt and CSV export.

## Optional IBM extraction

Set `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_MODEL_ID`, and `WATSONX_URL` as Worker secrets using Wrangler's secret input prompt and the generated configuration. Never pass secrets as shell arguments or commit them. The app otherwise uses the clearly labeled offline parser. A successful authenticated IBM request still needs to be verified with the owner's credentials.

## What requires another provider

Notifications currently arrive **inside RescueLoop**. There is no email, SMS, or push delivery claim. Password recovery uses a private, single-use recovery code; no reset email is sent. Email ownership and organization affiliation are not verified. A transactional email provider would be needed to add verified email and email-based recovery later.
