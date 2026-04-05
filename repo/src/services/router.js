import { fail } from "./response";

function normalizeRoute(route) {
  if (typeof route === "function") {
    return {
      handler: route,
      auth: false,
      permission: null,
      guard: null,
    };
  }

  return {
    handler: route.handler,
    auth: route.auth ?? false,
    permission: route.permission ?? null,
    guard: route.guard ?? null,
  };
}

function forbidden(message = "Forbidden") {
  return fail(message, 403);
}

function unauthorized(message = "Unauthorized") {
  return fail(message, 401);
}

export function createServiceRouter(routes, options = {}) {
  const { authenticate = async () => null, hasPermission = () => false } =
    options;

  return {
    async call(path, payload = {}) {
      const rawRoute = routes[path];
      if (!rawRoute) {
        return fail(`Route not found: ${path}`, 404);
      }

      const route = normalizeRoute(rawRoute);

      try {
        let authUser = null;

        if (route.auth) {
          authUser = await authenticate(payload);
          if (!authUser) {
            return unauthorized("Authentication required");
          }
        }

        if (route.permission) {
          const permissions = Array.isArray(route.permission)
            ? route.permission
            : [route.permission];

          const allowed = permissions.every((permission) =>
            hasPermission(authUser, permission),
          );

          if (!allowed) {
            return forbidden("Permission denied");
          }
        }

        if (route.guard) {
          const guardResult = await route.guard({ payload, authUser });
          if (guardResult === false) {
            return forbidden();
          }

          if (guardResult && guardResult.ok === false) {
            return fail(
              guardResult.message ?? "Forbidden",
              guardResult.status ?? 403,
              guardResult.details ?? null,
            );
          }
        }

        return route.handler(payload, authUser);
      } catch (error) {
        return fail("Internal service error", 500, {
          message: String(error.message ?? error),
        });
      }
    },
  };
}
