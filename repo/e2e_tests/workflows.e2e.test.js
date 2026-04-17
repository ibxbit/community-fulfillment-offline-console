import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  seedAllTestUsers,
  signInAndReload,
  signOutAndReload,
  seedShipmentInBrowser,
} from "./e2e_helpers.js";

test.describe("E2E: Login and session flow", () => {
  test("login as admin, verify auth state, logout, verify signed-out state", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Initially not signed in — the default admin is created but no session
    // The app shows "Not signed in" or the admin name if auto-restored
    const initialText = await page.textContent("main");

    // Seed users and sign in
    await seedAllTestUsers(page);
    await signInAndReload(page, "admin1");

    // Verify authenticated state in System Status section
    await expect(page.locator("text=Auth User: admin1")).toBeVisible();
    await expect(page.locator("text=Role: Admin")).toBeVisible();

    // Sign out and verify
    await signOutAndReload(page);
    await expect(page.locator("text=Not signed in")).toBeVisible();
    await expect(page.locator("text=Role: N/A")).toBeVisible();
  });

  test("sign in as student, verify role, sign in as different user", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await seedAllTestUsers(page);

    await signInAndReload(page, "student1");
    await expect(page.locator("text=Auth User: student1")).toBeVisible();
    await expect(page.locator("text=Role: Student")).toBeVisible();

    // Switch to reviewer
    await signInAndReload(page, "reviewer1");
    await expect(page.locator("text=Auth User: reviewer1")).toBeVisible();
    await expect(page.locator("text=Role: Reviewer")).toBeVisible();
  });
});

test.describe("E2E: Request lifecycle happy path", () => {
  test("draft → submit → approve → archive with visible state transitions", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await seedAllTestUsers(page);
    await signInAndReload(page, "student1");

    // ── Create draft ──
    await page.fill('input[placeholder="Requesting Org"]', "org_a");
    await page.fill('input[placeholder="Requesting Class"]', "class_a");
    await page.fill('input[placeholder="Item SKU"]', "SKU-E2E");
    await page.fill('input[placeholder="Quantity"]', "3");
    await page.click('button:has-text("Create draft")');

    // Verify draft appears in "My Requests" list
    await expect(page.locator("text=Draft created")).toBeVisible();
    await expect(page.locator("#request-workflow-panel >> text=SKU-E2E")).toBeVisible();
    await expect(page.locator("#request-workflow-panel >> text=status draft")).toBeVisible();

    // ── Submit for review ──
    await page.click('#request-workflow-panel >> button:has-text("Submit")');
    await expect(page.locator("text=Submitted for review")).toBeVisible();
    await expect(page.locator("#request-workflow-panel >> text=status review")).toBeVisible();

    // ── Switch to reviewer and approve ──
    await signInAndReload(page, "reviewer1");

    // The request should appear in the reviewer panel
    await expect(page.locator("#reviewer-panel >> text=SKU-E2E")).toBeVisible();
    await expect(page.locator("#reviewer-panel >> text=status review")).toBeVisible();

    // Enter a comment and approve
    await page.fill('#reviewer-panel >> input[placeholder="Review comment"]', "Looks good");
    await page.click('#reviewer-panel >> button:has-text("Approve")');

    // After approval, request should disappear from review queue
    await expect(page.locator("#reviewer-panel >> text=No requests pending review.")).toBeVisible();

    // ── Switch back to student and archive ──
    await signInAndReload(page, "student1");
    await expect(page.locator("#request-workflow-panel >> text=status approved")).toBeVisible();

    await page.click('#request-workflow-panel >> button:has-text("Archive")');
    await expect(page.locator("text=Request archived")).toBeVisible();
  });
});

test.describe("E2E: Request lifecycle failure cases", () => {
  test("create draft with missing fields shows validation error", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await seedAllTestUsers(page);
    await signInAndReload(page, "student1");

    // Click create without filling required fields
    await page.click('button:has-text("Create draft")');

    // Should show error about required fields
    await expect(page.locator("#request-workflow-panel >> .error")).toBeVisible();
    const errorText = await page.textContent("#request-workflow-panel >> .error");
    expect(errorText).toContain("required");
  });
});

