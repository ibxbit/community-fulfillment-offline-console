import { useEffect, useState } from "react";

export function MessageCenterPanel({ messagingService, actor }) {
  const [templates, setTemplates] = useState([]);
  const [queue, setQueue] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [templateForm, setTemplateForm] = useState({
    templateId: "",
    title: "",
    body: "",
    defaultPriority: "normal",
  });
  const [subscriptionForm, setSubscriptionForm] = useState({
    allowAll: true,
    mutedTemplateIds: "",
    mutedPriorities: "",
  });
  const [queueForm, setQueueForm] = useState({
    recipientUserId: actor?.userId ?? "",
    templateId: "",
    title: "",
    body: "",
    priority: "normal",
  });

  async function refresh() {
    if (!messagingService || !actor?.userId) {
      return;
    }

    setLoading(true);
    const [templatesResult, queueResult, receiptsResult, preferencesResult] =
      await Promise.all([
        messagingService.listTemplates(),
        messagingService.listQueue(actor.userId),
        messagingService.listReceipts(actor.userId),
        messagingService.getSubscriptionPreferences(actor.userId),
      ]);

    if (
      templatesResult.error ||
      queueResult.error ||
      receiptsResult.error ||
      preferencesResult.error
    ) {
      setError(
        templatesResult.error?.message ||
          queueResult.error?.message ||
          receiptsResult.error?.message ||
          preferencesResult.error?.message ||
          "Failed to load message center",
      );
    } else {
      setTemplates(templatesResult.data);
      setQueue(queueResult.data);
      setReceipts(receiptsResult.data);

      const prefs = preferencesResult.data.preferences;
      setSubscriptionForm({
        allowAll: prefs.allowAll,
        mutedTemplateIds: prefs.mutedTemplateIds.join(","),
        mutedPriorities: prefs.mutedPriorities.join(","),
      });
      setError("");
    }

    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagingService, actor?.userId]);

  async function saveTemplate() {
    setBusy(true);
    const result = await messagingService.upsertTemplate(templateForm);
    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage("Template saved");
    setTemplateForm({
      templateId: "",
      title: "",
      body: "",
      defaultPriority: "normal",
    });
    await refresh();
  }

  async function saveSubscription() {
    setBusy(true);
    const result = await messagingService.setSubscriptionPreferences(
      actor.userId,
      {
        allowAll: subscriptionForm.allowAll,
        mutedTemplateIds: subscriptionForm.mutedTemplateIds
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        mutedPriorities: subscriptionForm.mutedPriorities
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      },
    );
    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage("Subscription preferences saved");
    await refresh();
  }

  async function queueMessage() {
    setBusy(true);
    const result = await messagingService.queueMessage(queueForm);
    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage(
      result.data.skipped
        ? `Queue skipped: ${result.data.reason}`
        : "Message queued",
    );
    await refresh();
  }

  async function deliverNext() {
    setBusy(true);
    const result = await messagingService.deliverNext(actor.userId);
    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage(result.data ? "Delivered next message" : "No queued messages");
    await refresh();
  }

  return (
    <section className="panel" id="message-center-panel">
      <h2>Message Center</h2>

      {loading ? <p>Loading message center...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <div className="admin-grid">
        <div>
          <h3>Templates</h3>
          <input
            placeholder="Template ID"
            value={templateForm.templateId}
            onChange={(event) =>
              setTemplateForm((current) => ({
                ...current,
                templateId: event.target.value,
              }))
            }
            disabled={busy}
          />
          <input
            placeholder="Title"
            value={templateForm.title}
            onChange={(event) =>
              setTemplateForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            disabled={busy}
          />
          <input
            placeholder="Body with {{var}}"
            value={templateForm.body}
            onChange={(event) =>
              setTemplateForm((current) => ({
                ...current,
                body: event.target.value,
              }))
            }
            disabled={busy}
          />
          <select
            value={templateForm.defaultPriority}
            onChange={(event) =>
              setTemplateForm((current) => ({
                ...current,
                defaultPriority: event.target.value,
              }))
            }
            disabled={busy}
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
          </select>
          <button type="button" onClick={saveTemplate} disabled={busy}>
            Save template
          </button>
          <ul>
            {templates.map((template) => (
              <li key={template._id}>
                {template.templateId} | {template.defaultPriority}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Subscriptions</h3>
          <label>
            <input
              type="checkbox"
              checked={subscriptionForm.allowAll}
              onChange={(event) =>
                setSubscriptionForm((current) => ({
                  ...current,
                  allowAll: event.target.checked,
                }))
              }
              disabled={busy}
            />
            Allow all in-app messages
          </label>
          <input
            placeholder="Muted template IDs (comma)"
            value={subscriptionForm.mutedTemplateIds}
            onChange={(event) =>
              setSubscriptionForm((current) => ({
                ...current,
                mutedTemplateIds: event.target.value,
              }))
            }
            disabled={busy}
          />
          <input
            placeholder="Muted priorities (comma)"
            value={subscriptionForm.mutedPriorities}
            onChange={(event) =>
              setSubscriptionForm((current) => ({
                ...current,
                mutedPriorities: event.target.value,
              }))
            }
            disabled={busy}
          />
          <button type="button" onClick={saveSubscription} disabled={busy}>
            Save preferences
          </button>
        </div>

        <div>
          <h3>Queue Message</h3>
          <input
            placeholder="Recipient user ID"
            value={queueForm.recipientUserId}
            onChange={(event) =>
              setQueueForm((current) => ({
                ...current,
                recipientUserId: event.target.value,
              }))
            }
            disabled={busy}
          />
          <input
            placeholder="Template ID (optional)"
            value={queueForm.templateId}
            onChange={(event) =>
              setQueueForm((current) => ({
                ...current,
                templateId: event.target.value,
              }))
            }
            disabled={busy}
          />
          <input
            placeholder="Title"
            value={queueForm.title}
            onChange={(event) =>
              setQueueForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            disabled={busy}
          />
          <input
            placeholder="Body"
            value={queueForm.body}
            onChange={(event) =>
              setQueueForm((current) => ({
                ...current,
                body: event.target.value,
              }))
            }
            disabled={busy}
          />
          <select
            value={queueForm.priority}
            onChange={(event) =>
              setQueueForm((current) => ({
                ...current,
                priority: event.target.value,
              }))
            }
            disabled={busy}
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
          </select>
          <button type="button" onClick={queueMessage} disabled={busy}>
            Queue
          </button>
          <button type="button" onClick={deliverNext} disabled={busy}>
            Deliver next
          </button>
        </div>

        <div>
          <h3>Queue</h3>
          {queue.length === 0 ? <p>No queued messages.</p> : null}
          <ul>
            {queue.map((item) => (
              <li key={item._id}>
                {item.priority} | {item.title}
              </li>
            ))}
          </ul>

          <h3>Receipts</h3>
          {receipts.length === 0 ? <p>No receipts.</p> : null}
          <ul>
            {receipts.map((receipt) => (
              <li key={receipt._id}>
                {receipt.notificationId} | {receipt.deliveredAt}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
