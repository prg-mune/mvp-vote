import assert from "node:assert/strict";
import test from "node:test";

async function request(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function render(pathname = "/") {
  return request(pathname, {
    headers: { accept: "text/html" },
  });
}

async function loginAsAdmin() {
  const login = await request("/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "preview" }),
  });
  assert.equal(login.status, 200);

  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  return cookie;
}

async function createTestEvent(cookie, name = "API Lifecycle Test") {
  const created = await request("/api/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      name,
      description: "Temporary test event",
      password: "guest-pass",
      presentationCount: 1,
    }),
  });
  assert.equal(created.status, 201);
  return (await created.json()).event;
}

async function addSixCandidates(cookie, eventId) {
  const response = await request(`/api/events/${eventId}/candidates`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      candidates: [
        { name: "候補者 A", description: "A" },
        { name: "候補者 B", description: "B" },
        { name: "候補者 C", description: "C" },
        { name: "候補者 D", description: "D" },
        { name: "候補者 E", description: "E" },
        { name: "候補者 F", description: "F" },
      ],
    }),
  });
  assert.equal(response.status, 201);
  return (await response.json()).candidates;
}

test("redirects the root page to admin", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")).pathname, "/admin");
});

test("serves a health check endpoint", async () => {
  const response = await request("/api/health");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test("keeps the admin event list behind password login", async () => {
  const response = await render("/admin");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /管理者ログイン/);
  assert.doesNotMatch(html, /イベント一覧/);
  assert.doesNotMatch(html, /新規イベント作成/);
});

test("rejects unauthenticated event updates", async () => {
  const response = await request("/api/events/demo-2026-mvp", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Unauthorized" }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "管理者ログインが必要です。",
  });
});

test("allows admins to bulk add candidates", async () => {
  const cookie = await loginAsAdmin();
  const event = await createTestEvent(cookie, "Bulk Candidate Test");

  const bulk = await request(`/api/events/${event.id}/candidates`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      candidates: [
        {
          name: "山田 太郎",
          description: "チームを支えた推進力",
          imagePath: "https://example.com/yamada.jpg",
        },
        { name: "佐藤 花子", description: "改善提案で成果に貢献" },
      ],
    }),
  });
  assert.equal(bulk.status, 201);
  const { candidates } = await bulk.json();
  assert.equal(candidates.length, 2);
  assert.deepEqual(
    candidates.map((candidate) => candidate.name),
    ["山田 太郎", "佐藤 花子"],
  );
  assert.equal(candidates[0].imagePath, "https://example.com/yamada.jpg");
  assert.equal(candidates[1].imagePath, "");

  const deleted = await request(`/api/events/${event.id}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(deleted.status, 200);
});

test("validates event passwords before voting", async () => {
  const cookie = await loginAsAdmin();
  const event = await createTestEvent(cookie, "Password Validation Test");

  const invalid = await request(`/api/events/${event.id}/password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "wrong-pass" }),
  });
  assert.equal(invalid.status, 401);

  const valid = await request(`/api/events/${event.id}/password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "guest-pass" }),
  });
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).ok, true);

  const deleted = await request(`/api/events/${event.id}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(deleted.status, 200);
});

test("allows admins to delete draft candidates", async () => {
  const cookie = await loginAsAdmin();
  const event = await createTestEvent(cookie, "Delete Candidate Test");
  const candidates = await addSixCandidates(cookie, event.id);

  const deletedCandidate = await request(
    `/api/events/${event.id}/candidates/${candidates[1].id}`,
    {
      method: "DELETE",
      headers: { cookie },
    },
  );
  assert.equal(deletedCandidate.status, 200);
  const { candidates: remainingCandidates } = await deletedCandidate.json();
  assert.equal(remainingCandidates.length, 5);
  assert.deepEqual(
    remainingCandidates.map((candidate) => candidate.displayOrder),
    [1, 2, 3, 4, 5],
  );
  assert.equal(
    remainingCandidates.some((candidate) => candidate.id === candidates[1].id),
    false,
  );

  const deleted = await request(`/api/events/${event.id}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(deleted.status, 200);
});

test("allows admins to reset vote results and initialize events", async () => {
  const cookie = await loginAsAdmin();
  const event = await createTestEvent(cookie);
  await addSixCandidates(cookie, event.id);

  const reset = await request(`/api/events/${event.id}/reset`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(reset.status, 200);
  assert.equal((await reset.json()).event.status, "draft");
  const afterReset = await request(`/api/events/${event.id}`, {
    headers: { cookie },
  });
  assert.equal(afterReset.status, 200);
  assert.equal((await afterReset.json()).candidates.length, 6);

  const initialized = await request(`/api/events/${event.id}/initialize`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(initialized.status, 200);
  const initializedEvent = (await initialized.json()).event;
  assert.equal(initializedEvent.status, "draft");
  assert.equal(initializedEvent.presentationCount, 1);
  assert.equal(initializedEvent.voteSelectionCount, 1);
  const afterInitialize = await request(`/api/events/${event.id}`, {
    headers: { cookie },
  });
  assert.equal(afterInitialize.status, 200);
  assert.equal((await afterInitialize.json()).candidates.length, 0);

  const deleted = await request(`/api/events/${event.id}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(deleted.status, 200);

  const missing = await request(`/api/events/${event.id}`);
  assert.equal(missing.status, 404);
});

test("supports voting for multiple MVP candidates", async () => {
  const cookie = await loginAsAdmin();
  const event = await createTestEvent(cookie, "Multiple MVP Vote Test");

  const updated = await request(`/api/events/${event.id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ voteSelectionCount: 2 }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).event.voteSelectionCount, 2);

  const candidates = await addSixCandidates(cookie, event.id);
  const opened = await request(`/api/events/${event.id}/status`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ status: "voting" }),
  });
  assert.equal(opened.status, 200);

  const vote = await request(`/api/events/${event.id}/votes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      password: "guest-pass",
      browserId: "multi-browser",
      nickname: "multi voter",
      candidateIds: [candidates[0].id, candidates[1].id],
    }),
  });
  assert.equal(vote.status, 200);
  assert.deepEqual((await vote.json()).vote.candidateIds, [
    candidates[0].id,
    candidates[1].id,
  ]);

  const results = await request(`/api/events/${event.id}/results`);
  assert.equal(results.status, 200);
  const ranked = (await results.json()).results;
  assert.equal(
    ranked.find((candidate) => candidate.id === candidates[0].id).votes,
    1,
  );
  assert.equal(
    ranked.find((candidate) => candidate.id === candidates[1].id).votes,
    1,
  );
  assert.equal(
    ranked.find((candidate) => candidate.id === candidates[2].id).votes,
    0,
  );

  const deleted = await request(`/api/events/${event.id}`, {
    method: "DELETE",
    headers: { cookie },
  });
  assert.equal(deleted.status, 200);
});
