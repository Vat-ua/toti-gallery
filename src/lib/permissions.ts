export type Role = "user" | "admin" | "owner";
export type Actor = { id: string; role: Role; status: string; isDemo: boolean };

export function isStaff(role: string): role is "admin" | "owner" {
  return role === "admin" || role === "owner";
}

export function canManageAccount(actor: Actor, target: { role: Role }) {
  return actor.status === "active" && !actor.isDemo && isStaff(actor.role)
    && (actor.role === "owner" || target.role === "user");
}
