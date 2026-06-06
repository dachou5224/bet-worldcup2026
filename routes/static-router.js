import path from "node:path";
import { serveStaticFile } from "../lib/http.js";
import { projectRoot } from "../lib/paths.js";

export async function handleStaticRoute(pathname, res) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(projectRoot, requestPath);
  await serveStaticFile(res, filePath);
}
