// lib/admin.ts

/**
 * Check if a user ID is an admin.
 * v1: simple env var check. In v2 this would check an is_admin column.
 */
export function isAdmin(userId: string): boolean {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return false;
  return userId === adminId;
}
