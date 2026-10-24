# Email and IBM activation

Provider keys belong in ignored `.dev.vars` for local setup and in encrypted Cloudflare Worker secrets for production. Never paste keys into chat, put them in a URL, commit them, or add them to browser code. The setup script prints status and missing key names only.

## Accounts and email domain

Create/sign in to [Resend](https://resend.com/signup) and [IBM watsonx.ai](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx). The account owner enters credentials, reviews permissions, and accepts any provider terms. A plan upgrade is not part of these scripts.

In Resend create a sending API key. For production delivery, add a domain you own, install its DNS records, and wait for verification. Set `MAIL_FROM` to an address on that domain. A `workers.dev` address is not a domain you own for email verification. See [Resend verified domains](https://resend.com/docs/dashboard/domains/introduction).

Without a domain, the application supports an **owner-only delivery test** using `onboarding@resend.dev`. The recipient must be the address used to sign up for Resend. The server enforces that restriction and the UI identifies test mode. This does not enable email to other users.

## Local values

```text
RESEND_API_KEY=<your sending API key>
MAIL_FROM=RescueLoop <updates@your-verified-domain.example>
APP_ORIGIN=https://rescueloop-live.rescueloop-campus.workers.dev
INTEGRATION_TEST_EMAIL=<a mailbox you control>
WATSONX_API_KEY=<your IBM Cloud key>
WATSONX_PROJECT_ID=<the project UUID>
WATSONX_MODEL_ID=<an available chat model ID>
WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

For IBM, create a project and associate a watsonx.ai Runtime service in the same region. In Prompt Lab, choose a model supported by your plan and use View code to obtain its exact model ID. Create/review the IBM Cloud API key through IAM. The project, key permissions, model availability, and region must agree. See [IBM API documentation](https://cloud.ibm.com/docs/apis/watsonx-ai).

## Check and activate

Run from the application directory after public deployment:

```powershell
# Activate IBM independently.
node --experimental-strip-types scripts/configure-integrations.mjs --ibm
# Production email with a verified sending domain.
node --experimental-strip-types scripts/configure-integrations.mjs --email
# No-domain alternative, restricted to INTEGRATION_TEST_EMAIL.
node --experimental-strip-types scripts/configure-integrations.mjs --email --owner-test
```

Add `--check-only` to test without changing production secrets. Each email check sends one message to `INTEGRATION_TEST_EMAIL`; IBM checks send one synthetic inventory note. Email API acceptance is not proof of inbox placement: check the mailbox and provider delivery activity. The script refuses to activate IBM unless extraction produces a valid unverified draft. It uploads secrets through Wrangler stdin, preserves unrelated secrets, and checks the saved deployment identity.

Switching from owner test to production with `--email` clears the owner restriction and requires a verified sender. Local `.dev.vars` should then use the production sender and a blank `MAIL_TEST_RECIPIENT`.

## User experience

In **Notifications**, request a verification email, open its link, and explicitly confirm the address. Then enable email notifications and choose the categories to receive. Verification and opt-in are separate. Existing accounts stay opted out. Emails contain a generic update and a sign-in link; private conversation text stays in the application.

**Forgot password?** offers an email reset and the recovery-code fallback. Only verified addresses receive reset emails. Requests return the same public response for known and unknown addresses; production sends run after the response. Reset links expire after 30 minutes, work once, revoke existing sessions, rotate the recovery code, and require a fresh sign-in. Verification links expire after 24 hours. Password changes revoke outstanding reset links. The database stores hashed tokens; links use URL fragments, which the client removes immediately.

When IBM is configured, **Add surplus → From a note** identifies watsonx.ai and sends only the deliberately submitted note. Drafts stay unverified, missing safety facts remain unknown, and provider errors never create listings. Extraction is limited to 10 requests per account in 15 minutes. The offline parser remains available when IBM is unconfigured.

## Reliable delivery

An insert trigger enqueues notification emails within the same D1 transaction. The queue requires a verified address, opt-in, and the selected category. Workers claim jobs atomically, recheck preferences, and send with a stable Resend idempotency key. Provider acceptance is recorded with its message ID. Temporary failures back off up to six attempts; permanent failures stop, and jobs expire before the provider's 24-hour idempotency window. Opt-out cancels pending jobs.

Direct Cloudflare deployment installs a five-minute Cron Trigger and also tries delivery after POST requests. Delivery does not require an open browser. `rl_email_outbox` records status and safe error codes without API keys, private message text, or raw reset tokens. Scripts do not provision paid plans. Provider quotas and spam filtering still apply. Other users retain in-app notifications and recovery codes during owner-test mode.

The managed Sites copy retains its private audience. Direct Cloudflare secrets do not configure that separate deployment.
