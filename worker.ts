import { neon } from "@neondatabase/serverless";

interface Env {
  ASSETS: Fetcher;
  DATABASE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

const GOOGLE_STATE_COOKIE = "__Host-aistudio_google_state";
const GOOGLE_VERIFIER_COOKIE = "__Host-aistudio_google_verifier";
const clearOAuthCookie = (name: string): string => `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

const SESSION_COOKIE = "__Host-aistudio_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 310_000;

const json = (body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const randomToken = (length = 32): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64Url(bytes);
};

const sha256 = async (value: string): Promise<string> =>
  base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));

const derivePasswordHash = async (password: string, salt: Uint8Array): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return base64Url(new Uint8Array(bits));
};

const createPasswordHash = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${base64Url(salt)}$${hash}`;
};

const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [algorithm, iterationsText, saltText, expected] = stored.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 || !saltText || !expected) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(saltText), iterations },
    key,
    256,
  );
  const actual = base64Url(new Uint8Array(bits));
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
};

const getCookie = (request: Request, name: string): string | null => {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
};

const sessionCookie = (token: string, maxAge: number): string =>
  `${SESSION_COOKIE}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
const clearSessionCookie = (): string =>
  `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

const validOrigin = (request: Request, url: URL): boolean => {
  const origin = request.headers.get("Origin");
  return Boolean(origin && origin === url.origin);
};

