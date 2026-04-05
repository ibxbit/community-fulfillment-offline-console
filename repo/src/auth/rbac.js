import { ROLE_PERMISSIONS, ROLES } from "./roles";

function inScope(scopeList, value) {
  if (!Array.isArray(scopeList) || scopeList.length === 0) {
    return true;
  }

  if (value === undefined || value === null) {
    return false;
  }

  return scopeList.includes(value);
}

export function hasPermission(user, permission) {
  if (!user) {
    return false;
  }

  const permissions = ROLE_PERMISSIONS[user.role] ?? [];
  return permissions.includes(permission);
}

export function canAccessResource(user, resourceAccess) {
  if (!user) {
    return false;
  }

  const { resource, action, orgId, classId, ownerUserId, requesterUserId } =
    resourceAccess;
  const permission = `${resource}:${action}`;

  if (!hasPermission(user, permission)) {
    return false;
  }

  if (user.role === ROLES.ADMIN) {
    return true;
  }

  if (!inScope(user.orgScopeIds, orgId)) {
    return false;
  }

  if (!inScope(user.classScopeIds, classId)) {
    return false;
  }

  if (user.role === ROLES.STUDENT) {
    const ownerMatch = ownerUserId ? ownerUserId === user._id : true;
    const requesterMatch = requesterUserId
      ? requesterUserId === user._id
      : true;
    return ownerMatch && requesterMatch;
  }

  return true;
}
