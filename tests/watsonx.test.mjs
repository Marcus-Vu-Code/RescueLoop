import test from "node:test";
import assert from "node:assert/strict";
import { extractWithWatsonx, normalizeModelDraft } from "../lib/watsonx.ts";
const config = {
  apiKey: "test-key",
  projectId: "test-project",
  modelId: "test-model",
  url: "https://us-south.ml.cloud.ibm.com",
};
test("model output cannot auto-approve or overwrite source metadata", () => {
  const draft = normalizeModelDraft(
    JSON.stringify({
      name: "Salad",
      kg: 12,
      verified: true,
      status: "available",
      source: "untrusted",
      diet: [],
      allergens: null,
    }),
    "original donor note",
  );
  assert.equal(draft.verified, false);
  assert.equal(draft.status, undefined);
  assert.equal(draft.source, "original donor note");
  assert.equal(draft.allergens, "unknown");
  assert.equal(draft.storage, undefined);
  assert.throws(() => normalizeModelDraft('{"kg":-1}', "note"));
  assert.throws(() => normalizeModelDraft('{"start":"25:99"}', "note"));
  assert.throws(() => normalizeModelDraft('{"storage":"Frozen"}', "note"));
  assert.throws(() => normalizeModelDraft("not json", "note"));
});
test("IBM adapter authenticates with IAM, sends bounded deterministic chat, and validates its draft", async () => {
  const requests = [];
  const fetcher = async (url, init) => {
    requests.push({ url, init });
    return requests.length === 1
      ? Response.json({ access_token: "fake-token" })
      : Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  name: "Rice",
                  kg: 20,
                  category: "Prepared meals",
                  location: "Dining Commons",
                  start: "15:00",
                  end: "17:00",
                  storage: "Chilled",
                  diet: ["vegan"],
                  allergens: "soy",
                }),
              },
            },
          ],
        });
  };
  const draft = await extractWithWatsonx("original note", config, fetcher);
  assert.equal(draft.verified, false);
  assert.equal(draft.kg, 20);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://iam.cloud.ibm.com/identity/token");
  assert.ok(String(requests[0].init.body).includes("apikey=test-key"));
  assert.equal(requests[1].init.headers.Authorization, "Bearer fake-token");
  const body = JSON.parse(requests[1].init.body);
  assert.equal(body.model_id, "test-model");
  assert.equal(body.temperature, 0);
  assert.equal(body.messages[1].content, "original note");
  assert.ok(!JSON.stringify(draft).includes("test-key"));
});
test("IBM adapter blocks unexpected endpoints before sending credentials", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      extractWithWatsonx(
        "note",
        { ...config, url: "https://evil.example" },
        async () => {
          calls++;
          return Response.json({});
        },
      ),
    /Invalid IBM/,
  );
  assert.equal(calls, 0);
});
test("provider failure is actionable and never creates a draft", async () => {
  await assert.rejects(
    () =>
      extractWithWatsonx(
        "note",
        config,
        async () => new Response("", { status: 401 }),
      ),
    /IBM authentication failed/,
  );
  let n = 0;
  await assert.rejects(
    () =>
      extractWithWatsonx("note", config, async () =>
        ++n === 1
          ? Response.json({ access_token: "fake" })
          : Response.json({ choices: [{ message: { content: "invalid" } }] }),
      ),
    /invalid draft/,
  );
});
