import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const DEFAULT_PROXY_ENV_KEYS = [
  "GEMINI_HTTPS_PROXY",
  "GEMINI_HTTP_PROXY",
  "POLYMARKET_HTTPS_PROXY",
  "POLYMARKET_HTTP_PROXY",
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
];

/**
 * 将 host:port 规范为 http://host:port（本地 VPN 常见写法）。
 */
export function normalizeProxyUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("://")) {
    return trimmed;
  }

  return `http://${trimmed}`;
}

/**
 * 读取 HTTPS 代理 URL。优先 POLYMARKET_*，再回退标准 HTTPS_PROXY / HTTP_PROXY。
 */
export function resolveHttpsProxyUrl(envKeys = DEFAULT_PROXY_ENV_KEYS) {
  for (const key of envKeys) {
    const normalized = normalizeProxyUrl(process.env[key]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

/**
 * 供日志/meta 使用，避免泄露带凭据的完整代理 URL。
 */
export function describeProxyUsage(proxyUrl) {
  if (!proxyUrl) {
    return { used: false, via: "direct" };
  }

  try {
    const parsed = new URL(proxyUrl);
    return {
      used: true,
      via: "https_proxy",
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
    };
  } catch {
    return { used: true, via: "https_proxy" };
  }
}

function readResponseBody(response) {
  return new Promise((resolve, reject) => {
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => {
      body += chunk;
    });
    response.on("end", () => resolve(body));
    response.on("error", reject);
  });
}

function requestDirectHttps(url, { method = "GET", headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      async (response) => {
        try {
          const responseBody = await readResponseBody(response);
          resolve({
            statusCode: response.statusCode || 0,
            body: responseBody,
          });
        } catch (error) {
          reject(error);
        }
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    request.on("error", reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

function requestViaHttpConnectProxy(targetUrl, proxyUrl, { method = "GET", headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const proxy = new URL(proxyUrl);
    const connectPort = target.port || (target.protocol === "https:" ? "443" : "80");
    const connectPath = `${target.hostname}:${connectPort}`;

    const connectReq = http.request({
      host: proxy.hostname,
      port: proxy.port || 80,
      method: "CONNECT",
      path: connectPath,
      headers: {
        Host: connectPath,
      },
    });

    connectReq.setTimeout(timeoutMs, () => {
      connectReq.destroy(new Error(`Proxy CONNECT timed out after ${timeoutMs}ms`));
    });

    connectReq.on("connect", (connectResponse, socket) => {
      if (connectResponse.statusCode !== 200) {
        socket.destroy();
        reject(
          new Error(
            `Proxy CONNECT failed with HTTP ${connectResponse.statusCode} via ${proxy.hostname}:${proxy.port || 80}`,
          ),
        );
        return;
      }

      const requestPath = `${target.pathname}${target.search}`;
      const request = https.request(
        {
          host: target.hostname,
          port: connectPort,
          path: requestPath,
          method,
          headers,
          socket,
          agent: false,
        },
        async (response) => {
          try {
            const responseBody = await readResponseBody(response);
            resolve({
              statusCode: response.statusCode || 0,
              body: responseBody,
            });
          } catch (error) {
            reject(error);
          }
        },
      );

      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
      });
      request.on("error", reject);
      if (body) {
        request.write(body);
      }
      request.end();
    });

    connectReq.on("error", reject);
    connectReq.end();
  });
}

/**
 * 经可选 HTTPS 代理发起 HTTP(S) 请求，返回 statusCode + body。
 */
export async function fetchTextViaHttpsProxy(url, options = {}) {
  const proxyUrl = options.proxyUrl ?? resolveHttpsProxyUrl(options.proxyEnvKeys);
  const headers = options.headers ?? {};
  const timeoutMs = options.timeoutMs ?? 20000;
  const method = options.method || "GET";
  const body = options.body ?? null;

  const response = proxyUrl
    ? await requestViaHttpConnectProxy(url, proxyUrl, { method, headers, body, timeoutMs })
    : await requestDirectHttps(url, { method, headers, body, timeoutMs });

  if (response.statusCode >= 400) {
    throw new Error(`HTTP ${response.statusCode} for ${url}: ${response.body.slice(0, 300)}`);
  }

  return response.body;
}

/**
 * 经可选 HTTPS 代理拉取 JSON。Node 原生 https.get 不读代理环境变量，故用 HTTP CONNECT。
 */
export async function fetchJsonViaHttpsProxy(url, options = {}) {
  const body = await fetchTextViaHttpsProxy(url, options);

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(
      `JSON parse failed for ${url}: ${error.message}; body=${body.slice(0, 300)}`,
    );
  }
}
