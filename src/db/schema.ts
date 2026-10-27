/**
 * Platform schema. Apply the reviewed auth and owner migrations to an
 * isolated database first. See docs/authentication.md and docs/administration.md.
 */
import { sql } from "drizzle-orm";
import type { Role } from "@/lib/permissions";
import { bigint, boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("gallery_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("avatar"), // Better Auth's image field reuses the existing photo.
  bio: text("bio").notNull().default(""),
  github: text("github"),
  role: text("role").$type<Role>().notNull().default("user"),
  status: text("status").$type<"pending" | "active" | "suspended">().notNull().default("pending"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Historical group/year values retained for administrator review in stage 3.
  // Authentication and current membership never read these fields.
  cohort: text("cohort"),
  year: integer("year"),
}, table => [
  uniqueIndex("gallery_users_email_normalized_idx").on(sql`lower(btrim(${table.email}))`),
  check("gallery_users_role_check", sql`${table.role} in ('user', 'admin', 'owner')`),
  uniqueIndex("gallery_users_single_owner_idx").on(table.role).where(sql`${table.role} = 'owner'`),
  check("gallery_users_status_check", sql`${table.status} in ('pending', 'active', 'suspended')`),
]);

export const turmas = pgTable("gallery_turmas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  number: integer("number").notNull(),
  courseName: text("course_name"),
  startYear: integer("start_year"),
  // Historical completion year; never infer a start year from this value.
  graduationYear: integer("graduation_year"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [
  uniqueIndex("gallery_turmas_name_normalized_idx").on(sql`lower(btrim(${table.name}))`),
  uniqueIndex("gallery_turmas_number_idx").on(table.number),
  check("gallery_turmas_number_check", sql`${table.number} > 0`),
  check("gallery_turmas_start_year_check", sql`${table.startYear} is null or ${table.startYear} between 2000 and 2100`),
  check("gallery_turmas_course_name_check", sql`${table.courseName} is null or length(btrim(${table.courseName})) between 2 and 100`),
  check("gallery_turmas_name_check", sql`length(btrim(${table.name})) > 0`),
]);

// No FK from authorship to this table: membership changes cannot erase credits.
export const turmaMembers = pgTable("gallery_turma_members", {
  turmaId: text("turma_id").notNull().references(() => turmas.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.turmaId, table.userId] }),
  index("gallery_turma_members_user_id_idx").on(table.userId),
]);

// Better Auth core tables, explicitly mapped in auth-core.ts.
export const accounts = pgTable("gallery_auth_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  uniqueIndex("gallery_auth_accounts_provider_identity_idx").on(table.providerId, table.accountId),
  index("gallery_auth_accounts_user_id_idx").on(table.userId),
  check("gallery_auth_accounts_credential_identity_check", sql`${table.providerId} <> 'credential' or ${table.accountId} = ${table.userId}`),
]);

export const authSessions = pgTable("gallery_auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [index("gallery_auth_sessions_user_id_idx").on(table.userId)]);

export const verifications = pgTable("gallery_auth_verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [index("gallery_auth_verifications_identifier_idx").on(table.identifier)]);

export const rateLimits = pgTable("gallery_auth_rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Delivery-independent grants. Raw tokens, URLs and delivery status are not stored here.
export const invitations = pgTable("gallery_invitations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  purpose: text("purpose").$type<"activation" | "password_reset">().notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [
  index("gallery_invitations_user_id_idx").on(table.userId),
  check("gallery_invitations_purpose_check", sql`${table.purpose} in ('activation', 'password_reset')`),
  check("gallery_invitations_token_hash_check", sql`length(${table.tokenHash}) = 64 and ${table.tokenHash} !~ '[^0-9a-f]'`),
  check("gallery_invitations_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
  check("gallery_invitations_lifecycle_check", sql`${table.consumedAt} is null or ${table.revokedAt} is null`),
]);

export const projects = pgTable("gallery_projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  technologies: jsonb("technologies").$type<string[]>().notNull(),
  coverStyle: text("cover_style").notNull().default("abstract"),
  imageUrl: text("image_url"),
  githubUrl: text("github_url").notNull(),
  liveUrl: text("live_url"),
  featured: boolean("featured").notNull().default(false),
  isFinal: boolean("is_final").notNull().default(false),
  baseLikes: integer("base_likes").notNull().default(0),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  turmaId: text("turma_id").notNull().references(() => turmas.id, { onDelete: "restrict" }),
  visibility: text("visibility").$type<"published" | "hidden">().notNull().default("published"),
  moderationReason: text("moderation_reason"),
  moderatedBy: text("moderated_by").references(() => users.id, { onDelete: "restrict" }),
  moderatedAt: timestamp("moderated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  index("gallery_projects_turma_id_idx").on(table.turmaId),
  check("gallery_projects_visibility_check", sql`${table.visibility} in ('published', 'hidden')`),
  check("gallery_projects_hidden_reason_check", sql`${table.visibility} <> 'hidden' or (length(btrim(coalesce(${table.moderationReason}, ''))) > 0 and ${table.moderatedBy} is not null and ${table.moderatedAt} is not null)`),
]);

export const projectAuthors = pgTable("gallery_project_authors", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, table => [
  primaryKey({ columns: [table.projectId, table.userId] }),
  index("gallery_project_authors_user_id_idx").on(table.userId),
]);

export const likes = pgTable("gallery_likes", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  visitorKey: text("visitor_key").notNull(),
}, table => [primaryKey({ columns: [table.projectId, table.visitorKey] })]);
