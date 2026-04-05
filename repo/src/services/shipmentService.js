import { fail } from "./response";
import { ROLES } from "../auth/roles";

const CAN_ASSIGN_CARRIER = new Set([
  ROLES.WAREHOUSE_STAFF,
  ROLES.OPERATIONS,
  ROLES.ADMIN,
]);

export function createShipmentService({ fulfillmentManagement }) {
  return {
    async assignCarrier({ actor, shipmentId, carrier, trackingNumber }) {
      if (!actor?.userId) {
        return fail("actor.userId is required", 400);
      }

      if (!CAN_ASSIGN_CARRIER.has(actor.role)) {
        return fail("Actor role cannot assign carrier", 403);
      }

      if (!shipmentId || !carrier || !trackingNumber) {
        return fail("shipmentId, carrier, trackingNumber are required", 400);
      }

      return fulfillmentManagement.assignCarrier(
        shipmentId,
        carrier,
        trackingNumber,
        actor,
      );
    },
  };
}
