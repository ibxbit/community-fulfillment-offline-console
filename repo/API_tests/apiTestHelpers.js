import { createAppServices } from "../src/services";
import { createPluginSystem } from "../src/plugins";
import {
  hashPassword,
  PBKDF2_ITERATIONS,
  createSalt,
} from "../src/auth/crypto";
import { ROLES } from "../src/auth/roles";

export async function createApiTestContext() {
  const plugins = createPluginSystem();
  const services = createAppServices({ plugins });
  await services.init();
  await plugins.initialize({ services, modules: [] });
  return { services, plugins };
}

export async function clearAll(services) {
  const collections = Object.values(services.db.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function seedUser(
  collection,
  { _id, username, password, role, orgScopeIds = [], classScopeIds = [] },
) {
  const passwordSalt = createSalt();
  const passwordHash = await hashPassword(
    password,
    passwordSalt,
    PBKDF2_ITERATIONS,
  );
  await collection.insertOne({
    _id,
    username,
    name: username,
    role,
    orgScopeIds,
    classScopeIds,
    passwordSalt,
    passwordHash,
    passwordIterations: PBKDF2_ITERATIONS,
  });
}

export async function loginAs(services, username, password = "pass123") {
  const result = await services.router.call("POST /auth/login", {
    username,
    password,
  });
  if (result.status !== 200) {
    throw new Error(`Login failed for ${username}: ${result.error?.message}`);
  }
  return result.data.token;
}

export const SEED_USERS = {
  student: {
    _id: "student_1",
    username: "student1",
    password: "pass123",
    role: ROLES.STUDENT,
    orgScopeIds: ["org_a"],
    classScopeIds: ["class_a"],
  },
  student2: {
    _id: "student_2",
    username: "student2",
    password: "pass123",
    role: ROLES.STUDENT,
    orgScopeIds: ["org_b"],
    classScopeIds: ["class_b"],
  },
  teacher: {
    _id: "teacher_1",
    username: "teacher1",
    password: "pass123",
    role: ROLES.TEACHER,
    orgScopeIds: ["org_a"],
    classScopeIds: ["class_a"],
  },
  reviewer: {
    _id: "reviewer_1",
    username: "reviewer1",
    password: "pass123",
    role: ROLES.REVIEWER,
  },
  warehouse: {
    _id: "warehouse_1",
    username: "warehouse1",
    password: "pass123",
    role: ROLES.WAREHOUSE_STAFF,
  },
  operations: {
    _id: "ops_1",
    username: "ops1",
    password: "pass123",
    role: ROLES.OPERATIONS,
  },
  finance: {
    _id: "finance_1",
    username: "finance1",
    password: "pass123",
    role: ROLES.FINANCE,
  },
  admin: {
    _id: "admin_1",
    username: "admin1",
    password: "pass123",
    role: ROLES.ADMIN,
  },
};

export async function seedAllUsers(services) {
  for (const user of Object.values(SEED_USERS)) {
    await seedUser(services.db.collections.users, user);
  }
}
