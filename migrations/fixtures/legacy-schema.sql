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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_projects_slug_unique" UNIQUE("slug")
);

CREATE TABLE "gallery_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL
);

CREATE TABLE "gallery_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"cohort" text NOT NULL,
	"year" integer NOT NULL,
	"bio" text DEFAULT 'Construindo novas possibilidades através do código.' NOT NULL,
	"avatar" text,
	"github" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_users_email_unique" UNIQUE("email")
);

ALTER TABLE "gallery_likes" ADD CONSTRAINT "gallery_likes_project_id_gallery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."gallery_projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gallery_project_authors" ADD CONSTRAINT "gallery_project_authors_project_id_gallery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."gallery_projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gallery_project_authors" ADD CONSTRAINT "gallery_project_authors_user_id_gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."gallery_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "gallery_projects" ADD CONSTRAINT "gallery_projects_author_id_gallery_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."gallery_users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "gallery_sessions" ADD CONSTRAINT "gallery_sessions_user_id_gallery_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."gallery_users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "gallery_project_authors_user_id_idx" ON "gallery_project_authors" USING btree ("user_id");
