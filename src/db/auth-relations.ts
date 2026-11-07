import { relations } from "drizzle-orm";
import { users, accounts, authSessions, verifications, rateLimits } from "./schema";

// ORM metadata only: Better Auth can read a session and its live user together.
export const authRelations = {
  user: users, account: accounts, session: authSessions, verification: verifications, rateLimit: rateLimits,
  userRelations: relations(users, ({ many }) => ({ sessions: many(authSessions), accounts: many(accounts) })),
  sessionRelations: relations(authSessions, ({ one }) => ({ user: one(users, { fields: [authSessions.userId], references: [users.id] }) })),
  accountRelations: relations(accounts, ({ one }) => ({ user: one(users, { fields: [accounts.userId], references: [users.id] }) })),
};
