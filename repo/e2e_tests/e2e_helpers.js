/**
 * E2E test helpers. These run inside the browser via page.evaluate()
 * to seed data and manipulate auth state through the real app services.
 */

/**
 * Wait for the app to finish bootstrapping (ready=true).
 * Call this after navigating to the app URL.
 */
export async function waitForAppReady(page) {
  await page.waitForSelector("main.shell", { timeout: 10000 });
  // Wait for "Bootstrapped: Yes" to appear in system status
  await page.waitForFunction(
    () => document.body.textContent.includes("Bootstrapped: Yes"),
    { timeout: 10000 },
  );
}

/**
 * Seed a user in the IndexedDB via the app's in-browser services.
 * Must be called after the app has bootstrapped.
 */
export async function seedUserInBrowser(page, { username, password, role, orgScopeIds, classScopeIds }) {
  return page.evaluate(async ({ username, password, role, orgScopeIds, classScopeIds }) => {
    // Access the app's bootstrap context through the global scope
    // The app stores services in React context, but we can create our own
    // service context to seed data
    const { createAppServices } = await import("/src/services/index.js");
    const { createPluginSystem } = await import("/src/plugins/index.js");
    const { hashPassword, PBKDF2_ITERATIONS, createSalt } = await import("/src/auth/crypto.js");

    const plugins = createPluginSystem();
    const services = createAppServices({ plugins });
    await services.init();

    const passwordSalt = createSalt();
    const passwordHash = await hashPassword(password, passwordSalt, PBKDF2_ITERATIONS);

    await services.db.collections.users.insertOne({
      username,
      name: username,
      role,
      orgScopeIds: orgScopeIds || [],
      classScopeIds: classScopeIds || [],
      passwordSalt,
      passwordHash,
      passwordIterations: PBKDF2_ITERATIONS,
    });

    return true;
  }, { username, password, role, orgScopeIds, classScopeIds });
}

/**
 * Sign in via the app's router (POST /auth/login) from within the browser.
 * Returns the token.
 */
export async function loginInBrowser(page, username, password) {
  return page.evaluate(async ({ username, password }) => {
    const { createAppServices } = await import("/src/services/index.js");
    const { createPluginSystem } = await import("/src/plugins/index.js");

    const plugins = createPluginSystem();
    const services = createAppServices({ plugins });
    await services.init();

    const result = await services.router.call("POST /auth/login", { username, password });
    return result;
  }, { username, password });
}

/**
 * Seed all standard test users in the browser.
 */
export async function seedAllTestUsers(page) {
  return page.evaluate(async () => {
    const { createAppServices } = await import("/src/services/index.js");
    const { createPluginSystem } = await import("/src/plugins/index.js");
    const { hashPassword, PBKDF2_ITERATIONS, createSalt } = await import("/src/auth/crypto.js");

    const plugins = createPluginSystem();
    const services = createAppServices({ plugins });
    await services.init();

    const users = [
      { username: "student1", name: "student1", role: "Student", orgScopeIds: ["org_a"], classScopeIds: ["class_a"] },
      { username: "reviewer1", name: "reviewer1", role: "Reviewer", orgScopeIds: [], classScopeIds: [] },
      { username: "warehouse1", name: "warehouse1", role: "Warehouse Staff", orgScopeIds: [], classScopeIds: [] },
      { username: "admin1", name: "admin1", role: "Admin", orgScopeIds: [], classScopeIds: [] },
    ];

    for (const user of users) {
      const existing = await services.db.collections.users.findOne({ username: user.username });
      if (existing) continue;

      const passwordSalt = createSalt();
      const passwordHash = await hashPassword("pass123", passwordSalt, PBKDF2_ITERATIONS);
      await services.db.collections.users.insertOne({
        ...user,
        passwordSalt,
        passwordHash,
        passwordIterations: PBKDF2_ITERATIONS,
      });
    }

    return true;
  });
}

/**
 * Sign in as a specific user by calling the auth controller's signIn method,
 * then reload the page so the UI picks up the session.
 */
export async function signInAndReload(page, username, password = "pass123") {
  await page.evaluate(async ({ username, password }) => {
    const { createAppServices } = await import("/src/services/index.js");
    const { createPluginSystem } = await import("/src/plugins/index.js");
    const { createAuthService } = await import("/src/auth/authService.js");

    const plugins = createPluginSystem();
    const services = createAppServices({ plugins });
    await services.init();

    const authService = createAuthService(services.db.collections);
    await authService.signIn({ username, password });
  }, { username, password });

  await page.reload();
  await waitForAppReady(page);
}

/**
 * Sign out by clearing the session, then reload.
 */
export async function signOutAndReload(page) {
  await page.evaluate(async () => {
    const { createAppServices } = await import("/src/services/index.js");
    const { createPluginSystem } = await import("/src/plugins/index.js");
    const { createAuthService } = await import("/src/auth/authService.js");

    const plugins = createPluginSystem();
    const services = createAppServices({ plugins });
    await services.init();

    const authService = createAuthService(services.db.collections);
    await authService.signOut();
  });

  await page.reload();
  await waitForAppReady(page);
}

/**
 * Seed a shipment directly into IndexedDB.
 */
export async function seedShipmentInBrowser(page, shipment) {
  return page.evaluate(async (shipment) => {
    const { createAppServices } = await import("/src/services/index.js");
    const { createPluginSystem } = await import("/src/plugins/index.js");

    const plugins = createPluginSystem();
    const services = createAppServices({ plugins });
    await services.init();

    return services.db.collections.shipments.insertOne(shipment);
  }, shipment);
}
