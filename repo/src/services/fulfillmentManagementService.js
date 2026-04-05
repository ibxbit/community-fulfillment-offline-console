import { fail, ok } from "./response";

function now() {
  return new Date().toISOString();
}

function containsText(value, query) {
  if (!query) {
    return true;
  }

  const left = String(value ?? "").toLowerCase();
  const right = String(query).toLowerCase();
  return left.includes(right);
}

function inDateRange(dateValue, fromDate, toDate) {
  if (!fromDate && !toDate) {
    return true;
  }

  if (!dateValue) {
    return false;
  }

  const value = Date.parse(dateValue);
  if (Number.isNaN(value)) {
    return false;
  }

  const from = fromDate ? Date.parse(fromDate) : null;
  const to = toDate ? Date.parse(toDate) : null;

  if (from !== null && value < from) {
    return false;
  }

  if (to !== null && value > to) {
    return false;
  }

  return true;
}

function appendLog(document, actor, action, details = {}) {
  return {
    ...document,
    lastUpdatedAt: now(),
    actionLog: [
      ...(document.actionLog ?? []),
      {
        at: now(),
        byUserId: actor?.userId ?? null,
        byRole: actor?.role ?? null,
        action,
        ...details,
      },
    ],
  };
}

function updateStatus(document, actor, status, action, details = {}) {
  return appendLog(
    {
      ...document,
      documentStatus: status,
      statusHistory: [
        ...(document.statusHistory ?? []),
        {
          from: document.documentStatus ?? null,
          to: status,
          at: now(),
          byUserId: actor?.userId ?? null,
          action,
        },
      ],
    },
    actor,
    action,
    details,
  );
}

export function createFulfillmentManagementService(repository, options = {}) {
  const { auditTrail } = options;

  return {
    async search(filters = {}, options = {}) {
      const all = await repository.find({});

      const filtered = all.filter((item) => {
        return (
          containsText(item.itemSku, filters.itemSku) &&
          containsText(item.lot, filters.lot) &&
          containsText(item.warehouseLocation, filters.warehouseLocation) &&
          containsText(item.requester, filters.requester) &&
          (!filters.documentStatus ||
            item.documentStatus === filters.documentStatus) &&
          inDateRange(item.date, filters.fromDate, filters.toDate)
        );
      });

      const sortBy = options.sortBy ?? "date";
      const sortDir = options.sortDir === "asc" ? 1 : -1;
      const page = Math.max(Number(options.page ?? 1), 1);
      const pageSize = Math.max(Number(options.pageSize ?? 10), 1);

      const sorted = [...filtered].sort((a, b) => {
        const left = a[sortBy];
        const right = b[sortBy];

        if (left === right) {
          return 0;
        }

        if (left === undefined || left === null) {
          return 1;
        }

        if (right === undefined || right === null) {
          return -1;
        }

        return left > right ? sortDir : -sortDir;
      });

      const total = sorted.length;
      const skip = (page - 1) * pageSize;
      const items = sorted.slice(skip, skip + pageSize);

      return ok({ items, total, page, pageSize });
    },

    async splitShipment(shipmentId, packages, actor) {
      const shipment = await repository.findOne({ _id: shipmentId });
      if (!shipment) {
        return fail("Shipment not found", 404);
      }

      if (!Array.isArray(packages) || packages.length === 0) {
        return fail("At least one package is required", 400);
      }

      const next = updateStatus(
        {
          ...shipment,
          packages,
        },
        actor,
        shipment.documentStatus ?? "in_progress",
        "shipment_split",
        { packageCount: packages.length },
      );

      const updated = await repository.updateOne({ _id: shipmentId }, next);
      return ok(updated);
    },

    async assignCarrier(shipmentId, carrier, trackingNumber, actor) {
      const shipment = await repository.findOne({ _id: shipmentId });
      if (!shipment) {
        return fail("Shipment not found", 404);
      }

      if (!carrier || !trackingNumber) {
        return fail("Carrier and tracking number are required", 400);
      }

      const next = updateStatus(
        {
          ...shipment,
          carrier,
          trackingNumber,
          shippedAt: now(),
        },
        actor,
        "in_transit",
        "carrier_assigned",
        { carrier, trackingNumber },
      );

      const updated = await repository.updateOne({ _id: shipmentId }, next);

      if (auditTrail) {
        await auditTrail.append({
          action: "ship",
          resourceType: "shipment",
          resourceId: shipmentId,
          actorUserId: actor?.userId ?? null,
          actorRole: actor?.role ?? null,
          metadata: { carrier, trackingNumber },
        });
      }

      return ok(updated);
    },

    async confirmDelivery(shipmentId, confirmation, actor) {
      const shipment = await repository.findOne({ _id: shipmentId });
      if (!shipment) {
        return fail("Shipment not found", 404);
      }

      const next = updateStatus(
        {
          ...shipment,
          deliveryConfirmation: {
            ...confirmation,
            confirmedAt: now(),
          },
        },
        actor,
        "delivered",
        "delivery_confirmed",
      );

      const updated = await repository.updateOne({ _id: shipmentId }, next);
      return ok(updated);
    },

    async logException(shipmentId, type, notes, actor) {
      const allowed = ["damaged", "recipient unavailable"];
      if (!allowed.includes(type)) {
        return fail("Unsupported exception type", 400);
      }

      const shipment = await repository.findOne({ _id: shipmentId });
      if (!shipment) {
        return fail("Shipment not found", 404);
      }

      const exception = {
        type,
        notes: notes ?? "",
        at: now(),
        byUserId: actor?.userId ?? null,
      };

      const next = updateStatus(
        {
          ...shipment,
          exceptions: [...(shipment.exceptions ?? []), exception],
        },
        actor,
        "exception",
        "exception_logged",
        { type },
      );

      const updated = await repository.updateOne({ _id: shipmentId }, next);
      return ok(updated);
    },
  };
}
