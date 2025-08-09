ALTER TABLE nexent.ag_tenant_agent_t
ADD COLUMN name_zh VARCHAR(100);
COMMENT ON COLUMN nexent.ag_tenant_agent_t.name_zh IS 'Agent中文名称';