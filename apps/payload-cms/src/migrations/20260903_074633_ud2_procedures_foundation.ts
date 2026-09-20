import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload_cms"."_locales" AS ENUM('ar', 'en');
  CREATE TYPE "payload_cms"."enum_procedures_publication_state" AS ENUM('DRAFT', 'PUBLISHED');
  CREATE TYPE "payload_cms"."enum_procedures_workflow_status" AS ENUM('DRAFT', 'PUBLISHED');
  CREATE TYPE "payload_cms"."enum_procedures_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload_cms"."enum__procedures_v_version_publication_state" AS ENUM('DRAFT', 'PUBLISHED');
  CREATE TYPE "payload_cms"."enum__procedures_v_version_workflow_status" AS ENUM('DRAFT', 'PUBLISHED');
  CREATE TYPE "payload_cms"."enum__procedures_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload_cms"."enum__procedures_v_published_locale" AS ENUM('ar', 'en');
  CREATE TABLE "payload_cms"."gateway_admins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"gateway_user_id" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"display_name" varchar,
  	"role_snapshot" varchar NOT NULL,
  	"capability_snapshot" jsonb,
  	"last_authenticated_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_cms"."procedures_eligibility" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "payload_cms"."procedures_requirements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "payload_cms"."procedures_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "payload_cms"."procedures_fees" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "payload_cms"."procedures_locations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "payload_cms"."procedures_contacts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "payload_cms"."procedures" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"procedure_code" varchar,
  	"slug" varchar,
  	"category" varchar,
  	"source_authority" varchar,
  	"source_url" varchar,
  	"last_verified_at" timestamp(3) with time zone,
  	"verified_by" varchar,
  	"review_due_at" timestamp(3) with time zone,
  	"publication_state" "payload_cms"."enum_procedures_publication_state" DEFAULT 'DRAFT',
  	"workflow_status" "payload_cms"."enum_procedures_workflow_status" DEFAULT 'DRAFT',
  	"source_system" varchar DEFAULT 'PAYLOAD_CMS',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload_cms"."enum_procedures_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload_cms"."procedures_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"processing_time" varchar,
  	"notes" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload_cms"."_procedures_v_version_eligibility" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload_cms"."_procedures_v_version_requirements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload_cms"."_procedures_v_version_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload_cms"."_procedures_v_version_fees" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload_cms"."_procedures_v_version_locations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload_cms"."_procedures_v_version_contacts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload_cms"."_procedures_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_procedure_code" varchar,
  	"version_slug" varchar,
  	"version_category" varchar,
  	"version_source_authority" varchar,
  	"version_source_url" varchar,
  	"version_last_verified_at" timestamp(3) with time zone,
  	"version_verified_by" varchar,
  	"version_review_due_at" timestamp(3) with time zone,
  	"version_publication_state" "payload_cms"."enum__procedures_v_version_publication_state" DEFAULT 'DRAFT',
  	"version_workflow_status" "payload_cms"."enum__procedures_v_version_workflow_status" DEFAULT 'DRAFT',
  	"version_source_system" varchar DEFAULT 'PAYLOAD_CMS',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload_cms"."enum__procedures_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "payload_cms"."enum__procedures_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "payload_cms"."_procedures_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_processing_time" varchar,
  	"version_notes" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "payload_cms"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload_cms"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_cms"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_cms"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"gateway_admins_id" integer,
  	"procedures_id" integer
  );
  
  CREATE TABLE "payload_cms"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_cms"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"gateway_admins_id" integer
  );
  
  CREATE TABLE "payload_cms"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_cms"."procedures_eligibility" ADD CONSTRAINT "procedures_eligibility_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."procedures_requirements" ADD CONSTRAINT "procedures_requirements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."procedures_steps" ADD CONSTRAINT "procedures_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."procedures_fees" ADD CONSTRAINT "procedures_fees_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."procedures_locations" ADD CONSTRAINT "procedures_locations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."procedures_contacts" ADD CONSTRAINT "procedures_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."procedures_locales" ADD CONSTRAINT "procedures_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_procedures_v_version_eligibility" ADD CONSTRAINT "_procedures_v_version_eligibility_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."_procedures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_procedures_v_version_requirements" ADD CONSTRAINT "_procedures_v_version_requirements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."_procedures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_procedures_v_version_steps" ADD CONSTRAINT "_procedures_v_version_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."_procedures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_procedures_v_version_fees" ADD CONSTRAINT "_procedures_v_version_fees_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."_procedures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_procedures_v_version_locations" ADD CONSTRAINT "_procedures_v_version_locations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."_procedures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_procedures_v_version_contacts" ADD CONSTRAINT "_procedures_v_version_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."_procedures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_procedures_v" ADD CONSTRAINT "_procedures_v_parent_id_procedures_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_cms"."_procedures_v_locales" ADD CONSTRAINT "_procedures_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."_procedures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload_cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gateway_admins_fk" FOREIGN KEY ("gateway_admins_id") REFERENCES "payload_cms"."gateway_admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_procedures_fk" FOREIGN KEY ("procedures_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload_cms"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_gateway_admins_fk" FOREIGN KEY ("gateway_admins_id") REFERENCES "payload_cms"."gateway_admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "gateway_admins_gateway_user_id_idx" ON "payload_cms"."gateway_admins" USING btree ("gateway_user_id");
  CREATE INDEX "gateway_admins_updated_at_idx" ON "payload_cms"."gateway_admins" USING btree ("updated_at");
  CREATE INDEX "gateway_admins_created_at_idx" ON "payload_cms"."gateway_admins" USING btree ("created_at");
  CREATE INDEX "procedures_eligibility_order_idx" ON "payload_cms"."procedures_eligibility" USING btree ("_order");
  CREATE INDEX "procedures_eligibility_parent_id_idx" ON "payload_cms"."procedures_eligibility" USING btree ("_parent_id");
  CREATE INDEX "procedures_eligibility_locale_idx" ON "payload_cms"."procedures_eligibility" USING btree ("_locale");
  CREATE INDEX "procedures_requirements_order_idx" ON "payload_cms"."procedures_requirements" USING btree ("_order");
  CREATE INDEX "procedures_requirements_parent_id_idx" ON "payload_cms"."procedures_requirements" USING btree ("_parent_id");
  CREATE INDEX "procedures_requirements_locale_idx" ON "payload_cms"."procedures_requirements" USING btree ("_locale");
  CREATE INDEX "procedures_steps_order_idx" ON "payload_cms"."procedures_steps" USING btree ("_order");
  CREATE INDEX "procedures_steps_parent_id_idx" ON "payload_cms"."procedures_steps" USING btree ("_parent_id");
  CREATE INDEX "procedures_steps_locale_idx" ON "payload_cms"."procedures_steps" USING btree ("_locale");
  CREATE INDEX "procedures_fees_order_idx" ON "payload_cms"."procedures_fees" USING btree ("_order");
  CREATE INDEX "procedures_fees_parent_id_idx" ON "payload_cms"."procedures_fees" USING btree ("_parent_id");
  CREATE INDEX "procedures_locations_order_idx" ON "payload_cms"."procedures_locations" USING btree ("_order");
  CREATE INDEX "procedures_locations_parent_id_idx" ON "payload_cms"."procedures_locations" USING btree ("_parent_id");
  CREATE INDEX "procedures_locations_locale_idx" ON "payload_cms"."procedures_locations" USING btree ("_locale");
  CREATE INDEX "procedures_contacts_order_idx" ON "payload_cms"."procedures_contacts" USING btree ("_order");
  CREATE INDEX "procedures_contacts_parent_id_idx" ON "payload_cms"."procedures_contacts" USING btree ("_parent_id");
  CREATE INDEX "procedures_contacts_locale_idx" ON "payload_cms"."procedures_contacts" USING btree ("_locale");
  CREATE UNIQUE INDEX "procedures_procedure_code_idx" ON "payload_cms"."procedures" USING btree ("procedure_code");
  CREATE UNIQUE INDEX "procedures_slug_idx" ON "payload_cms"."procedures" USING btree ("slug");
  CREATE INDEX "procedures_updated_at_idx" ON "payload_cms"."procedures" USING btree ("updated_at");
  CREATE INDEX "procedures_created_at_idx" ON "payload_cms"."procedures" USING btree ("created_at");
  CREATE INDEX "procedures__status_idx" ON "payload_cms"."procedures" USING btree ("_status");
  CREATE UNIQUE INDEX "procedures_locales_locale_parent_id_unique" ON "payload_cms"."procedures_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_procedures_v_version_eligibility_order_idx" ON "payload_cms"."_procedures_v_version_eligibility" USING btree ("_order");
  CREATE INDEX "_procedures_v_version_eligibility_parent_id_idx" ON "payload_cms"."_procedures_v_version_eligibility" USING btree ("_parent_id");
  CREATE INDEX "_procedures_v_version_eligibility_locale_idx" ON "payload_cms"."_procedures_v_version_eligibility" USING btree ("_locale");
  CREATE INDEX "_procedures_v_version_requirements_order_idx" ON "payload_cms"."_procedures_v_version_requirements" USING btree ("_order");
  CREATE INDEX "_procedures_v_version_requirements_parent_id_idx" ON "payload_cms"."_procedures_v_version_requirements" USING btree ("_parent_id");
  CREATE INDEX "_procedures_v_version_requirements_locale_idx" ON "payload_cms"."_procedures_v_version_requirements" USING btree ("_locale");
  CREATE INDEX "_procedures_v_version_steps_order_idx" ON "payload_cms"."_procedures_v_version_steps" USING btree ("_order");
  CREATE INDEX "_procedures_v_version_steps_parent_id_idx" ON "payload_cms"."_procedures_v_version_steps" USING btree ("_parent_id");
  CREATE INDEX "_procedures_v_version_steps_locale_idx" ON "payload_cms"."_procedures_v_version_steps" USING btree ("_locale");
  CREATE INDEX "_procedures_v_version_fees_order_idx" ON "payload_cms"."_procedures_v_version_fees" USING btree ("_order");
  CREATE INDEX "_procedures_v_version_fees_parent_id_idx" ON "payload_cms"."_procedures_v_version_fees" USING btree ("_parent_id");
  CREATE INDEX "_procedures_v_version_locations_order_idx" ON "payload_cms"."_procedures_v_version_locations" USING btree ("_order");
  CREATE INDEX "_procedures_v_version_locations_parent_id_idx" ON "payload_cms"."_procedures_v_version_locations" USING btree ("_parent_id");
  CREATE INDEX "_procedures_v_version_locations_locale_idx" ON "payload_cms"."_procedures_v_version_locations" USING btree ("_locale");
  CREATE INDEX "_procedures_v_version_contacts_order_idx" ON "payload_cms"."_procedures_v_version_contacts" USING btree ("_order");
  CREATE INDEX "_procedures_v_version_contacts_parent_id_idx" ON "payload_cms"."_procedures_v_version_contacts" USING btree ("_parent_id");
  CREATE INDEX "_procedures_v_version_contacts_locale_idx" ON "payload_cms"."_procedures_v_version_contacts" USING btree ("_locale");
  CREATE INDEX "_procedures_v_parent_idx" ON "payload_cms"."_procedures_v" USING btree ("parent_id");
  CREATE INDEX "_procedures_v_version_version_procedure_code_idx" ON "payload_cms"."_procedures_v" USING btree ("version_procedure_code");
  CREATE INDEX "_procedures_v_version_version_slug_idx" ON "payload_cms"."_procedures_v" USING btree ("version_slug");
  CREATE INDEX "_procedures_v_version_version_updated_at_idx" ON "payload_cms"."_procedures_v" USING btree ("version_updated_at");
  CREATE INDEX "_procedures_v_version_version_created_at_idx" ON "payload_cms"."_procedures_v" USING btree ("version_created_at");
  CREATE INDEX "_procedures_v_version_version__status_idx" ON "payload_cms"."_procedures_v" USING btree ("version__status");
  CREATE INDEX "_procedures_v_created_at_idx" ON "payload_cms"."_procedures_v" USING btree ("created_at");
  CREATE INDEX "_procedures_v_updated_at_idx" ON "payload_cms"."_procedures_v" USING btree ("updated_at");
  CREATE INDEX "_procedures_v_snapshot_idx" ON "payload_cms"."_procedures_v" USING btree ("snapshot");
  CREATE INDEX "_procedures_v_published_locale_idx" ON "payload_cms"."_procedures_v" USING btree ("published_locale");
  CREATE INDEX "_procedures_v_latest_idx" ON "payload_cms"."_procedures_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_procedures_v_locales_locale_parent_id_unique" ON "payload_cms"."_procedures_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_gateway_admins_id_idx" ON "payload_cms"."payload_locked_documents_rels" USING btree ("gateway_admins_id");
  CREATE INDEX "payload_locked_documents_rels_procedures_id_idx" ON "payload_cms"."payload_locked_documents_rels" USING btree ("procedures_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_cms"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_cms"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_cms"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_cms"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_cms"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_cms"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_gateway_admins_id_idx" ON "payload_cms"."payload_preferences_rels" USING btree ("gateway_admins_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_cms"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_cms"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload_cms"."gateway_admins" CASCADE;
  DROP TABLE "payload_cms"."procedures_eligibility" CASCADE;
  DROP TABLE "payload_cms"."procedures_requirements" CASCADE;
  DROP TABLE "payload_cms"."procedures_steps" CASCADE;
  DROP TABLE "payload_cms"."procedures_fees" CASCADE;
  DROP TABLE "payload_cms"."procedures_locations" CASCADE;
  DROP TABLE "payload_cms"."procedures_contacts" CASCADE;
  DROP TABLE "payload_cms"."procedures" CASCADE;
  DROP TABLE "payload_cms"."procedures_locales" CASCADE;
  DROP TABLE "payload_cms"."_procedures_v_version_eligibility" CASCADE;
  DROP TABLE "payload_cms"."_procedures_v_version_requirements" CASCADE;
  DROP TABLE "payload_cms"."_procedures_v_version_steps" CASCADE;
  DROP TABLE "payload_cms"."_procedures_v_version_fees" CASCADE;
  DROP TABLE "payload_cms"."_procedures_v_version_locations" CASCADE;
  DROP TABLE "payload_cms"."_procedures_v_version_contacts" CASCADE;
  DROP TABLE "payload_cms"."_procedures_v" CASCADE;
  DROP TABLE "payload_cms"."_procedures_v_locales" CASCADE;
  DROP TABLE "payload_cms"."payload_kv" CASCADE;
  DROP TABLE "payload_cms"."payload_locked_documents" CASCADE;
  DROP TABLE "payload_cms"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_cms"."payload_preferences" CASCADE;
  DROP TABLE "payload_cms"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload_cms"."payload_migrations" CASCADE;
  DROP TYPE "payload_cms"."_locales";
  DROP TYPE "payload_cms"."enum_procedures_publication_state";
  DROP TYPE "payload_cms"."enum_procedures_workflow_status";
  DROP TYPE "payload_cms"."enum_procedures_status";
  DROP TYPE "payload_cms"."enum__procedures_v_version_publication_state";
  DROP TYPE "payload_cms"."enum__procedures_v_version_workflow_status";
  DROP TYPE "payload_cms"."enum__procedures_v_version_status";
  DROP TYPE "payload_cms"."enum__procedures_v_published_locale";`)
}
