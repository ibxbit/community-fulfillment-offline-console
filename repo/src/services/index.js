import { COLLECTIONS, createDbContext } from "../db";
import { canAccessResource, hasPermission } from "../auth/rbac";
import { PERMISSIONS, ROLES } from "../auth/roles";
import { createAdminConfigService } from "./adminConfigService";
import { createAuthApiService } from "./authApiService";
import { createBaseService } from "./baseService";
import { createBulkDataService } from "./bulkDataService";
import { createDashboardService } from "./dashboardService";
import { createFulfillmentManagementService } from "./fulfillmentManagementService";
import { createInAppMessagingService } from "./inAppMessagingService";
import { createIntegrationValidationService } from "./integrationValidationService";
import { createRequestLifecycleService } from "./requestLifecycleService";
import { createRequestService } from "./requestService";
import { createReviewerToolsService } from "./reviewerToolsService";
import { createServiceRouter } from "./router";
import { createShipmentService } from "./shipmentService";
import { createTamperAuditLogService } from "./tamperAuditLogService";

function route(handler, config = {}) {
  return {
    handler,
    ...config,
  };
}

function resourceGuard(getResource, action) {
  return async ({ payload, authUser }) => {
    const resourceId = payload?.requestId ?? payload?.shipmentId;
    if (!resourceId) {
      return {
        ok: false,
        status: 400,
        message: "Resource identifier required",
      };
    }

    const resource = await getResource(resourceId);
    if (!resource) {
      return { ok: false, status: 404, message: "Resource not found" };
    }

    const allowed = canAccessResource(authUser, {
      resource: "requests",
      action,
      orgId: resource.requestingOrgId,
      classId: resource.requestingClassId,
      ownerUserId: resource.ownerUserId,
      requesterUserId: resource.requesterUserId,
    });

    return allowed
      ? { ok: true }
      : { ok: false, status: 403, message: "Scope or ownership restriction" };
  };
}

