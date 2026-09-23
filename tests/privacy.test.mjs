import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const html = await readFile(join(root, "index.html"), "utf8");

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1].toLowerCase(), match[3]]));
}

function policyDirectives(value) {
  return Object.fromEntries(value.split(";").filter((entry) => entry.trim()).map((entry) => {
    const [name, ...sources] = entry.trim().split(/\s+/);
    return [name, sources];
  }));
}

async function filesBelow(directory, prefix = "") {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) found.push(...await filesBelow(join(directory, entry.name), path));
    else found.push(path);
  }
  return found.sort();
}

test("the static HTML blocks data connections and form submissions without relying on server headers", () => {
  const metadata = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => attributes(match[0]));
  const csp = metadata.find((entry) => entry["http-equiv"]?.toLowerCase() === "content-security-policy");
  assert.ok(csp?.content, "GitHub Pages must receive the privacy policy in the HTML itself");
  assert.ok(html.indexOf(csp.content) < html.search(/<(?:script|link)\b/i), "the policy must precede resource loads");
  const policy = policyDirectives(csp.content);
  for (const directive of ["connect-src", "form-action", "object-src", "base-uri"]) {
    assert.deepEqual(policy[directive], ["'none'"], `${directive} must deny every destination`);
  }
  assert.deepEqual(policy["script-src"], ["'self'"]);
  assert.deepEqual(policy["script-src-attr"], ["'none'"]);
  assert.equal(metadata.find((entry) => entry.name === "referrer")?.content, "no-referrer");
  assert.doesNotMatch(html, /<(?:iframe|object|embed|base)\b/i);
});

test("journal inputs cannot use native form submission or browser form autocomplete", () => {
  const forms = [...html.matchAll(/<form\b[^>]*>/gi)];
  assert.ok(forms.length, "the journal includes input forms");
  for (const [tag] of forms) {
    const values = attributes(tag);
    assert.equal(values.autocomplete, "off", `${values.id || "form"} requests no browser form history`);
    assert.ok(!values.action, "journal forms must have no submission destination");
  }
  assert.doesNotMatch(html, /\b(?:formaction|ping)\s*=/i);
  assert.doesNotMatch(html, /\btype\s*=\s*["']file["']/i, "the public app must not import private journal files");
  assert.doesNotMatch(html, /\bdownload(?:\s|=|>)/i, "the public app must not offer journal file downloads");
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const values = attributes(tag);
    assert.match(values.src || "", /^\.\//, "scripts must be local files");
    assert.equal(values.type, "module");
  }
  assert.doesNotMatch(html, /\bon\w+\s*=/i, "inline event handlers must not be present");
  const bodyDisablesSpellcheck = attributes(html.match(/<body\b[^>]*>/i)?.[0] || "").spellcheck === "false";
  const formRanges = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)];
  for (const match of html.matchAll(/<(?:input|textarea)\b[^>]*>/gi)) {
    const values = attributes(match[0]);
    if (values.type && !["text", "search", "email", "url", "tel"].includes(values.type)) continue;
    const inherited = formRanges.some((form) => form.index <= match.index && form.index + form[0].length > match.index
      && attributes(form[0].match(/<form\b[^>]*>/i)[0]).spellcheck === "false");
    assert.ok(bodyDisablesSpellcheck || inherited || values.spellcheck === "false", `${values.id || "text field"} opts out of browser spell-check services`);
  }
});

test("a production build contains only public assets and no data-writing or network APIs", async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), "responsemap-privacy-build-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const copied = ["scripts/build.mjs", "index.html", "styles.css", "favicon.svg", ...await filesBelow(join(root, "src"), "src")];
  for (const path of copied) {
    await mkdir(dirname(join(fixture, path)), { recursive: true });
    await copyFile(join(root, path), join(fixture, path));
  }
  const privateSentinel = "PRIVATE_TEST_FIXTURE_MUST_NEVER_SHIP";
  for (const path of [".env", "responsemap-private.json", "responsemap-private.csv", "backups/health.json", ".git/config"]) {
    await mkdir(dirname(join(fixture, path)), { recursive: true });
    await writeFile(join(fixture, path), privateSentinel);
  }
  await execFileAsync(process.execPath, ["scripts/build.mjs"], { cwd: fixture });
  const output = join(fixture, "dist");
  const builtFiles = await filesBelow(output);
  assert.ok(builtFiles.includes("index.html"));
  assert.ok(builtFiles.includes("src/app.mjs"));
  const allowedAssets = new Set(["index.html", "styles.css", "favicon.svg", "src/app.mjs", "src/model.mjs", "src/charts.mjs", ".nojekyll"]);
  const forbiddenCode = [
    /\b(?:localStorage|sessionStorage|indexedDB|openDatabase|showSaveFilePicker|showOpenFilePicker)\b/,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|sendBeacon)\b/,
    /\b(?:serviceWorker|caches|BroadcastChannel)\b/,
    /\b(?:document\s*\.\s*cookie|window\s*\.\s*name|history\s*\.\s*(?:pushState|replaceState))\b/,
    /\b(?:createObjectURL|downloadFile)\b|\.\s*(?:download|clipboard|print)\b/,
    /\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval)\b|document\s*\.\s*write\s*\(/
  ];
  for (const path of builtFiles) {
    assert.ok(allowedAssets.has(path), `unexpected public file: ${path}`);
    const source = await readFile(join(output, path), "utf8");
    assert.ok(!source.includes(privateSentinel), `private fixture leaked into ${path}`);
    if (path.endsWith(".mjs")) {
      for (const forbidden of forbiddenCode) assert.doesNotMatch(source, forbidden, `${path} includes a persistence, transmission, or unsafe rendering API`);
      for (const match of source.matchAll(/\b(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) {
        assert.match(match[1], /^\.\//, `${path} may only import local modules`);
      }
    }
    if (path.endsWith(".css")) assert.doesNotMatch(source, /@import\b|url\s*\(/i, "styles must not add external resources or tracking endpoints");
  }
});