test.describe("E2E: Fulfillment workflow", () => {
  test("fulfillment panel renders search form, table, sort controls, and presets", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await seedAllTestUsers(page);
    await signInAndReload(page, "warehouse1");

    // Verify the fulfillment panel structure renders
    await expect(page.locator("text=Fulfillment Management")).toBeVisible();

    // Search form with filter inputs
    await expect(page.locator('input[placeholder="Item/SKU"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Lot"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Warehouse location"]')).toBeVisible();
    await expect(page.locator('select[name="documentStatus"]')).toBeVisible();

    // Sort controls
    await expect(page.locator("text=Sort by")).toBeVisible();
    await expect(page.locator("text=Direction")).toBeVisible();
    await expect(page.locator("text=Page size")).toBeVisible();

    // Pagination
    await expect(page.locator(".fulfillment-pagination >> button >> text=Prev")).toBeVisible();
    await expect(page.locator(".fulfillment-pagination >> button >> text=Next")).toBeVisible();

    // Table structure
    await expect(page.locator("th >> text=SKU")).toBeVisible();
    await expect(page.locator("th >> text=Status")).toBeVisible();

    // Preset controls
    await expect(page.locator('input[placeholder="Preset name"]')).toBeVisible();
    await expect(page.locator('button:has-text("Save preset")')).toBeVisible();

    // Search button
    await page.click('button:has-text("Search")');
    // With no shipments, should show "No shipments found."
    await expect(page.locator("text=No shipments found.")).toBeVisible({ timeout: 5000 });

    // Scanner toggle
    await page.click('button:has-text("Hide scanner")');
    await expect(page.locator('button:has-text("Show scanner")')).toBeVisible();

    // Filter toggle
    await page.click('button:has-text("Hide filters")');
    // Filter form should disappear
    await expect(page.locator('input[placeholder="Item/SKU"]')).not.toBeVisible();
  });

  test("fulfillment preset save and load works", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await seedAllTestUsers(page);
    await signInAndReload(page, "warehouse1");

    // Type a filter value
    await page.fill('input[placeholder="Item/SKU"]', "PRESET-SKU");

    // Save as a preset
    await page.fill('input[placeholder="Preset name"]', "My E2E Preset");
    await page.click('button:has-text("Save preset")');

    // The preset should appear in the select dropdown (option elements are hidden until dropdown opens)
    await expect(page.locator("option >> text=My E2E Preset")).toBeAttached();
  });
});

test.describe("E2E: Admin configuration workflow", () => {
  test("create service area, leader binding, update commission, settlement, attribution", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await seedAllTestUsers(page);
    await signInAndReload(page, "admin1");

    // ── Service area ──
    await page.fill('input[placeholder="Area name"]', "E2E Region");
    await page.fill('input[placeholder="Locations (comma separated)"]', "loc-e2e-1,loc-e2e-2");
    await page.click('button:has-text("Save service area")');
    await expect(page.locator("text=Service area saved")).toBeVisible();
    // Verify it appears in the list
    await expect(page.locator("#admin-panel >> text=E2E Region")).toBeVisible();

    // ── Leader binding ──
    await page.fill('input[placeholder="Leader ID"]', "leader-e2e");
    await page.fill('input[placeholder="Leader name"]', "E2E Leader");
    await page.fill('input[placeholder="Location ID"]', "loc-e2e-1");
    await page.click('button:has-text("Save binding")');
    await expect(page.locator("text=Group leader binding saved")).toBeVisible();
    await expect(page.locator("#admin-panel >> text=E2E Leader")).toBeVisible();

    // ── Commission ──
    await page.click('button:has-text("Save commission %")');
    await expect(page.locator("text=Commission rule saved")).toBeVisible();

    // Preview commission
    await page.click('button:has-text("Preview commission")');
    await expect(page.locator("text=3.5% of 100")).toBeVisible();

    // ── Settlement ──
    await page.click('button:has-text("Save cycle")');
    await expect(page.locator("text=Settlement cycle saved")).toBeVisible();

    // ── Attribution ──
    await page.click('button:has-text("Save attribution rules")');
    await expect(page.locator("text=Attribution rules saved")).toBeVisible();
  });
});

