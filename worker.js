export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy /api/* requests to backend
    if (url.pathname.startsWith("/api/")) {
      const backendBase = env.BACKEND_URL || "https://byte-connecting-gas-foods.trycloudflare.com";
      const targetUrl = backendBase + url.pathname + url.search;

      try {
        const modifiedRequest = new Request(targetUrl, {
          method: request.method,
          headers: request.headers,
          body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
          redirect: "follow",
        });
        const response = await fetch(modifiedRequest);
        return response;
      } catch (err) {
        return new Response(JSON.stringify({ error: "Backend proxy connection failed", detail: err.message }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Serve static assets from Cloudflare Edge
    return env.ASSETS.fetch(request);
  },
};
