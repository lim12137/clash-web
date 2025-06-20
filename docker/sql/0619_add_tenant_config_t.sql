-- 添加新字段
ALTER TABLE "knowledge_record_t"
  ADD COLUMN IF NOT EXISTS "knowledge_embedding_model" varchar(100) COLLATE "pg_catalog"."default",
  ADD COLUMN IF NOT EXISTS "knowledge_sources" varchar(100) COLLATE "pg_catalog"."default";

-- 添加字段注释
COMMENT ON COLUMN "knowledge_record_t"."knowledge_embedding_model" IS 'Knowledge base embedding model';
COMMENT ON COLUMN "knowledge_record_t"."knowledge_sources" IS 'Knowledge base sources';

-- Create the tenant_config_t table in the nexent schema
CREATE TABLE IF NOT EXISTS nexent.tenant_config_t (
    tenant_config_id SERIAL PRIMARY KEY NOT NULL,
    tenant_id VARCHAR(100),
    user_id VARCHAR(100),
    value_type VARCHAR(100),
    config_key VARCHAR(100),
    config_value VARCHAR(100),
    create_time TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    delete_flag VARCHAR(1) DEFAULT 'N'
);

-- Add comment to the table
COMMENT ON TABLE nexent.tenant_config_t IS 'Tenant configuration information table';

-- Add comments to the columns
COMMENT ON COLUMN nexent.tenant_config_t.tenant_config_id IS 'ID';
COMMENT ON COLUMN nexent.tenant_config_t.tenant_id IS 'Tenant ID';
COMMENT ON COLUMN nexent.tenant_config_t.user_id IS 'User ID';
COMMENT ON COLUMN nexent.tenant_config_t.value_type IS 'Value type';
COMMENT ON COLUMN nexent.tenant_config_t.config_key IS 'Config key';
COMMENT ON COLUMN nexent.tenant_config_t.config_value IS 'Config value';
COMMENT ON COLUMN nexent.tenant_config_t.create_time IS 'Creation time';
COMMENT ON COLUMN nexent.tenant_config_t.update_time IS 'Update time';
COMMENT ON COLUMN nexent.tenant_config_t.created_by IS 'Creator';
COMMENT ON COLUMN nexent.tenant_config_t.updated_by IS 'Updater';
COMMENT ON COLUMN nexent.tenant_config_t.delete_flag IS 'Whether it is deleted. Optional values: Y/N';

-- Create a function to update the update_time column
CREATE OR REPLACE FUNCTION update_tenant_config_update_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function before each update
CREATE TRIGGER update_tenant_config_update_time_trigger
BEFORE UPDATE ON nexent.tenant_config_t
FOR EACH ROW
EXECUTE FUNCTION update_tenant_config_update_time();