export function createAppServices(options = {}) {
  const { plugins = null } = options;
  const db = createDbContext();
  const collections = db.collections;

  const authApiService = createAuthApiService(collections);
  const auditTrailService = createTamperAuditLogService(
    collections[COLLECTIONS.audit_logs],
  );

  const usersService = createBaseService(collections[COLLECTIONS.users], {
    auditTrail: auditTrailService,
    resourceType: "user",
  });
  const sessionsService = createBaseService(collections[COLLECTIONS.sessions], {
    auditTrail: auditTrailService,
    resourceType: "session",
  });
  const submissionsService = createBaseService(
    collections[COLLECTIONS.submissions],
    {
      auditTrail: auditTrailService,
      resourceType: "submission",
    },
  );
  const fulfillmentsService = createBaseService(
    collections[COLLECTIONS.fulfillments],
    {
      auditTrail: auditTrailService,
      resourceType: "fulfillment",
    },
  );

  const requestsLifecycleService = createRequestLifecycleService(
    collections[COLLECTIONS.requests],
    {
      auditTrail: auditTrailService,
    },
  );
  const reviewerToolsService = createReviewerToolsService({
    requests: collections[COLLECTIONS.requests],
    reviews: collections[COLLECTIONS.reviews],
    auditTrail: auditTrailService,
  });
  const fulfillmentManagementService = createFulfillmentManagementService(
    collections[COLLECTIONS.shipments],
    {
      auditTrail: auditTrailService,
    },
  );
  const adminConfigService = createAdminConfigService({
    serviceAreas: collections[COLLECTIONS.service_areas],
    groupLeaders: collections[COLLECTIONS.group_leaders],
    commissions: collections[COLLECTIONS.commissions],
    settlements: collections[COLLECTIONS.settlements],
  });
  const bulkDataService = createBulkDataService({ collections });
  const inAppMessagingService = createInAppMessagingService(
    collections[COLLECTIONS.notifications],
  );
  const requestService = createRequestService({
    requestLifecycle: requestsLifecycleService,
    requestsRepository: collections[COLLECTIONS.requests],
  });
  const shipmentService = createShipmentService({
    fulfillmentManagement: fulfillmentManagementService,
  });
  const dashboardService = createDashboardService({
    requests: collections[COLLECTIONS.requests],
    reviews: collections[COLLECTIONS.reviews],
    shipments: collections[COLLECTIONS.shipments],
    notifications: collections[COLLECTIONS.notifications],
  });
  const integrationValidationService = createIntegrationValidationService({
    services: {
      requestService,
      shipmentService,
      auditTrail: auditTrailService,
    },
    plugins: plugins ?? {
      list() {
        return [];
      },
      async runPlugin() {
        return { ok: false, error: { message: "plugin host unavailable" } };
      },
    },
  });

  const routes = {
    "POST /auth/login": route((payload) => authApiService.login(payload)),
    "POST /auth/logout": route((payload) => authApiService.logout(payload), {
      auth: true,
    }),
    "POST /auth/keepalive": route(
      (payload) => authApiService.keepalive(payload),
      { auth: true },
    ),
    "POST /auth/change-password": route(
      (payload) => authApiService.changePassword(payload),
      { auth: true },
    ),

    "GET /users": route(
      (payload) => usersService.list(payload?.query, payload?.options),
      { auth: true, permission: PERMISSIONS.USERS_READ },
    ),
    "POST /users": route((payload) => usersService.create(payload), {
      auth: true,
      permission: PERMISSIONS.USERS_MANAGE,
    }),

    "GET /submissions": route(
      (payload) => submissionsService.list(payload?.query, payload?.options),
      {
        auth: true,
        permission: PERMISSIONS.REQUESTS_READ,
      },
    ),
    "POST /submissions": route(
      (payload) => submissionsService.create(payload),
      {
        auth: true,
        permission: PERMISSIONS.REQUESTS_CREATE,
      },
    ),

    "GET /fulfillments": route(
      (payload) => fulfillmentsService.list(payload?.query, payload?.options),
      {
        auth: true,
        permission: PERMISSIONS.FULFILLMENT_READ ?? PERMISSIONS.SHIPMENTS_READ,
      },
    ),
    "POST /fulfillments": route(
      (payload) => fulfillmentsService.create(payload),
      {
        auth: true,
        permission:
          PERMISSIONS.FULFILLMENT_WRITE ?? PERMISSIONS.SHIPMENTS_UPDATE,
      },
    ),

    "GET /requests": route(
      (payload) =>
        requestService.list({
          filter: payload?.query,
          options: payload?.options,
        }),
      {
        auth: true,
        permission: PERMISSIONS.REQUESTS_READ,
      },
    ),
    "POST /requests/draft": route(
      (payload) =>
        requestService.create({
          actor: payload?.actor,
          payload: payload?.data,
        }),
      {
        auth: true,
        permission: PERMISSIONS.REQUESTS_CREATE,
        guard: async ({ payload, authUser }) => {
          if (!payload?.actor || payload.actor.userId !== authUser._id) {
            return { ok: false, status: 403, message: "Actor mismatch" };
          }

          return { ok: true };
        },
      },
    ),
    "PATCH /requests/draft": route(
      (payload) =>
        requestService.update({
          actor: payload?.actor,
          requestId: payload?.requestId,
          patch: payload?.patch,
        }),
      {
        auth: true,
        permission: PERMISSIONS.REQUESTS_UPDATE,
        guard: resourceGuard(
          (requestId) =>
            collections[COLLECTIONS.requests].findOne({ _id: requestId }),
          "update",
        ),
      },
    ),
    "POST /requests/submit": route(
      (payload) =>
        requestService.submit({
          actor: payload?.actor,
          requestId: payload?.requestId,
        }),
      {
        auth: true,
        permission: PERMISSIONS.REQUESTS_UPDATE,
        guard: resourceGuard(
          (requestId) =>
            collections[COLLECTIONS.requests].findOne({ _id: requestId }),
          "update",
        ),
      },
    ),
    "POST /requests/review/approve": route(
      (payload) =>
        reviewerToolsService.approve(
          payload?.actor,
          payload?.requestId,
          payload?.comment,
        ),
      {
        auth: true,
        permission: PERMISSIONS.REVIEWS_DECIDE,
        guard: resourceGuard(
          (requestId) =>
            collections[COLLECTIONS.requests].findOne({ _id: requestId }),
          "read",
        ),
      },
    ),
    "POST /requests/review/return": route(
      (payload) =>
        reviewerToolsService.returnWithComments(
          payload?.actor,
          payload?.requestId,
          payload?.comment,
        ),
      {
        auth: true,
        permission: PERMISSIONS.REVIEWS_DECIDE,
        guard: resourceGuard(
          (requestId) =>
            collections[COLLECTIONS.requests].findOne({ _id: requestId }),
          "read",
        ),
      },
    ),
    "POST /requests/review/comment": route(
      (payload) =>
        reviewerToolsService.addComment(
          payload?.actor,
          payload?.requestId,
          payload?.comment,
        ),
      {
        auth: true,
        permission: PERMISSIONS.REVIEWS_READ,
      },
    ),
    "POST /requests/review/exception": route(
      (payload) =>
        reviewerToolsService.attachExceptionReason(
          payload?.actor,
          payload?.requestId,
          payload?.reason,
        ),
      {
        auth: true,
        permission: PERMISSIONS.REVIEWS_DECIDE,
      },
    ),
    "POST /requests/archive": route(
      (payload) =>
        requestService.archive({
          actor: payload?.actor,
          requestId: payload?.requestId,
        }),
      {
        auth: true,
        permission: PERMISSIONS.REQUESTS_UPDATE,
        guard: resourceGuard(
          (requestId) =>
            collections[COLLECTIONS.requests].findOne({ _id: requestId }),
          "update",
        ),
      },
    ),

    "POST /fulfillment/search": route(
      (payload) =>
        fulfillmentManagementService.search(payload?.filters, payload?.options),
      {
        auth: true,
        permission: PERMISSIONS.SHIPMENTS_READ,
      },
    ),
    "POST /fulfillment/split": route(
      (payload) =>
        fulfillmentManagementService.splitShipment(
          payload?.shipmentId,
          payload?.packages,
          payload?.actor,
        ),
      {
        auth: true,
        permission: PERMISSIONS.SHIPMENTS_UPDATE,
      },
    ),
    "POST /fulfillment/assign-carrier": route(
      (payload) =>
        shipmentService.assignCarrier({
          actor: payload?.actor,
          shipmentId: payload?.shipmentId,
          carrier: payload?.carrier,
          trackingNumber: payload?.trackingNumber,
        }),
      {
        auth: true,
        permission: PERMISSIONS.SHIPMENTS_UPDATE,
      },
    ),
    "POST /fulfillment/confirm-delivery": route(
      (payload) =>
        fulfillmentManagementService.confirmDelivery(
          payload?.shipmentId,
          payload?.confirmation,
          payload?.actor,
        ),
      {
        auth: true,
        permission: PERMISSIONS.SHIPMENTS_UPDATE,
      },
    ),
    "POST /fulfillment/log-exception": route(
      (payload) =>
        fulfillmentManagementService.logException(
          payload?.shipmentId,
          payload?.type,
          payload?.notes,
          payload?.actor,
        ),
      {
        auth: true,
        permission: PERMISSIONS.SHIPMENTS_UPDATE,
      },
    ),

    "GET /admin/service-areas": route(
      () => adminConfigService.listServiceAreas(),
      {
        auth: true,
        permission: PERMISSIONS.SERVICE_AREAS_READ,
      },
    ),
    "POST /admin/service-areas": route(
      (payload) => adminConfigService.upsertServiceArea(payload),
      {
        auth: true,
        permission: PERMISSIONS.USERS_MANAGE,
      },
    ),
    "GET /admin/group-leader-bindings": route(
      () => adminConfigService.listLeaderBindings(),
      {
        auth: true,
        permission: PERMISSIONS.GROUP_LEADERS_READ,
      },
    ),
    "POST /admin/group-leader-bindings": route(
      (payload) => adminConfigService.bindGroupLeaderToLocation(payload),
      {
        auth: true,
        permission: PERMISSIONS.USERS_MANAGE,
      },
    ),
    "GET /admin/commission-rule": route(
      () => adminConfigService.getCommissionRule(),
      {
        auth: true,
        permission: PERMISSIONS.COMMISSIONS_READ,
      },
    ),
    "POST /admin/commission-rule": route(
      (payload) => adminConfigService.setCommissionRule(payload),
      {
        auth: true,
        permission: PERMISSIONS.SETTLEMENTS_UPDATE,
      },
    ),
    "POST /admin/commission-calc": route(
      (payload) => adminConfigService.calculateCommission(payload?.orderValue),
      {
        auth: true,
        permission: PERMISSIONS.COMMISSIONS_READ,
      },
    ),
    "GET /admin/settlement-cycle": route(
      () => adminConfigService.getSettlementCycle(),
      {
        auth: true,
        permission: PERMISSIONS.SETTLEMENTS_READ,
      },
    ),
    "POST /admin/settlement-cycle": route(
      (payload) => adminConfigService.setSettlementCycle(payload),
      {
        auth: true,
        permission: PERMISSIONS.SETTLEMENTS_UPDATE,
      },
    ),
    "GET /admin/attribution-rules": route(
      () => adminConfigService.getAttributionRules(),
      {
        auth: true,
        permission: PERMISSIONS.SERVICE_AREAS_READ,
      },
    ),
    "POST /admin/attribution-rules": route(
      (payload) => adminConfigService.setAttributionRules(payload),
      {
        auth: true,
        permission: PERMISSIONS.USERS_MANAGE,
      },
    ),
    "POST /admin/attribution-resolve": route(
      (payload) => adminConfigService.resolveAttribution(payload),
      {
        auth: true,
        permission: PERMISSIONS.SERVICE_AREAS_READ,
      },
    ),
    "POST /admin/bulk/template": route(
      (payload) => bulkDataService.generateTemplate(payload),
      {
        auth: true,
        permission: PERMISSIONS.USERS_MANAGE,
      },
    ),
    "POST /admin/bulk/export": route(
      (payload) => bulkDataService.exportData(payload),
      {
        auth: true,
        permission: PERMISSIONS.USERS_MANAGE,
      },
    ),
    "POST /admin/bulk/import": route(
      (payload) => bulkDataService.importData(payload),
      {
        auth: true,
        permission: PERMISSIONS.USERS_MANAGE,
      },
    ),

    "GET /audit/verify-chain": route(() => auditTrailService.verifyChain(), {
      auth: true,
      permission: PERMISSIONS.AUDIT_LOGS_READ,
    }),

    "GET /messaging/templates": route(
      () => inAppMessagingService.listTemplates(),
      {
        auth: true,
        permission: PERMISSIONS.NOTIFICATIONS_READ,
      },
    ),
    "POST /messaging/templates": route(
      (payload) => inAppMessagingService.upsertTemplate(payload),
      {
        auth: true,
        permission: PERMISSIONS.USERS_MANAGE,
      },
    ),
    "GET /messaging/subscriptions": route(
      (payload, authUser) =>
        inAppMessagingService.getSubscriptionPreferences(
          payload?.userId ?? authUser._id,
        ),
      {
        auth: true,
        permission: PERMISSIONS.NOTIFICATIONS_READ,
        guard: async ({ payload, authUser }) => {
          const target = payload?.userId ?? authUser._id;
          const allowed =
            target === authUser._id || authUser.role === ROLES.ADMIN;
          return allowed
            ? { ok: true }
            : {
                ok: false,
                status: 403,
                message: "Cannot read another user's subscriptions",
              };
        },
      },
    ),
    "POST /messaging/subscriptions": route(
      (payload, authUser) =>
        inAppMessagingService.setSubscriptionPreferences(
          payload?.userId ?? authUser._id,
          payload?.preferences,
        ),
      {
        auth: true,
        permission: PERMISSIONS.NOTIFICATIONS_READ,
        guard: async ({ payload, authUser }) => {
          const target = payload?.userId ?? authUser._id;
          const allowed =
            target === authUser._id || authUser.role === ROLES.ADMIN;
          return allowed
            ? { ok: true }
            : {
                ok: false,
                status: 403,
                message: "Cannot update another user's subscriptions",
              };
        },
      },
    ),
    "POST /messaging/queue": route(
      (payload) => inAppMessagingService.queueMessage(payload),
      {
        auth: true,
        permission: PERMISSIONS.NOTIFICATIONS_READ,
        guard: async ({ payload, authUser }) => {
          const target = payload?.recipientUserId;
          if (!target) {
            return {
              ok: false,
              status: 400,
              message: "recipientUserId is required",
            };
          }

          const allowed =
            target === authUser._id ||
            authUser.role === ROLES.ADMIN ||
            authUser.role === ROLES.OPERATIONS;
          return allowed
            ? { ok: true }
            : {
                ok: false,
                status: 403,
                message: "Cannot queue message for this recipient",
              };
        },
      },
    ),
    "GET /messaging/queue": route(
      (payload, authUser) =>
        inAppMessagingService.listQueue(
          payload?.recipientUserId ?? authUser._id,
        ),
      {
        auth: true,
        permission: PERMISSIONS.NOTIFICATIONS_READ,
        guard: async ({ payload, authUser }) => {
          const target = payload?.recipientUserId ?? authUser._id;
          const allowed =
            target === authUser._id || authUser.role === ROLES.ADMIN;
          return allowed
            ? { ok: true }
            : {
                ok: false,
                status: 403,
                message: "Cannot read another user's queue",
              };
        },
      },
    ),
    "POST /messaging/deliver-next": route(
      (payload, authUser) =>
        inAppMessagingService.deliverNext(
          payload?.recipientUserId ?? authUser._id,
        ),
      {
        auth: true,
        permission: PERMISSIONS.NOTIFICATIONS_READ,
        guard: async ({ payload, authUser }) => {
          const target = payload?.recipientUserId ?? authUser._id;
          const allowed =
            target === authUser._id ||
            authUser.role === ROLES.ADMIN ||
            authUser.role === ROLES.OPERATIONS;
          return allowed
            ? { ok: true }
            : {
                ok: false,
                status: 403,
                message: "Cannot deliver for this recipient",
              };
        },
      },
    ),
    "GET /messaging/receipts": route(
      (payload, authUser) =>
        inAppMessagingService.listReceipts(
          payload?.recipientUserId ?? authUser._id,
        ),
      {
        auth: true,
        permission: PERMISSIONS.NOTIFICATIONS_READ,
        guard: async ({ payload, authUser }) => {
          const target = payload?.recipientUserId ?? authUser._id;
          const allowed =
            target === authUser._id || authUser.role === ROLES.ADMIN;
          return allowed
            ? { ok: true }
            : {
                ok: false,
                status: 403,
                message: "Cannot read another user's receipts",
              };
        },
      },
    ),
  };

  const router = createServiceRouter(routes, {
    authenticate: (payload) => authApiService.authenticate(payload),
    hasPermission,
  });

  return {
    db,
    users: usersService,
    sessions: sessionsService,
    submissions: submissionsService,
    fulfillments: fulfillmentsService,
    requestsLifecycle: requestsLifecycleService,
    reviewerTools: reviewerToolsService,
    fulfillmentManagement: fulfillmentManagementService,
    adminConfig: adminConfigService,
    bulkData: bulkDataService,
    auditTrail: auditTrailService,
    messaging: inAppMessagingService,
    requestService,
    shipmentService,
    authApi: authApiService,
    dashboard: dashboardService,
    integrationValidation: integrationValidationService,
    router,
    async init() {
      await db.init();
    },
  };
}
