ALTER TABLE model_record_t 
ADD COLUMN tenant_id varchar(100) COLLATE pg_catalog.default DEFAULT 'tenant_id';
COMMENT ON COLUMN "model_record_t"."tenant_id" IS 'Tenant ID for filtering';