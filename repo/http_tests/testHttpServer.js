/**
 * Thin HTTP server adapter that maps real HTTP requests to the existing
 * service router. This enables true transport-level integration tests.
 *
 * The server:
 *   1. Parses METHOD + /path from the HTTP request
 *   2. Reads JSON body (for POST/PATCH)
 *   3. Calls services.router.call("METHOD /path", body)
 *   4. Translates the router response into an HTTP response
 *
 * Browser-API polyfills: The bulkDataService calls triggerDownload() which
 * uses URL.createObjectURL and document.createElement("a").click() — these
 * are browser-only DOM side effects that have NO impact on the HTTP response
 * payload. We polyfill them here so the service code doesn't throw in Node,
 * but the actual request→response cycle is fully real HTTP.
 */
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:polyfill";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}

import { createServer } from "node:http";
import { createAppServices } from "../src/services/index.js";
import { createPluginSystem } from "../src/plugins/index.js";
import {
  hashPassword,
  PBKDF2_ITERATIONS,
  createSalt,
} from "../src/auth/crypto.js";
import { ROLES } from "../src/auth/roles.js";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

export async function createTestServer() {
  const plugins = createPluginSystem();
  const services = createAppServices({ plugins });
  await services.init();
  await plugins.initialize({ services, modules: [] });

  const server = createServer(async (req, res) => {
    const method = req.method.toUpperCase();
    const url = new URL(req.url, `http://localhost`);
    const pathname = url.pathname;

    const body = method === "GET" || method === "HEAD"
      ? {}
      : await readBody(req);

    // For GET requests, merge query params into the body
    if (method === "GET") {
      for (const [key, value] of url.searchParams.entries()) {
        body[key] = value;
      }
    }

    // Forward Authorization header as auth.token in the payload
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      body.auth = { token: authHeader.slice(7) };
    }

    const routeKey = `${method} ${pathname}`;
    const result = await services.router.call(routeKey, body);

    const httpStatus = result.status ?? (result.error ? 500 : 200);

    res.writeHead(httpStatus, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });

  let listenPort = 0;

  function start() {
    return new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        listenPort = server.address().port;
        resolve(listenPort);
      });
    });
  }

  function stop() {
    return new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  function baseUrl() {
    return `http://127.0.0.1:${listenPort}`;
  }

  return { services, server, start, stop, baseUrl };
}

export const SEED_USERS = {
  student: {
    _id: "student_1",
    username: "student1",
    password: "pass123",
    role: ROLES.STUDENT,
    orgScopeIds: ["org_a"],
    classScopeIds: ["class_a"],
  },
  student2: {
    _id: "student_2",
    username: "student2",
    password: "pass123",
    role: ROLES.STUDENT,
    orgScopeIds: ["org_b"],
    classScopeIds: ["class_b"],
  },
  reviewer: {
    _id: "reviewer_1",
    username: "reviewer1",
    password: "pass123",
    role: ROLES.REVIEWER,
  },
  warehouse: {
    _id: "warehouse_1",
    username: "warehouse1",
    password: "pass123",
    role: ROLES.WAREHOUSE_STAFF,
  },
  operations: {
    _id: "ops_1",
    username: "ops1",
    password: "pass123",
    role: ROLES.OPERATIONS,
  },
  finance: {
    _id: "finance_1",
    username: "finance1",
    password: "pass123",
    role: ROLES.FINANCE,
  },
  admin: {
    _id: "admin_1",
    username: "admin1",
    password: "pass123",
    role: ROLES.ADMIN,
  },
};

export async function seedUser(collection, user) {
  const passwordSalt = createSalt();
  const passwordHash = await hashPassword(
    user.password,
    passwordSalt,
    PBKDF2_ITERATIONS,
  );
  await collection.insertOne({
    _id: user._id,
    username: user.username,
    name: user.username,
    role: user.role,
    orgScopeIds: user.orgScopeIds ?? [],
    classScopeIds: user.classScopeIds ?? [],
    passwordSalt,
    passwordHash,
    passwordIterations: PBKDF2_ITERATIONS,
  });
}

export async function seedAllUsers(services) {
  for (const user of Object.values(SEED_USERS)) {
    await seedUser(services.db.collections.users, user);
  }
}

export async function clearAll(services) {
  const collections = Object.values(services.db.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

/** POST /auth/login via HTTP, return token */
export async function httpLogin(baseUrl, username, password = "pass123") {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json();
  if (res.status !== 200) {
    throw new Error(`Login failed for ${username}: ${json.error?.message}`);
  }
  return json.data.token;
}

/** Generic HTTP request helper */
export async function httpRequest(baseUrl, method, path, body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, options);
  const json = await res.json();

  return { httpStatus: res.status, ...json };
}
