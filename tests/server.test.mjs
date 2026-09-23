import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJournalHandler, createJournalServer } from "../server.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "response-map-server-"));
  const rootDirectory = join(directory, "public");
  await mkdir(join(rootDirectory, "src"), { recursive: true });
  await mkdir(join(rootDirectory, ".git"));
  await Promise.all([
    writeFile(join(rootDirectory, "index.html"), "<!doctype html><title>Journal ✓</title>"),
    writeFile(join(rootDirectory, "styles.css"), "body { color: navy; }"),
    writeFile(join(rootDirectory, "favicon.svg"), '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    ...["app", "model", "charts", "portability"].map((name) => writeFile(join(rootDirectory, "src", `${name}.mjs`), `export const name = "${name}";`)),
    writeFile(join(rootDirectory, "server.mjs"), "SERVER_SOURCE_TEST_SENTINEL"),
    writeFile(join(rootDirectory, ".env"), "ENVIRONMENT_TEST_SENTINEL"),
    writeFile(join(rootDirectory, ".git", "config"), "GIT_CONFIG_TEST_SENTINEL"),
    writeFile(join(rootDirectory, "journal-backup.json"), "BACKUP_TEST_SENTINEL"),
    writeFile(join(directory, "outside.txt"), "OUTSIDE_ROOT_TEST_SENTINEL")
  ]);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, rootDirectory, handler: createJournalHandler({ rootDirectory }) };
}

async function request(handler, { method = "GET", url = "/", host = "127.0.0.1:4173", port = 4173 } = {}) {
  const result = { status: null, headers: null, body: null, ends: 0 };
  const response = {
    writeHead(status, headers) { result.status = status; result.headers = headers; return this; },
    end(body) { result.body = body == null ? "" : Buffer.from(body).toString("utf8"); result.ends += 1; return this; }
  };
  await handler({ method, url, headers: { host }, socket: { localPort: port } }, response);
  assert.equal(result.ends, 1, "the handler completes exactly one response");
  return result;
}

test("server module imports without listening and creates an HTTP server on demand", () => {
  const server = createJournalServer();
  assert.equal(server.listening, false);
  assert.equal(server.requestTimeout, 15_000);
  assert.equal(server.headersTimeout, 15_000);
  assert.equal(server.keepAliveTimeout, 5_000);
  assert.equal(server.maxHeadersCount, 50);
});

test("only explicit browser assets are served with correct MIME types", async (t) => {
  const { handler } = await fixture(t);
  const routes = [
    ["/", "text/html; charset=utf-8"],
    ["/index.html", "text/html; charset=utf-8"],
    ["/styles.css", "text/css; charset=utf-8"],
    ["/favicon.svg", "image/svg+xml"],
    ...["app", "model", "charts", "portability"].map((name) => [`/src/${name}.mjs`, "text/javascript; charset=utf-8"])
  ];
  for (const [url, type] of routes) {
    const result = await request(handler, { url });
    assert.equal(result.status, 200, url);
    assert.equal(result.headers["Content-Type"], type, url);
    assert.equal(result.headers["Content-Length"], Buffer.byteLength(result.body), url);
  }
  assert.equal((await request(handler, { url: "/styles.css?v=1" })).status, 200);
});

test("repository, configuration, backup files, and directories cannot be downloaded", async (t) => {
  const { handler } = await fixture(t);
  for (const url of ["/.git/config", "/.env", "/journal-backup.json", "/server.mjs", "/README.md", "/package.json", "/src/", "/tests/server.test.mjs"]) {
    const result = await request(handler, { url });
    assert.equal(result.status, 404, url);
    assert.equal(result.body, "Not found", url);
  }
});

test("encoded and plain traversal paths do not escape the public-file allowlist", async (t) => {
  const { handler } = await fixture(t);
  for (const url of [
    "/../outside.txt", "/%2e%2e/outside.txt", "/src/../../outside.txt", "/%2e%2e%2foutside.txt",
    "/%252e%252e/outside.txt", "/src/../.env", "/src\\..\\.env", "/index.html%00"
  ]) {
    const result = await request(handler, { url });
    assert.equal(result.status, 404, url);
    assert.equal(result.body, "Not found");
  }
  for (const url of ["/%E0%A4%A", "//example.com/index.html", "http://localhost:4173/index.html"]) {
    assert.equal((await request(handler, { url })).status, 400, url);
  }
});

