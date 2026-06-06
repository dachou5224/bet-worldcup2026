import http from "node:http";
import { loadLocalEnv } from "./lib/load-env.js";
import { handleApiRoute } from "./routes/api-router.js";
import { handleStaticRoute } from "./routes/static-router.js";

loadLocalEnv();

const port = Number(process.env.PORT || 3000);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (await handleApiRoute(url.pathname, res)) {
    return;
  }

  return handleStaticRoute(url.pathname, res);
});

server.listen(port, () => {
  console.log(`World Cup 2026 Pulse running at http://127.0.0.1:${port}`);
});
