// Same-origin proxy for the deployed frontend. The browser calls /api/..., Vercel
// rewrites that to this function, and this function calls the Python API at API_ORIGIN.
// Firecrawl and Bedrock stay on that API process; this file never sees those keys.
//
// Local dev does not use this file. Vite proxies /api to localhost:8000 instead.

const REQUEST_DROP = new Set([
  "accept-encoding",
  "connection",
  "content-length",
  "host",
  "transfer-encoding",
])

const RESPONSE_DROP = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
])

function json(status, detail) {
  return Response.json({ detail }, { status })
}

function targetUrl(base, path, search) {
  const origin = new URL(base)
  if (origin.protocol !== "http:" && origin.protocol !== "https:") {
    throw new Error("scheme")
  }
  const bad = path.startsWith("/")
    || path.split("/").includes("..")
    || path.includes("\\")
    || path.includes("://")
  if (bad) return null
  const prefix = origin.pathname.replace(/\/$/, "")
  origin.pathname = path ? `${prefix}/${path}` : prefix || "/"
  origin.search = search
  return origin
}

export default {
  async fetch(request) {
    const base = (process.env.API_ORIGIN || "").trim()
    if (!base) {
      return json(503, "API_ORIGIN is not set on the frontend host, so this site cannot reach the Policy Radar API.")
    }

    const incoming = new URL(request.url)
    let path
    if (incoming.searchParams.has("__path")) {
      path = incoming.searchParams.get("__path") || ""
      incoming.searchParams.delete("__path")
    } else if (incoming.pathname.startsWith("/api/") && incoming.pathname !== "/api/proxy") {
      // Some hosts invoke the function with the browser's original URL.
      path = incoming.pathname.slice("/api/".length)
    } else {
      return json(502, "API proxy rewrite did not include a path.")
    }

    let target
    try {
      target = targetUrl(base, path, incoming.search)
    } catch {
      return json(503, "API_ORIGIN is not a valid http(s) URL.")
    }
    if (!target || target.origin !== new URL(base).origin) return json(400, "invalid path")

    const headers = new Headers()
    for (const [key, value] of request.headers) {
      if (!REQUEST_DROP.has(key.toLowerCase())) headers.set(key, value)
    }

    const init = { method: request.method, headers, redirect: "manual" }
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body
      init.duplex = "half"
    }

    try {
      const upstream = await fetch(target, init)
      const out = new Headers()
      for (const [key, value] of upstream.headers) {
        if (!RESPONSE_DROP.has(key.toLowerCase())) out.set(key, value)
      }
      return new Response(upstream.body, { status: upstream.status, headers: out })
    } catch {
      return json(502, "Policy Radar API unreachable")
    }
  },
}
