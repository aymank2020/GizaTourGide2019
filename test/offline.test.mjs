import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { setupOffline } from "../offline.mjs";

const code = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const scope = "https://guide.example/GizaTourGide2019/";
function worker({ failInstall = false } = {}) {
  const handlers = new Map();
  const stored = new Map();
  const removed = [];
  const fetched = [];
  let claimed = false;
  let skipped = false;
  const caches = {
    async open(name) {
      if (!stored.has(name)) stored.set(name, new Map());
      const entries = stored.get(name);
      return {
        async addAll(requests) {
          if (failInstall) throw new Error("missing shell file");
          for (const request of requests)
            entries.set(request.url, new Response(request.url));
        },
        async match(url) {
          return entries.get(url);
        },
      };
    },
    async keys() {
      return [...stored.keys()];
    },
    async delete(name) {
      removed.push(name);
      return stored.delete(name);
    },
  };
  vm.runInNewContext(code, {
    URL,
    Request,
    caches,
    self: {
      registration: { scope },
      addEventListener(name, fn) {
        handlers.set(name, fn);
      },
      clients: {
        async claim() {
          claimed = true;
        },
      },
      skipWaiting() {
        skipped = true;
      },
    },
    async fetch(request) {
      fetched.push(request.url);
      return new Response("network");
    },
  });
  return {
    handlers,
    stored,
    removed,
    fetched,
    get claimed() {
      return claimed;
    },
    get skipped() {
      return skipped;
    },
    async lifecycle(name) {
      let pending;
      handlers.get(name)({
        waitUntil(value) {
          pending = value;
        },
      });
      await pending;
    },
    async request(url, method = "GET") {
      let pending;
      handlers.get("fetch")({
        request: new Request(url, { method }),
        respondWith(value) {
          pending = value;
        },
      });
      return pending ? (await pending).text() : null;
    },
  };
}

test("offline worker caches only six scoped shell files and serves directory/index with queries", async () => {
  const runtime = worker();
  await runtime.lifecycle("install");
  const entries = [...runtime.stored.values()][0];
  assert.equal(entries.size, 6);
  assert.equal(await runtime.request(scope + "?lang=en"), scope);
  assert.equal(
    await runtime.request(scope + "index.html?visit=1"),
    scope + "index.html",
  );
  assert.equal(
    await runtime.request(scope + "places.mjs"),
    scope + "places.mjs",
  );
  assert.equal(runtime.fetched.length, 0);
});
test("worker leaves external, neighboring, unknown and mutation requests on their normal network path", async () => {
  const runtime = worker();
  for (const url of [
    "https://egymonuments.gov.eg/",
    "https://guide.example/neighbor/",
    scope + "missing.html",
    scope + "sw.js",
  ])
    assert.equal(await runtime.request(url), null);
  assert.equal(await runtime.request(scope + "index.html", "POST"), null);
});
test("activation removes only this scope's obsolete caches; waiting update requires an explicit message", async () => {
  const runtime = worker();
  runtime.stored.set("giza-guide:/GizaTourGide2019/:old", new Map());
  runtime.stored.set("giza-guide:/neighbor/:old", new Map());
  runtime.stored.set("unrelated-app", new Map());
  await runtime.lifecycle("install");
  assert.equal(runtime.skipped, false);
  await runtime.lifecycle("activate");
  assert.deepEqual(runtime.removed, ["giza-guide:/GizaTourGide2019/:old"]);
  assert.equal(runtime.claimed, true);
  assert.equal(runtime.stored.has("unrelated-app"), true);
  runtime.handlers.get("message")({ data: { type: "OTHER" } });
  assert.equal(runtime.skipped, false);
  runtime.handlers.get("message")({ data: { type: "ACTIVATE_UPDATE" } });
  assert.equal(runtime.skipped, true);
});
test("failed shell installation rejects and preserves the previous version", async () => {
  const runtime = worker({ failInstall: true });
  runtime.stored.set("giza-guide:/GizaTourGide2019/:old", new Map());
  await assert.rejects(runtime.lifecycle("install"), /missing shell file/);
  assert.deepEqual(
    [...runtime.stored.keys()],
    ["giza-guide:/GizaTourGide2019/:old"],
  );
  assert.equal(runtime.claimed, false);
});
test("unsupported or denied registration reports unavailability rather than offline readiness", async () => {
  for (const sw of [
    null,
    {
      addEventListener() {},
      register() {
        return Promise.reject(new Error("denied"));
      },
    },
  ]) {
    const states = [];
    setupOffline({
      navigator: { onLine: true, serviceWorker: sw },
      window: { isSecureContext: true, addEventListener() {} },
      onChange(value) {
        states.push(value.state);
      },
      onUpdate() {},
    });
    await new Promise(setImmediate);
    assert.equal(states.at(-1), "unavailable");
    assert.ok(!states.includes("ready"));
  }
});
test("an unrelated root worker does not imply that this guide has an offline copy", async () => {
  const states = [];
  setupOffline({
    navigator: {
      onLine: true,
      serviceWorker: {
        controller: { scriptURL: "https://other.example/sw.js" },
        addEventListener() {},
        async register() {
          return { active: {}, addEventListener() {} };
        },
      },
    },
    window: { isSecureContext: true, addEventListener() {} },
    onChange(value) {
      states.push(value.state);
    },
    onUpdate() {},
  });
  await new Promise(setImmediate);
  assert.deepEqual(states, ["preparing", "preparing"]);
});
test("an installation already in progress is observed, including first-install failure", async () => {
  const states = [];
  const worker = {
    state: "installing",
    addEventListener(name, fn) {
      this.changed = fn;
    },
  };
  setupOffline({
    navigator: {
      onLine: true,
      serviceWorker: {
        addEventListener() {},
        async register() {
          return { installing: worker, addEventListener() {} };
        },
      },
    },
    window: { isSecureContext: true, addEventListener() {} },
    onChange(value) {
      states.push(value.state);
    },
    onUpdate() {},
  });
  await new Promise(setImmediate);
  worker.state = "redundant";
  worker.changed();
  assert.equal(states.at(-1), "unavailable");
});
