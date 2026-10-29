interface Env {
  ASSETS: Fetcher;
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
