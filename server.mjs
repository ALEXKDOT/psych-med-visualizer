import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const publicFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/favicon.svg", "favicon.svg"],
  ["/src/app.mjs", "src/app.mjs"],
  ["/src/model.mjs", "src/model.mjs"],
  ["/src/charts.mjs", "src/charts.mjs"],
  ["/src/portability.mjs", "src/portability.mjs"]
]);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

const securityHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // Generated SVG charts and symptom colors use inline styles. Scripts remain external-only.
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};

function validHost(host, port) {
  if (typeof host !== "string" || !Number.isInteger(port) || port < 1 || port > 65535) return false;
  const normalized = host.toLowerCase();
  return ["localhost", "127.0.0.1"].some((name) => normalized === `${name}:${port}` || (port === 80 && normalized === name));
}

function sendText(request, response, status, text, headers = {}) {
  response.writeHead(status, {
    ...securityHeaders,
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    ...headers
  });
  response.end(request.method === "HEAD" ? undefined : text);
}

/** Serve the browser app only; journal data never reaches this HTTP handler. */
export function createJournalHandler({ rootDirectory = projectRoot } = {}) {
  const root = resolve(rootDirectory);
  return async (request, response) => {
    // Binding to loopback alone does not protect against DNS rebinding.
    if (!validHost(request.headers?.host, request.socket?.localPort)) {
      sendText(request, response, 421, "Misdirected request");
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      sendText(request, response, 405, "Method not allowed", { Allow: "GET, HEAD", Connection: "close" });
      return;
    }

    let pathname;
    try {
      const url = request.url || "/";
      if (!url.startsWith("/") || url.startsWith("//")) throw new Error("Invalid request target");
      pathname = decodeURIComponent(url.split("?")[0]);
    } catch {
      sendText(request, response, 400, "Bad request");
      return;
    }
    const relative = publicFiles.get(pathname);
    if (!relative) {
      sendText(request, response, 404, "Not found");
      return;
    }

    try {
      const canonicalRoot = await realpath(root);
      const canonicalFile = await realpath(resolve(root, relative));
      if (!canonicalFile.startsWith(`${canonicalRoot}${sep}`)) {
        sendText(request, response, 403, "Forbidden");
        return;
      }
      const fileStat = await stat(canonicalFile);
      if (!fileStat.isFile()) {
        sendText(request, response, 404, "Not found");
        return;
      }
      const body = request.method === "HEAD" ? null : await readFile(canonicalFile);
      response.writeHead(200, {
        ...securityHeaders,
        "Content-Type": mimeTypes[extname(relative)],
        "Content-Length": body?.length ?? fileStat.size
      });
      response.end(body ?? undefined);
    } catch {
      sendText(request, response, 404, "Not found");
    }
  };
}

export function createJournalServer(options = {}) {
  const server = createServer(createJournalHandler(options));
  server.requestTimeout = 15_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 50;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.RESPONSE_MAP_PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError("RESPONSE_MAP_PORT must be an integer from 0 through 65535.");
  }
  const server = createJournalServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`ResponseMap is available at http://127.0.0.1:${server.address().port}`);
  });
}
