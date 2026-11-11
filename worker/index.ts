import { assets, metadata } from "./assets.generated.ts";
const headers = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'none'",
};
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let result: Response;
    if (!["GET", "HEAD"].includes(request.method))
      result = new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    else if (url.pathname === "/api/health")
      result = new Response(
        request.method === "HEAD"
          ? null
          : JSON.stringify({
              ready: true,
              application: "Solution Workbench",
              modelVersion: 1,
              draftStorage: "visitor browser only",
              ...metadata,
            }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },
      );
    else {
      const asset = assets[url.pathname === "/" ? "/index.html" : url.pathname];
      if (!asset) result = new Response("Not found", { status: 404 });
      else {
        const bytes = Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0));
        result = new Response(request.method === "HEAD" ? null : bytes, {
          headers: {
            "Content-Type": asset.type,
            "Cache-Control": url.pathname.startsWith("/assets/")
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          },
        });
      }
    }
    const safe = new Response(result.body, result);
    for (const [key, value] of Object.entries(headers))
      safe.headers.set(key, value);
    return safe;
  },
};