const getSessionUser = async (request: Request, env: Env) => {
  if (!env.DATABASE_URL) return null;
  const token = getCookie(request, SESSION_COOKIE);
  if (!token || token.length > 200) return null;
  const sql = neon(env.DATABASE_URL);
  const tokenHash = await sha256(token);
  const rows = await sql`
    SELECT u.id, u.email, u.display_name
    FROM auth_sessions s
    JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > NOW()
      AND u.status = 'active'
    LIMIT 1
  `;
  return rows[0] || null;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, service: "ai-ad-studio-algerian-voices", timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/api/db/health" && request.method === "GET") {
      if (!env.DATABASE_URL) return json({ ok: false, database: "not_configured" }, 503);
      try {
        const sql = neon(env.DATABASE_URL);
        const result = await sql`SELECT 1 AS connected`;
        return json({ ok: true, database: "connected", check: result[0]?.connected === 1 });
      } catch {
        return json({ ok: false, database: "connection_failed" }, 503);
      }
    }

    if (url.pathname === "/api/auth/google" && request.method === "GET") {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return json({ ok: false, error: "Google OAuth is not configured." }, 503);
      const state = randomToken(24);
      const verifier = randomToken(48);
      const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
      const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleUrl.search = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: `${url.origin}/api/auth/google/callback`,
        response_type: "code", scope: "openid email profile", state,
        code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
      }).toString();
      return new Response(null, { status: 302, headers: {
        location: googleUrl.toString(),
        "set-cookie": [
          `${GOOGLE_STATE_COOKIE}=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
          `${GOOGLE_VERIFIER_COOKIE}=${verifier}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
        ].join(", "), "cache-control": "no-store",
      }});
    }

    if (url.pathname === "/api/auth/google/callback" && request.method === "GET") {
      const clearOAuth = [clearOAuthCookie(GOOGLE_STATE_COOKIE), clearOAuthCookie(GOOGLE_VERIFIER_COOKIE)].join(", ");
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const verifier = getCookie(request, GOOGLE_VERIFIER_COOKIE);
      if (!state || state !== getCookie(request, GOOGLE_STATE_COOKIE) || !code || !verifier || !env.DATABASE_URL || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        return new Response(null, { status: 302, headers: { location: "/#auth-section?google=error", "set-cookie": clearOAuth, "cache-control": "no-store" }});
      }
      try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: verifier,
          }),
        });
        if (!tokenResponse.ok) throw new Error("Google token exchange failed");
        const tokenData = await tokenResponse.json() as { access_token?: string };
        if (!tokenData.access_token) throw new Error("Google access token missing");
        const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { authorization: `Bearer ${tokenData.access_token}` },
        });
        if (!profileResponse.ok) throw new Error("Google profile request failed");
        const profile = await profileResponse.json() as { id?: string; email?: string; verified_email?: boolean; name?: string };
        const googleId = typeof profile.id === "string" ? profile.id : "";
        const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
        const displayName = typeof profile.name === "string" ? profile.name.trim().slice(0, 120) : "";
        if (!googleId || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || profile.verified_email !== true || !displayName) throw new Error("Unverified Google profile");
        const subject = `google:${googleId}`;
        const found = await sql`SELECT id, email, display_name, auth_subject, status FROM app_users WHERE auth_subject = ${subject} OR LOWER(email) = ${email} LIMIT 1`;
        let user = found[0] as Record<string, unknown> | undefined;
        if (user && user.status !== "active") throw new Error("Account inactive");
        if (user && user.auth_subject && user.auth_subject !== subject) throw new Error("Identity conflict");
        if (user) {
          const updated = await sql`UPDATE app_users SET auth_subject = ${subject}, email = ${email}, display_name = COALESCE(NULLIF(display_name, ''), ${displayName}), updated_at = NOW() WHERE id = ${user.id} RETURNING id, email, display_name`;
          user = updated[0] as Record<string, unknown>;
        } else {
          const inserted = await sql`INSERT INTO app_users (auth_subject, email, display_name) VALUES (${subject}, ${email}, ${displayName}) RETURNING id, email, display_name`;
          user = inserted[0] as Record<string, unknown>;
        }
        const token = randomToken();
        const tokenHash = await sha256(token);
        const maxAge = SESSION_DAYS * 24 * 60 * 60;
        await sql`INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (${user.id}, ${tokenHash}, NOW() + (${maxAge} * INTERVAL '1 second'))`;
        return new Response(null, { status: 302, headers: {
          location: "/#auth-section?google=success",
          "set-cookie": [sessionCookie(token, maxAge), clearOAuthCookie(GOOGLE_STATE_COOKIE), clearOAuthCookie(GOOGLE_VERIFIER_COOKIE)].join(", "),
          "cache-control": "no-store",
        }});
      } catch (error) {
        console.error("google_oauth_failed", error instanceof Error ? error.name : "UnknownError");
        return new Response(null, { status: 302, headers: { location: "/#auth-section?google=error", "set-cookie": clearOAuth, "cache-control": "no-store" }});
      }
    }

    if (url.pathname.startsWith("/api/auth/")) {
      if (!env.DATABASE_URL) return json({ ok: false, error: "Authentication is temporarily unavailable." }, 503);
      const sql = neon(env.DATABASE_URL);

      if (request.method === "GET" && url.pathname === "/api/auth/me") {
        try {
          const user = await getSessionUser(request, env);
          return user
            ? json({ authenticated: true, user })
            : json({ authenticated: false }, 401);
        } catch {
          return json({ authenticated: false }, 401);
        }
      }

      if (request.method === "POST" && !validOrigin(request, url)) {
        return json({ ok: false, error: "طلب غير صالح. أعد تحميل الصفحة وحاول مجدداً." }, 403);
      }

      if (request.method === "POST" && url.pathname === "/api/auth/logout") {
        try {
          const token = getCookie(request, SESSION_COOKIE);
          if (token) await sql`DELETE FROM auth_sessions WHERE token_hash = ${await sha256(token)}`;
          return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
        } catch {
          return json({ ok: false, error: "تعذر إنهاء الجلسة. حاول مجدداً." }, 503);
        }
      }

      if (request.method === "POST" && (url.pathname === "/api/auth/signup" || url.pathname === "/api/auth/login")) {
        let body: Record<string, unknown>;
        try {
          const raw = await request.text();
          if (raw.length > 8_000) return json({ ok: false, error: "حجم الطلب كبير جداً." }, 413);
          body = JSON.parse(raw);
        } catch {
          return json({ ok: false, error: "بيانات الطلب غير صالحة." }, 400);
        }

        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const remember = body.remember === true;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128) {
          return json({ ok: false, error: "تحقق من البريد الإلكتروني. كلمة المرور يجب أن تكون بين 12 و128 حرفاً." }, 400);
        }

        let authStage = "start";
        try {
          let user: Record<string, unknown> | undefined;
          if (url.pathname === "/api/auth/signup") {
            authStage = "signup_user_insert";
            const displayName = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
            const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : null;
            if (displayName.length < 2) return json({ ok: false, error: "أدخل الاسم الكامل أو اسم المتجر." }, 400);
            const passwordHash = await createPasswordHash(password);
            const inserted = await sql`
              INSERT INTO app_users (email, display_name, phone, password_hash)
              VALUES (${email}, ${displayName}, ${phone}, ${passwordHash})
              ON CONFLICT (email) DO NOTHING
              RETURNING id, email, display_name
            `;
            user = inserted[0] as Record<string, unknown> | undefined;
            if (!user) return json({ ok: false, error: "هذا البريد مسجل من قبل. سجل الدخول بدلاً من ذلك." }, 409);
          } else {
            authStage = "login_user_lookup";
            const rows = await sql`
              SELECT id, email, display_name, password_hash
              FROM app_users
              WHERE email = ${email} AND status = 'active'
              LIMIT 1
            `;
            const existing = rows[0] as Record<string, unknown> | undefined;
            const storedHash = typeof existing?.password_hash === "string" ? existing.password_hash : null;
            const valid = storedHash ? await verifyPassword(password, storedHash) : false;
            if (!existing || !valid) return json({ ok: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." }, 401);
            user = { id: existing.id, email: existing.email, display_name: existing.display_name };
          }

          authStage = "session_insert";
          const token = randomToken();
          const tokenHash = await sha256(token);
          const maxAge = (remember ? SESSION_DAYS : 1) * 24 * 60 * 60;
          await sql`
            INSERT INTO auth_sessions (user_id, token_hash, expires_at)
            VALUES (${user.id}, ${tokenHash}, NOW() + (${maxAge} * INTERVAL '1 second'))
          `;
          return json({ ok: true, user }, 200, { "set-cookie": sessionCookie(token, maxAge) });
        } catch (error) {
          const err = error instanceof Error ? error : new Error("Unknown non-Error exception");
          const safeMessage = err.message
            .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[redacted-database-url]")
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
            .replace(/\b(password|passwd|token|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
            .slice(0, 500);
          console.error("auth_operation_failed", {
            route: url.pathname,
            stage: authStage,
            errorType: err.name,
            errorMessage: safeMessage,
          });
          return json({ ok: false, error: "تعذر إتمام العملية حالياً. حاول مجدداً." }, 503);
        }
      }

      return json({ ok: false, error: "المسار غير موجود." }, 404);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, error: "API route not implemented yet", path: url.pathname }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
