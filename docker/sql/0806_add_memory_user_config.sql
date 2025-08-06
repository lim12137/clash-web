CREATE SEQUENCE "nexent"."memory_user_config_t_config_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

CREATE TABLE "nexent"."memory_user_config_t" (
  "config_id" int4 NOT NULL DEFAULT nextval('"nexent".memory_user_config_t_config_id_seq'::regclass),
  "tenant_id" varchar(100) COLLATE "pg_catalog"."default",
  "user_id" varchar(100) COLLATE "pg_catalog"."default",
  "value_type" varchar(100) COLLATE "pg_catalog"."default",
  "config_key" varchar(100) COLLATE "pg_catalog"."default",
  "config_value" varchar(100) COLLATE "pg_catalog"."default",
  "create_time" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "update_time" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "created_by" varchar(100) COLLATE "pg_catalog"."default",
  "updated_by" varchar(100) COLLATE "pg_catalog"."default",
  "delete_flag" varchar(1) COLLATE "pg_catalog"."default" DEFAULT 'N'::character varying,
  CONSTRAINT "tenant_config_t_copy1_pkey" PRIMARY KEY ("config_id")
)
;

ALTER TABLE "nexent"."memory_user_config_t" OWNER TO "root";

COMMENT ON COLUMN "nexent"."memory_user_config_t"."config_id" IS 'ID';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."tenant_id" IS 'Tenant ID';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."user_id" IS 'User ID';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."value_type" IS 'Value type. Optional values: single/multi';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."config_key" IS 'Config key';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."config_value" IS 'Config value';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."create_time" IS 'Creation time';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."update_time" IS 'Update time';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."created_by" IS 'Creator';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."updated_by" IS 'Updater';

COMMENT ON COLUMN "nexent"."memory_user_config_t"."delete_flag" IS 'Whether it is deleted. Optional values: Y/N';

COMMENT ON TABLE "nexent"."memory_user_config_t" IS 'User configuration of memory setting table';

SELECT setval('"nexent"."memory_user_config_t_config_id_seq"', 18, true);

ALTER SEQUENCE "nexent"."memory_user_config_t_config_id_seq"
OWNED BY "nexent"."memory_user_config_t"."tenant_id";

ALTER SEQUENCE "nexent"."memory_user_config_t_config_id_seq" OWNER TO "root";

CREATE FUNCTION "nexent"."update_tenant_config_update_time"()
  RETURNS "pg_catalog"."trigger" AS $BODY$
BEGIN
    NEW.update_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;

ALTER FUNCTION "nexent"."update_tenant_config_update_time"() OWNER TO "root";

CREATE TRIGGER "update_memory_user_config_update_time_trigger" BEFORE UPDATE ON "nexent"."memory_user_config_t"
FOR EACH ROW
EXECUTE PROCEDURE "nexent"."update_tenant_config_update_time"();