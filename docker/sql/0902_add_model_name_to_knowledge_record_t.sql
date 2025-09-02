-- Add model_name column to knowledge_record_t table, used to record the embedding model used by the knowledge base

-- Switch to nexent schema
SET search_path TO nexent;

-- Add model_name column
ALTER TABLE "knowledge_record_t" 
ADD COLUMN IF NOT EXISTS "model_name" varchar(100) COLLATE "pg_catalog"."default";

-- Add column comment
COMMENT ON COLUMN "knowledge_record_t"."model_name" IS 'Embedding model name, used to record the embedding model used by the knowledge base'; 