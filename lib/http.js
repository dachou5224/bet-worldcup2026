import { readFile } from "node:fs/promises";
import path from "node:path";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export function sendJson(res, body, statusCode = 200) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export async function serveStaticFile(res, filePath) {
  try {
    const ext = path.extname(filePath);
    const content = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "text/plain; charset=utf-8",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}
