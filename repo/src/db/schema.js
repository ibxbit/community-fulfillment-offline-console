export const DB_NAME = "cfso_console_db";
export const DB_VERSION = 2;

export const COLLECTIONS = {
  users: "users",
  requests: "requests",
  reviews: "reviews",
  shipments: "shipments",
  inventory: "inventory",
  audit_logs: "audit_logs",
  notifications: "notifications",
  service_areas: "service_areas",
  group_leaders: "group_leaders",
  commissions: "commissions",
  settlements: "settlements",
  plugins: "plugins",

  // Legacy scaffold collections kept for compatibility.
  sessions: "sessions",
  submissions: "submissions",
  fulfillments: "fulfillments",
  plugin_state: "plugin_state",
};

const COMMON_INDEXES = [
  { name: "idx_sku", keyPath: "sku", options: { unique: false } },
  { name: "idx_requester", keyPath: "requester", options: { unique: false } },
  { name: "idx_date", keyPath: "date", options: { unique: false } },
  { name: "idx_status", keyPath: "status", options: { unique: false } },
];

export const SCHEMA = [
  { name: COLLECTIONS.users, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.requests, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.reviews, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.shipments, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.inventory, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.audit_logs, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.notifications, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.service_areas, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.group_leaders, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.commissions, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.settlements, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.plugins, keyPath: "_id", indexes: COMMON_INDEXES },

  // Legacy scaffold collections kept for compatibility.
  { name: COLLECTIONS.sessions, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.submissions, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.fulfillments, keyPath: "_id", indexes: COMMON_INDEXES },
  { name: COLLECTIONS.plugin_state, keyPath: "_id", indexes: COMMON_INDEXES },
];
