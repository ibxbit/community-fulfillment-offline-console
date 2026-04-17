import { beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "../src/auth/roles";
import {
  createApiTestContext,
  clearAll,
  seedAllUsers,
  loginAs,
} from "./apiTestHelpers";

describe("Messaging route coverage", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  // ── POST /messaging/templates ──

  describe("POST /messaging/templates", () => {
    it("creates a new template", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /messaging/templates", {
        auth: { token },
        templateId: "welcome",
        title: "Welcome {{name}}",
        body: "Hello {{name}}, you joined {{org}}",
        variables: ["name", "org"],
        defaultPriority: "high",
      });

      expect(result.status).toBe(201);
      expect(result.data.templateId).toBe("welcome");
      expect(result.data.title).toBe("Welcome {{name}}");
      expect(result.data.kind).toBe("template");
      expect(result.data.defaultPriority).toBe("high");
    });

    it("updates an existing template", async () => {
      const token = await loginAs(services, "admin1");

      await services.router.call("POST /messaging/templates", {
        auth: { token },
        templateId: "alert",
        title: "Alert v1",
        body: "Alert body v1",
      });

      const updated = await services.router.call("POST /messaging/templates", {
        auth: { token },
        templateId: "alert",
        title: "Alert v2",
        body: "Alert body v2",
      });

      expect(updated.status).toBe(200);
      expect(updated.data.title).toBe("Alert v2");
    });

    it("rejects missing required fields", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /messaging/templates", {
        auth: { token },
        templateId: "",
        title: "",
        body: "",
      });

      expect(result.status).toBe(400);
      expect(result.error.message).toContain("required");
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("POST /messaging/templates", {
        auth: { token },
        templateId: "t1",
        title: "T",
        body: "B",
      });
      expect(result.status).toBe(403);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call("POST /messaging/templates", {
        templateId: "t1",
        title: "T",
        body: "B",
      });
      expect(result.status).toBe(401);
    });
  });

  // ── GET /messaging/templates — deeper ──

  describe("GET /messaging/templates (deeper)", () => {
    it("returns templates after creation", async () => {
      const token = await loginAs(services, "admin1");

      await services.router.call("POST /messaging/templates", {
        auth: { token },
        templateId: "tmpl1",
        title: "T1",
        body: "B1",
      });

      const studentToken = await loginAs(services, "student1");
      const result = await services.router.call("GET /messaging/templates", {
        auth: { token: studentToken },
      });

      expect(result.status).toBe(200);
      expect(result.data.length).toBe(1);
      expect(result.data[0].templateId).toBe("tmpl1");
    });
  });

  // ── GET /messaging/subscriptions ──

  describe("GET /messaging/subscriptions", () => {
    it("returns default subscription preferences for self", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "GET /messaging/subscriptions",
        {
          auth: { token },
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.preferences).toBeTruthy();
      expect(result.data.preferences.allowAll).toBe(true);
      expect(result.data.preferences.mutedTemplateIds).toEqual([]);
    });

    it("admin can read another user's subscriptions", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call(
        "GET /messaging/subscriptions",
        {
          auth: { token },
          userId: "student_1",
        },
      );

      expect(result.status).toBe(200);
    });

    it("non-admin cannot read another user's subscriptions", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "GET /messaging/subscriptions",
        {
          auth: { token },
          userId: "student_2",
        },
      );

      expect(result.status).toBe(403);
      expect(result.error.message).toContain("subscriptions");
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "GET /messaging/subscriptions",
        {},
      );
      expect(result.status).toBe(401);
    });
  });

  // ── POST /messaging/subscriptions ──

  describe("POST /messaging/subscriptions", () => {
    it("sets subscription preferences for self", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "POST /messaging/subscriptions",
        {
          auth: { token },
          preferences: {
            allowAll: false,
            mutedTemplateIds: ["promo"],
            mutedPriorities: ["low"],
          },
        },
      );

      expect(result.status).toBe(201);
      expect(result.data.preferences.allowAll).toBe(false);
      expect(result.data.preferences.mutedTemplateIds).toEqual(["promo"]);
    });

    it("persists and is returned by GET", async () => {
      const token = await loginAs(services, "student1");

      await services.router.call("POST /messaging/subscriptions", {
        auth: { token },
        preferences: {
          allowAll: true,
          mutedTemplateIds: ["alert"],
          mutedPriorities: [],
        },
      });

      const get = await services.router.call("GET /messaging/subscriptions", {
        auth: { token },
      });

      expect(get.data.preferences.mutedTemplateIds).toEqual(["alert"]);
    });

    it("non-admin cannot update another user's subscriptions", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "POST /messaging/subscriptions",
        {
          auth: { token },
          userId: "student_2",
          preferences: { allowAll: false },
        },
      );

      expect(result.status).toBe(403);
    });

    it("admin can update another user's subscriptions", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call(
        "POST /messaging/subscriptions",
        {
          auth: { token },
          userId: "student_1",
          preferences: { allowAll: false },
        },
      );

      expect(result.status).toBe(201);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "POST /messaging/subscriptions",
        { preferences: {} },
      );
      expect(result.status).toBe(401);
    });
  });

  // ── GET /messaging/queue ──

  describe("GET /messaging/queue", () => {
    it("returns empty queue for user with no messages", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("GET /messaging/queue", {
        auth: { token },
      });

      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(0);
    });

    it("returns queued messages after queueing", async () => {
      const token = await loginAs(services, "student1");

      await services.router.call("POST /messaging/queue", {
        auth: { token },
        recipientUserId: "student_1",
        title: "Test",
        body: "Body",
        priority: "high",
      });

      const result = await services.router.call("GET /messaging/queue", {
        auth: { token },
      });

      expect(result.status).toBe(200);
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe("Test");
      expect(result.data[0].priority).toBe("high");
    });

    it("non-admin cannot read another user's queue", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("GET /messaging/queue", {
        auth: { token },
        recipientUserId: "student_2",
      });

      expect(result.status).toBe(403);
    });

    it("admin can read another user's queue", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("GET /messaging/queue", {
        auth: { token },
        recipientUserId: "student_1",
      });

      expect(result.status).toBe(200);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call("GET /messaging/queue", {});
      expect(result.status).toBe(401);
    });
  });

  // ── POST /messaging/queue — deeper ──

  describe("POST /messaging/queue (deeper)", () => {
    it("queues message with full payload assertions", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("POST /messaging/queue", {
        auth: { token },
        recipientUserId: "student_1",
        title: "Important",
        body: "Action required",
        priority: "high",
      });

      expect(result.status).toBe(201);
      expect(result.data._id).toBeTruthy();
      expect(result.data.kind).toBe("message");
      expect(result.data.recipientUserId).toBe("student_1");
      expect(result.data.status).toBe("queued");
      expect(result.data.priorityWeight).toBe(3);
      expect(result.data.queuedAt).toBeTruthy();
    });

    it("respects subscription muting", async () => {
      const token = await loginAs(services, "student1");

      await services.router.call("POST /messaging/subscriptions", {
        auth: { token },
        preferences: {
          allowAll: false,
        },
      });

      const result = await services.router.call("POST /messaging/queue", {
        auth: { token },
        recipientUserId: "student_1",
        title: "Muted",
        body: "Should be skipped",
      });

      expect(result.status).toBe(202);
      expect(result.data.skipped).toBe(true);
      expect(result.data.reason).toBe("user_subscriptions_blocked");
    });

    it("queues template-based message with interpolation", async () => {
      const adminToken = await loginAs(services, "admin1");
      await services.router.call("POST /messaging/templates", {
        auth: { token: adminToken },
        templateId: "greet",
        title: "Hi {{user}}",
        body: "Welcome {{user}} to {{place}}",
      });

      const opsToken = await loginAs(services, "ops1");
      const result = await services.router.call("POST /messaging/queue", {
        auth: { token: opsToken },
        recipientUserId: "student_1",
        templateId: "greet",
        variables: { user: "Alice", place: "School" },
        priority: "normal",
      });

      expect(result.status).toBe(201);
      expect(result.data.title).toBe("Hi Alice");
      expect(result.data.body).toBe("Welcome Alice to School");
    });
  });

  // ── POST /messaging/deliver-next — deeper ──

  describe("POST /messaging/deliver-next (deeper)", () => {
    it("delivers message and creates receipt", async () => {
      const token = await loginAs(services, "student1");

      await services.router.call("POST /messaging/queue", {
        auth: { token },
        recipientUserId: "student_1",
        title: "Deliver Me",
        body: "Content",
        priority: "normal",
      });

      const delivered = await services.router.call(
        "POST /messaging/deliver-next",
        {
          auth: { token },
          recipientUserId: "student_1",
        },
      );

      expect(delivered.status).toBe(200);
      expect(delivered.data.status).toBe("delivered");
      expect(delivered.data.deliveredAt).toBeTruthy();

      const receipts = await services.router.call("GET /messaging/receipts", {
        auth: { token },
        recipientUserId: "student_1",
      });

      expect(receipts.status).toBe(200);
      expect(receipts.data.length).toBe(1);
      expect(receipts.data[0].notificationId).toBe(delivered.data._id);
    });

    it("returns null when queue is empty", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "POST /messaging/deliver-next",
        {
          auth: { token },
          recipientUserId: "student_1",
        },
      );

      expect(result.status).toBe(200);
      expect(result.data).toBeNull();
    });

    it("delivers highest priority first", async () => {
      const token = await loginAs(services, "student1");

      await services.router.call("POST /messaging/queue", {
        auth: { token },
        recipientUserId: "student_1",
        title: "Low",
        body: "Low priority",
        priority: "low",
      });

      // small delay to avoid dedupe
      await new Promise((r) => setTimeout(r, 10));

      await services.router.call("POST /messaging/queue", {
        auth: { token },
        recipientUserId: "student_1",
        title: "High",
        body: "High priority",
        priority: "high",
      });

      const delivered = await services.router.call(
        "POST /messaging/deliver-next",
        {
          auth: { token },
          recipientUserId: "student_1",
        },
      );

      expect(delivered.data.title).toBe("High");
    });
  });

  // ── GET /messaging/receipts — deeper ──

  describe("GET /messaging/receipts (deeper)", () => {
    it("returns empty receipts initially", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("GET /messaging/receipts", {
        auth: { token },
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual([]);
    });

    it("non-admin cannot read another user's receipts", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("GET /messaging/receipts", {
        auth: { token },
        recipientUserId: "student_2",
      });

      expect(result.status).toBe(403);
    });
  });
});
