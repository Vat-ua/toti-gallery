import { pgTable, text, timestamp, integer, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("gallery_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  cohort: text("cohort").notNull(),
  year: integer("year").notNull(),
  bio: text("bio").notNull().default("Construindo novas possibilidades através do código."),
  avatar: text("avatar"),
  github: text("github"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projects = pgTable("gallery_projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  technologies: jsonb("technologies").$type<string[]>().notNull(),
  category: text("category").notNull().default("Front-end"),
  coverStyle: text("cover_style").notNull().default("abstract"),
  imageUrl: text("image_url"),
  githubUrl: text("github_url"),
  liveUrl: text("live_url"),
  featured: boolean("featured").notNull().default(false),
  isFinal: boolean("is_final").notNull().default(false),
  baseLikes: integer("base_likes").notNull().default(0),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("gallery_sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const likes = pgTable("gallery_likes", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  visitorKey: text("visitor_key").notNull(),
}, (table) => [primaryKey({ columns: [table.projectId, table.visitorKey] })]);
