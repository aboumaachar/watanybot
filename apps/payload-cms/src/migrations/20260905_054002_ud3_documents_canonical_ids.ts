import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload_cms"."enum_documents_publication_state" AS ENUM('DRAFT', 'PUBLISHED');
  CREATE TYPE "payload_cms"."enum_documents_workflow_status" AS ENUM('DRAFT', 'PUBLISHED');
  CREATE TYPE "payload_cms"."enum_documents_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload_cms"."enum__documents_v_version_publication_state" AS ENUM('DRAFT', 'PUBLISHED');
  CREATE TYPE "payload_cms"."enum__documents_v_version_workflow_status" AS ENUM('DRAFT', 'PUBLISHED');
  CREATE TYPE "payload_cms"."enum__documents_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload_cms"."enum__documents_v_published_locale" AS ENUM('ar', 'en');
  CREATE TABLE "payload_cms"."documents_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "payload_cms"."documents_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source_id" varchar,
  	"source_path" varchar,
  	"anchor" varchar
  );
  
  CREATE TABLE "payload_cms"."documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"canonical_id" varchar,
  	"business_identifier" varchar,
  	"title_ar" varchar,
  	"title_en" varchar,
  	"description_ar" varchar,
  	"description_en" varchar,
  	"official_reference" varchar,
  	"asset_type" varchar,
  	"document_type" varchar,
  	"file_format" varchar,
  	"mime_type" varchar,
  	"original_filename" varchar,
  	"storage_path" varchar,
  	"public_url" varchar,
  	"source_authority" varchar,
  	"source_url" varchar,
  	"publication_state" "payload_cms"."enum_documents_publication_state" DEFAULT 'DRAFT',
  	"workflow_status" "payload_cms"."enum_documents_workflow_status" DEFAULT 'DRAFT',
  	"source_system" varchar DEFAULT 'PAYLOAD_CMS',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload_cms"."enum_documents_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload_cms"."documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"procedures_id" integer
  );
  
  CREATE TABLE "payload_cms"."_documents_v_version_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload_cms"."_documents_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_id" varchar,
  	"source_path" varchar,
  	"anchor" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload_cms"."_documents_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_canonical_id" varchar,
  	"version_business_identifier" varchar,
  	"version_title_ar" varchar,
  	"version_title_en" varchar,
  	"version_description_ar" varchar,
  	"version_description_en" varchar,
  	"version_official_reference" varchar,
  	"version_asset_type" varchar,
  	"version_document_type" varchar,
  	"version_file_format" varchar,
  	"version_mime_type" varchar,
  	"version_original_filename" varchar,
  	"version_storage_path" varchar,
  	"version_public_url" varchar,
  	"version_source_authority" varchar,
  	"version_source_url" varchar,
  	"version_publication_state" "payload_cms"."enum__documents_v_version_publication_state" DEFAULT 'DRAFT',
  	"version_workflow_status" "payload_cms"."enum__documents_v_version_workflow_status" DEFAULT 'DRAFT',
  	"version_source_system" varchar DEFAULT 'PAYLOAD_CMS',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload_cms"."enum__documents_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "payload_cms"."enum__documents_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "payload_cms"."_documents_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"procedures_id" integer
  );
  
  ALTER TABLE "payload_cms"."procedures" ADD COLUMN "canonical_id" varchar;
  ALTER TABLE "payload_cms"."_procedures_v" ADD COLUMN "version_canonical_id" varchar;
  ALTER TABLE "payload_cms"."payload_locked_documents_rels" ADD COLUMN "documents_id" integer;
  ALTER TABLE "payload_cms"."documents_tags" ADD CONSTRAINT "documents_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."documents_sources" ADD CONSTRAINT "documents_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."documents_rels" ADD CONSTRAINT "documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload_cms"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."documents_rels" ADD CONSTRAINT "documents_rels_procedures_fk" FOREIGN KEY ("procedures_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_documents_v_version_tags" ADD CONSTRAINT "_documents_v_version_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_documents_v_version_sources" ADD CONSTRAINT "_documents_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_cms"."_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_documents_v" ADD CONSTRAINT "_documents_v_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload_cms"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_cms"."_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload_cms"."_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_cms"."_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_procedures_fk" FOREIGN KEY ("procedures_id") REFERENCES "payload_cms"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "documents_tags_order_idx" ON "payload_cms"."documents_tags" USING btree ("_order");
  CREATE INDEX "documents_tags_parent_id_idx" ON "payload_cms"."documents_tags" USING btree ("_parent_id");
  CREATE INDEX "documents_sources_order_idx" ON "payload_cms"."documents_sources" USING btree ("_order");
  CREATE INDEX "documents_sources_parent_id_idx" ON "payload_cms"."documents_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "documents_canonical_id_idx" ON "payload_cms"."documents" USING btree ("canonical_id");
  CREATE INDEX "documents_business_identifier_idx" ON "payload_cms"."documents" USING btree ("business_identifier");
  CREATE INDEX "documents_updated_at_idx" ON "payload_cms"."documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "payload_cms"."documents" USING btree ("created_at");
  CREATE INDEX "documents__status_idx" ON "payload_cms"."documents" USING btree ("_status");
  CREATE INDEX "documents_rels_order_idx" ON "payload_cms"."documents_rels" USING btree ("order");
  CREATE INDEX "documents_rels_parent_idx" ON "payload_cms"."documents_rels" USING btree ("parent_id");
  CREATE INDEX "documents_rels_path_idx" ON "payload_cms"."documents_rels" USING btree ("path");
  CREATE INDEX "documents_rels_procedures_id_idx" ON "payload_cms"."documents_rels" USING btree ("procedures_id");
  CREATE INDEX "_documents_v_version_tags_order_idx" ON "payload_cms"."_documents_v_version_tags" USING btree ("_order");
  CREATE INDEX "_documents_v_version_tags_parent_id_idx" ON "payload_cms"."_documents_v_version_tags" USING btree ("_parent_id");
  CREATE INDEX "_documents_v_version_sources_order_idx" ON "payload_cms"."_documents_v_version_sources" USING btree ("_order");
  CREATE INDEX "_documents_v_version_sources_parent_id_idx" ON "payload_cms"."_documents_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_documents_v_parent_idx" ON "payload_cms"."_documents_v" USING btree ("parent_id");
  CREATE INDEX "_documents_v_version_version_canonical_id_idx" ON "payload_cms"."_documents_v" USING btree ("version_canonical_id");
  CREATE INDEX "_documents_v_version_version_business_identifier_idx" ON "payload_cms"."_documents_v" USING btree ("version_business_identifier");
  CREATE INDEX "_documents_v_version_version_updated_at_idx" ON "payload_cms"."_documents_v" USING btree ("version_updated_at");
  CREATE INDEX "_documents_v_version_version_created_at_idx" ON "payload_cms"."_documents_v" USING btree ("version_created_at");
  CREATE INDEX "_documents_v_version_version__status_idx" ON "payload_cms"."_documents_v" USING btree ("version__status");
  CREATE INDEX "_documents_v_created_at_idx" ON "payload_cms"."_documents_v" USING btree ("created_at");
  CREATE INDEX "_documents_v_updated_at_idx" ON "payload_cms"."_documents_v" USING btree ("updated_at");
  CREATE INDEX "_documents_v_snapshot_idx" ON "payload_cms"."_documents_v" USING btree ("snapshot");
  CREATE INDEX "_documents_v_published_locale_idx" ON "payload_cms"."_documents_v" USING btree ("published_locale");
  CREATE INDEX "_documents_v_latest_idx" ON "payload_cms"."_documents_v" USING btree ("latest");
  CREATE INDEX "_documents_v_rels_order_idx" ON "payload_cms"."_documents_v_rels" USING btree ("order");
  CREATE INDEX "_documents_v_rels_parent_idx" ON "payload_cms"."_documents_v_rels" USING btree ("parent_id");
  CREATE INDEX "_documents_v_rels_path_idx" ON "payload_cms"."_documents_v_rels" USING btree ("path");
  CREATE INDEX "_documents_v_rels_procedures_id_idx" ON "payload_cms"."_documents_v_rels" USING btree ("procedures_id");
  ALTER TABLE "payload_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "payload_cms"."documents"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "procedures_canonical_id_idx" ON "payload_cms"."procedures" USING btree ("canonical_id");
  CREATE INDEX "_procedures_v_version_version_canonical_id_idx" ON "payload_cms"."_procedures_v" USING btree ("version_canonical_id");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_cms"."payload_locked_documents_rels" USING btree ("documents_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_cms"."documents_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_cms"."documents_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_cms"."documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_cms"."documents_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_cms"."_documents_v_version_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_cms"."_documents_v_version_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_cms"."_documents_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_cms"."_documents_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload_cms"."documents_tags" CASCADE;
  DROP TABLE "payload_cms"."documents_sources" CASCADE;
  DROP TABLE "payload_cms"."documents" CASCADE;
  DROP TABLE "payload_cms"."documents_rels" CASCADE;
  DROP TABLE "payload_cms"."_documents_v_version_tags" CASCADE;
  DROP TABLE "payload_cms"."_documents_v_version_sources" CASCADE;
  DROP TABLE "payload_cms"."_documents_v" CASCADE;
  DROP TABLE "payload_cms"."_documents_v_rels" CASCADE;
  ALTER TABLE "payload_cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_documents_fk";
  
  DROP INDEX "payload_cms"."procedures_canonical_id_idx";
  DROP INDEX "payload_cms"."_procedures_v_version_version_canonical_id_idx";
  DROP INDEX "payload_cms"."payload_locked_documents_rels_documents_id_idx";
  ALTER TABLE "payload_cms"."procedures" DROP COLUMN "canonical_id";
  ALTER TABLE "payload_cms"."_procedures_v" DROP COLUMN "version_canonical_id";
  ALTER TABLE "payload_cms"."payload_locked_documents_rels" DROP COLUMN "documents_id";
  DROP TYPE "payload_cms"."enum_documents_publication_state";
  DROP TYPE "payload_cms"."enum_documents_workflow_status";
  DROP TYPE "payload_cms"."enum_documents_status";
  DROP TYPE "payload_cms"."enum__documents_v_version_publication_state";
  DROP TYPE "payload_cms"."enum__documents_v_version_workflow_status";
  DROP TYPE "payload_cms"."enum__documents_v_version_status";
  DROP TYPE "payload_cms"."enum__documents_v_published_locale";`)
}
