import { sendJson } from "../lib/http.js";
import { buildApiPayload } from "../services/api-service.js";

export async function handleApiRoute(pathname, res) {
  const handlers = await buildApiPayload();
  const handler = handlers[pathname];

  if (!handler) {
    return false;
  }

  try {
    sendJson(res, await handler());
  } catch (error) {
    sendJson(
      res,
      {
        ok: false,
        error: "internal_error",
        message: error.message,
      },
      500,
    );
  }
  return true;
}