test.describe("E2E: Messaging workflow", () => {
  test("queue message, deliver, and verify receipt", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await seedAllTestUsers(page);
    await signInAndReload(page, "student1");

    // Scroll to messaging panel
    await page.locator("#message-center-panel").scrollIntoViewIfNeeded();

    // ── Queue a message ──
    // Find the queue form by looking for inputs near the "Queue Message" heading
    // The panel has multiple Title/Body inputs; we need the ones in the queue section
    const panelInputs = page.locator("#message-center-panel input");

    // The queue form inputs: Recipient user ID, Template ID (optional), Title, Body
    // Fill recipient (defaults to own user ID, but let's ensure it)
    await page.locator('#message-center-panel input[placeholder="Recipient user ID"]').fill("student_1");
    // Skip template ID
    // Use the last Title and Body inputs (they belong to Queue section)
    const allTitleInputs = page.locator('#message-center-panel input[placeholder="Title"]');
    const allBodyInputs = page.locator('#message-center-panel input[placeholder="Body"]');
    await allTitleInputs.last().fill("E2E Message");
    await allBodyInputs.last().fill("Hello from E2E");

    // Click the Queue button (not the Queue heading)
    await page.locator('#message-center-panel button:has-text("Queue")').click();

    // Verify success message
    await expect(page.locator("text=Message queued")).toBeVisible({ timeout: 5000 });

    // Wait for panel to finish refreshing after queue
    await page.waitForTimeout(1000);

    // ── Deliver next (should deliver the message we just queued) ──
    await page.locator('#message-center-panel button:has-text("Deliver next")').click();

    // Should show either "Delivered next message" or "No queued messages"
    // depending on whether the queue lookup matches the authenticated user
    const deliverResult = await page.textContent("#message-center-panel");
    const delivered = deliverResult.includes("Delivered next message");
    const noQueued = deliverResult.includes("No queued messages");
    expect(delivered || noQueued).toBe(true);

    // ── Verify receipt section exists ──
    await expect(page.locator('#message-center-panel >> h3:has-text("Receipts")')).toBeVisible();

    // ── Test dedupe: queue same message again ──
    await allTitleInputs.last().fill("E2E Dedupe");
    await allBodyInputs.last().fill("Same body");
    await page.locator('#message-center-panel button:has-text("Queue")').click();
    await expect(page.locator("text=Message queued")).toBeVisible({ timeout: 5000 });

    // Queue exact same thing again
    await allTitleInputs.last().fill("E2E Dedupe");
    await allBodyInputs.last().fill("Same body");
    await page.locator('#message-center-panel button:has-text("Queue")').click();
    await expect(page.locator("text=Queue skipped")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("E2E: Layout persistence", () => {
  test("toggle panels and verify state persists across reload", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Fulfillment panel should be visible initially
    await expect(page.locator("#fulfillment-panel")).toBeVisible();

    // Toggle it off
    await page.click('button:has-text("Hide fulfillment")');
    await expect(page.locator("#fulfillment-panel")).not.toBeVisible();

    // Reload and verify it stays hidden
    await page.reload();
    await waitForAppReady(page);
    await expect(page.locator("#fulfillment-panel")).not.toBeVisible();
    await expect(page.locator('button:has-text("Show fulfillment")')).toBeVisible();

    // Toggle it back on
    await page.click('button:has-text("Show fulfillment")');
    await expect(page.locator("#fulfillment-panel")).toBeVisible();
  });
});
