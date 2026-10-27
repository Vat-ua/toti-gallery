CREATE TABLE "gallery_auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_auth_accounts_credential_identity_check" CHECK ("gallery_auth_accounts"."provider_id" <> 'credential' or "gallery_auth_accounts"."account_id" = "gallery_auth_accounts"."user_id")
);

CREATE TABLE "gallery_auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_auth_sessions_token_unique" UNIQUE("token")
);

CREATE TABLE "gallery_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_by" text NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "gallery_invitations_purpose_check" CHECK ("gallery_invitations"."purpose" in ('activation', 'password_reset')),
	CONSTRAINT "gallery_invitations_token_hash_check" CHECK (length("gallery_invitations"."token_hash") = 64 and "gallery_invitations"."token_hash" !~ '[^0-9a-f]'),
	CONSTRAINT "gallery_invitations_expiry_check" CHECK ("gallery_invitations"."expires_at" > "gallery_invitations"."created_at"),
	CONSTRAINT "gallery_invitations_lifecycle_check" CHECK ("gallery_invitations"."consumed_at" is null or "gallery_invitations"."revoked_at" is null)
);

CREATE TABLE "gallery_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL
);

CREATE TABLE "gallery_likes" (
	"project_id" text NOT NULL,
	"visitor_key" text NOT NULL,
	CONSTRAINT "gallery_likes_project_id_visitor_key_pk" PRIMARY KEY("project_id","visitor_key")
);

CREATE TABLE "gallery_project_authors" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "gallery_project_authors_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);

CREATE TABLE "gallery_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"technologies" jsonb NOT NULL,
	"cover_style" text DEFAULT 'abstract' NOT NULL,
	"image_url" text,
	"github_url" text NOT NULL,
	"live_url" text,
	"featured" boolean DEFAULT false NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"base_likes" integer DEFAULT 0 NOT NULL,
	"author_id" text NOT NULL,
	"turma_id" text NOT NULL,
	"visibility" text DEFAULT 'published' NOT NULL,
	"moderation_reason" text,
	"moderated_by" text,
	"moderated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "gallery_projects_visibility_check" CHECK ("gallery_projects"."visibility" in ('published', 'hidden')),
	CONSTRAINT "gallery_projects_hidden_reason_check" CHECK ("gallery_projects"."visibility" <> 'hidden' or (length(btrim(coalesce("gallery_projects"."moderation_reason", ''))) > 0 and "gallery_projects"."moderated_by" is not null and "gallery_projects"."moderated_at" is not null))
);

CREATE TABLE "gallery_turma_members" (
	"turma_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_turma_members_turma_id_user_id_pk" PRIMARY KEY("turma_id","user_id")
);

CREATE TABLE "gallery_turmas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"graduation_year" integer,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_turmas_name_check" CHECK (length(btrim("gallery_turmas"."name")) > 0)
);

CREATE TABLE "gallery_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"avatar" text,
	"bio" text DEFAULT '' NOT NULL,
	"github" text,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"password_hash" text,
	"cohort" text,
	"year" integer,
	CONSTRAINT "gallery_users_email_unique" UNIQUE("email"),
	CONSTRAINT "gallery_users_role_check" CHECK ("gallery_users"."role" in ('user', 'admin')),
	CONSTRAINT "gallery_users_status_check" CHECK ("gallery_users"."status" in ('pending', 'active', 'suspended'))
);

CREATE TABLE "gallery_auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "gallery_auth_accounts" ADD CONSTRAINT "gallery_auth_accounts_user_id_gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."gallery_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gallery_auth_sessions" ADD CONSTRAINT "gallery_auth_sessions_user_id_gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."gallery_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gallery_invitations" ADD CONSTRAINT "gallery_invitations_user_id_gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."gallery_users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "gallery_invitations" ADD CONSTRAINT "gallery_invitations_created_by_gallery_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."gallery_users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "gallery_sessions" ADD CONSTRAINT "gallery_sessions_user_id_gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."gallery_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gallery_likes" ADD CONSTRAINT "gallery_likes_project_id_gallery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."gallery_projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gallery_project_authors" ADD CONSTRAINT "gallery_project_authors_project_id_gallery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."gallery_projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gallery_project_authors" ADD CONSTRAINT "gallery_project_authors_user_id_gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."gallery_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gallery_projects" ADD CONSTRAINT "gallery_projects_author_id_gallery_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."gallery_users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "gallery_projects" ADD CONSTRAINT "gallery_projects_turma_id_gallery_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."gallery_turmas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "gallery_projects" ADD CONSTRAINT "gallery_projects_moderated_by_gallery_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."gallery_users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "gallery_turma_members" ADD CONSTRAINT "gallery_turma_members_turma_id_gallery_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."gallery_turmas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "gallery_turma_members" ADD CONSTRAINT "gallery_turma_members_user_id_gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."gallery_users"("id") ON DELETE restrict ON UPDATE no action;
CREATE UNIQUE INDEX "gallery_auth_accounts_provider_identity_idx" ON "gallery_auth_accounts" USING btree ("provider_id","account_id");
CREATE INDEX "gallery_auth_accounts_user_id_idx" ON "gallery_auth_accounts" USING btree ("user_id");
CREATE INDEX "gallery_auth_sessions_user_id_idx" ON "gallery_auth_sessions" USING btree ("user_id");
CREATE INDEX "gallery_invitations_user_id_idx" ON "gallery_invitations" USING btree ("user_id");
CREATE INDEX "gallery_project_authors_user_id_idx" ON "gallery_project_authors" USING btree ("user_id");
CREATE INDEX "gallery_projects_turma_id_idx" ON "gallery_projects" USING btree ("turma_id");
CREATE INDEX "gallery_turma_members_user_id_idx" ON "gallery_turma_members" USING btree ("user_id");
CREATE UNIQUE INDEX "gallery_turmas_name_normalized_idx" ON "gallery_turmas" USING btree (lower(btrim("name")));
CREATE UNIQUE INDEX "gallery_users_email_normalized_idx" ON "gallery_users" USING btree (lower(btrim("email")));
CREATE INDEX "gallery_auth_verifications_identifier_idx" ON "gallery_auth_verifications" USING btree ("identifier");
