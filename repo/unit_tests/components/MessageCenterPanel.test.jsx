import { describe, expect, it, vi, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageCenterPanel } from "../../src/modules/messaging/MessageCenterPanel";

afterEach(cleanup);

function createMockMessagingService() {
  return {
    listTemplates: vi.fn().mockResolvedValue({
      status: 200,
      data: [
        { _id: "template_t1", templateId: "t1", defaultPriority: "normal" },
      ],
      error: null,
    }),
    listQueue: vi.fn().mockResolvedValue({
      status: 200,
      data: [
        { _id: "msg-1", title: "Queued Msg", priority: "high" },
      ],
      error: null,
    }),
    listReceipts: vi.fn().mockResolvedValue({
      status: 200,
      data: [
        {
          _id: "rcpt-1",
          notificationId: "msg-delivered",
          deliveredAt: "2026-04-16T10:00:00Z",
        },
      ],
      error: null,
    }),
    getSubscriptionPreferences: vi.fn().mockResolvedValue({
      status: 200,
      data: {
        preferences: {
          allowAll: true,
          mutedTemplateIds: [],
          mutedPriorities: [],
        },
      },
      error: null,
    }),
    upsertTemplate: vi.fn().mockResolvedValue({
      status: 201,
      data: { templateId: "new-tmpl" },
      error: null,
    }),
    setSubscriptionPreferences: vi.fn().mockResolvedValue({
      status: 201,
      data: { preferences: { allowAll: true } },
      error: null,
    }),
    queueMessage: vi.fn().mockResolvedValue({
      status: 201,
      data: { _id: "msg-new", skipped: false },
      error: null,
    }),
    deliverNext: vi.fn().mockResolvedValue({
      status: 200,
      data: { _id: "msg-1", status: "delivered" },
      error: null,
    }),
  };
}

const ACTOR = { userId: "student_1", role: "Student" };

describe("MessageCenterPanel", () => {
  it("renders heading", () => {
    render(
      <MessageCenterPanel
        messagingService={createMockMessagingService()}
        actor={ACTOR}
      />,
    );
    expect(screen.getByText("Message Center")).toBeTruthy();
  });

  it("shows loading state on initial refresh", async () => {
    const service = createMockMessagingService();
    service.listTemplates.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ status: 200, data: [], error: null }),
            100,
          ),
        ),
    );

    render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    expect(screen.getByText("Loading message center...")).toBeTruthy();
  });

  it("loads and displays templates, queue, and receipts on mount", async () => {
    const service = createMockMessagingService();

    render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/t1/)).toBeTruthy();
    });

    expect(screen.getByText(/Queued Msg/)).toBeTruthy();
    expect(screen.getByText(/msg-delivered/)).toBeTruthy();
  });

  it("shows error when service fails", async () => {
    const service = createMockMessagingService();
    service.listTemplates.mockResolvedValue({
      status: 500,
      data: null,
      error: { message: "Service error" },
    });

    render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Service error")).toBeTruthy();
    });
  });

  it("saves a template", async () => {
    const user = userEvent.setup();
    const service = createMockMessagingService();

    const { container } = render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.listTemplates).toHaveBeenCalled());

    // Use the Template ID field which is unique
    await user.type(screen.getByPlaceholderText("Template ID"), "my-template");
    // "Title" appears in both template and queue sections; pick the first one
    const titleInputs = container.querySelectorAll('input[placeholder="Title"]');
    await user.type(titleInputs[0], "My Title");
    await user.type(
      screen.getByPlaceholderText("Body with {{var}}"),
      "My Body",
    );

    await user.click(screen.getByText("Save template"));

    await waitFor(() => {
      expect(service.upsertTemplate).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Template saved")).toBeTruthy();
  });

  it("saves subscription preferences", async () => {
    const user = userEvent.setup();
    const service = createMockMessagingService();

    render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.listTemplates).toHaveBeenCalled());

    await user.click(screen.getByText("Save preferences"));

    await waitFor(() => {
      expect(service.setSubscriptionPreferences).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Subscription preferences saved")).toBeTruthy();
  });

  it("queues a message", async () => {
    const user = userEvent.setup();
    const service = createMockMessagingService();

    const { container } = render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.listTemplates).toHaveBeenCalled());

    // "Title" and "Body" placeholders appear in both template and queue sections
    const titleInputs = container.querySelectorAll('input[placeholder="Title"]');
    const bodyInputs = container.querySelectorAll('input[placeholder="Body"]');
    await user.type(titleInputs[titleInputs.length - 1], "Test Queue");
    await user.type(bodyInputs[bodyInputs.length - 1], "Queue body");

    await user.click(screen.getByRole("button", { name: "Queue" }));

    await waitFor(() => {
      expect(service.queueMessage).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Message queued")).toBeTruthy();
  });

  it("shows skipped message when queue returns skipped", async () => {
    const user = userEvent.setup();
    const service = createMockMessagingService();
    service.queueMessage.mockResolvedValue({
      status: 202,
      data: { skipped: true, reason: "duplicate_within_60s" },
      error: null,
    });

    const { container } = render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.listTemplates).toHaveBeenCalled());

    const titleInputs = container.querySelectorAll('input[placeholder="Title"]');
    const bodyInputs = container.querySelectorAll('input[placeholder="Body"]');
    await user.type(titleInputs[titleInputs.length - 1], "Dup");
    await user.type(bodyInputs[bodyInputs.length - 1], "Dup body");
    await user.click(screen.getByRole("button", { name: "Queue" }));

    await waitFor(() => {
      expect(
        screen.getByText("Queue skipped: duplicate_within_60s"),
      ).toBeTruthy();
    });
  });

  it("delivers next message", async () => {
    const user = userEvent.setup();
    const service = createMockMessagingService();

    render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.listTemplates).toHaveBeenCalled());
    await user.click(screen.getByText("Deliver next"));

    await waitFor(() => {
      expect(service.deliverNext).toHaveBeenCalledWith("student_1");
    });

    expect(screen.getByText("Delivered next message")).toBeTruthy();
  });

  it("shows no queued messages when deliver returns null", async () => {
    const user = userEvent.setup();
    const service = createMockMessagingService();
    service.deliverNext.mockResolvedValue({
      status: 200,
      data: null,
      error: null,
    });

    render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.listTemplates).toHaveBeenCalled());
    await user.click(screen.getByText("Deliver next"));

    await waitFor(() => {
      expect(screen.getByText("No queued messages")).toBeTruthy();
    });
  });

  it("disables controls when busy", async () => {
    const user = userEvent.setup();
    const service = createMockMessagingService();
    service.upsertTemplate.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ status: 201, data: {}, error: null }),
            200,
          ),
        ),
    );

    const { container } = render(
      <MessageCenterPanel messagingService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.listTemplates).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText("Template ID"), "t");
    const titleInputs = container.querySelectorAll('input[placeholder="Title"]');
    await user.type(titleInputs[0], "t");
    await user.type(screen.getByPlaceholderText("Body with {{var}}"), "b");
    await user.click(screen.getByText("Save template"));

    // While busy, buttons should be disabled
    const saveButton = screen.getByText("Save template");
    expect(saveButton.disabled).toBe(true);
  });
});
