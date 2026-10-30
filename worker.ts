import { neon } from "@neondatabase/serverless";

interface Env {
  ASSETS: Fetcher;
  DATABASE_URL?: string;
}

const json = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "ai-ad-studio-algerian-voices",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/db/health" && request.method === "GET") {
      if (!env.DATABASE_URL) {
        return json({ ok: false, database: "not_configured" }, 503);
      }

      try {
        const sql = neon(env.DATABASE_URL);
        const result = await sql`SELECT 1 AS connected`;
        return json({
          ok: true,
          database: "connected",
          check: result[0]?.connected === 1,
        });
      } catch {
        // Never return connection strings, credentials, or raw database errors.
        return json({ ok: false, database: "connection_failed" }, 503);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json(
        {
          ok: false,
          error: "API route not implemented yet",
          path: url.pathname,
        },
        404,
      );
    }

    return env.ASSETS.fetch(request);
  },
};