test("Host must name localhost or 127.0.0.1 at the actual bound port", async (t) => {
  const { handler } = await fixture(t);
  for (const host of ["127.0.0.1:4173", "localhost:4173", "LOCALHOST:4173"]) {
    assert.equal((await request(handler, { host })).status, 200, host);
  }
  for (const host of [
    "attacker.example:4173", "localhost.attacker.example:4173", "127.0.0.1.attacker.example:4173",
    "localhost:4174", "127.0.0.1", "localhost", "localhost:4173@attacker.example", "[::1]:4173",
    " localhost:4173", "", null, ["localhost:4173"]
  ]) {
    assert.equal((await request(handler, { host })).status, 421, String(host));
  }
  assert.equal((await request(handler, { host: "localhost:54321", port: 54321 })).status, 200);
  assert.equal((await request(handler, { host: "localhost", port: 80 })).status, 200);
  assert.equal((await request(handler, { host: "localhost:80", port: 80 })).status, 200);
});

test("HEAD returns the GET headers without a body, including for errors", async (t) => {
  const { handler } = await fixture(t);
  const get = await request(handler);
  const head = await request(handler, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.deepEqual(head.headers, get.headers);
  assert.equal(head.body, "");
  for (const options of [{ url: "/.env" }, { host: "attacker.example:4173" }, { url: "/%broken" }]) {
    const result = await request(handler, { ...options, method: "HEAD" });
    assert.equal(result.body, "");
    assert.ok(result.headers["Content-Length"] > 0);
  }
});

test("write methods are rejected and cannot alter application files", async (t) => {
  const { handler } = await fixture(t);
  const before = (await request(handler)).body;
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE"]) {
    const result = await request(handler, { method });
    assert.equal(result.status, 405, method);
    assert.equal(result.headers.Allow, "GET, HEAD");
    assert.equal(result.headers.Connection, "close");
  }
  assert.equal((await request(handler)).body, before);
});

test("all responses carry privacy headers and CSP permits chart styles but not inline scripts", async (t) => {
  const { handler } = await fixture(t);
  for (const options of [{}, { url: "/.env" }, { host: "attacker.example:4173" }, { method: "POST" }]) {
    const { headers } = await request(handler, options);
    assert.equal(headers["Cache-Control"], "no-store");
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.equal(headers["Referrer-Policy"], "no-referrer");
    assert.equal(headers["Cross-Origin-Resource-Policy"], "same-origin");
    const policy = Object.fromEntries(headers["Content-Security-Policy"].split(";").map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/);
      return [name, values];
    }));
    assert.deepEqual(policy["script-src"], ["'self'"]);
    assert.deepEqual(policy["script-src-attr"], ["'none'"]);
    assert.deepEqual(policy["style-src"], ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(policy["connect-src"], ["'none'"]);
    assert.deepEqual(policy["frame-ancestors"], ["'none'"]);
    assert.deepEqual(policy["form-action"], ["'none'"]);
  }
});

test("allowlisted files cannot use symlinks to read outside the app root", async (t) => {
  const { handler, directory, rootDirectory } = await fixture(t);
  await rm(join(rootDirectory, "src", "charts.mjs"));
  await symlink(join(directory, "outside.txt"), join(rootDirectory, "src", "charts.mjs"));
  const result = await request(handler, { url: "/src/charts.mjs" });
  assert.equal(result.status, 403);
  assert.equal(result.body, "Forbidden");
  assert.ok(!result.body.includes("OUTSIDE_ROOT_TEST_SENTINEL"));
});

test("symlinks within the app root work, but directories in place of assets are rejected", async (t) => {
  const { handler, rootDirectory } = await fixture(t);
  await writeFile(join(rootDirectory, "replacement.css"), "body { color: blue; }");
  await rm(join(rootDirectory, "styles.css"));
  await symlink(join(rootDirectory, "replacement.css"), join(rootDirectory, "styles.css"));
  const linked = await request(handler, { url: "/styles.css" });
  assert.equal(linked.status, 200);
  assert.equal(linked.body, "body { color: blue; }");
  assert.equal((await request(handler, { url: "/replacement.css" })).status, 404);
  await rm(join(rootDirectory, "src", "app.mjs"));
  await mkdir(join(rootDirectory, "src", "app.mjs"));
  assert.equal((await request(handler, { url: "/src/app.mjs" })).status, 404);
  await rm(join(rootDirectory, "favicon.svg"));
  assert.equal((await request(handler, { url: "/favicon.svg" })).status, 404);
});
