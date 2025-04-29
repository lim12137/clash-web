-- 1. 创建自定义 Schema（如果不存在）
CREATE SCHEMA IF NOT EXISTS agent_engine;

-- 2. 切换到该 Schema（后续操作默认在此 Schema 下）
SET search_path TO agent_engine;

CREATE TABLE "conversation_message_t" (
  "message_id" SERIAL,
  "conversation_id" int4,
  "message_index" int4,
  "message_role" varchar(30) COLLATE "pg_catalog"."default",
  "message_content" varchar COLLATE "pg_catalog"."default",
  "minio_files" varchar,
  "opinion_flag" varchar(1),
  "delete_flag" varchar(1) COLLATE "pg_catalog"."default" DEFAULT 'N'::character varying,
  "create_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "update_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "created_by" varchar(100) COLLATE "pg_catalog"."default",
  "updated_by" varchar(100) COLLATE "pg_catalog"."default",
  CONSTRAINT "conversation_message_t_pk" PRIMARY KEY ("message_id")
);
ALTER TABLE "conversation_message_t" OWNER TO "root";
COMMENT ON COLUMN "conversation_message_t"."conversation_id" IS '形式外键，用于关联所属的对话';
COMMENT ON COLUMN "conversation_message_t"."message_index" IS '顺序号，用于前端展示排序';
COMMENT ON COLUMN "conversation_message_t"."message_role" IS '发送消息的角色，如 system, assistant, user';
COMMENT ON COLUMN "conversation_message_t"."message_content" IS '消息的完整内容';
COMMENT ON COLUMN "conversation_message_t"."minio_files" IS '用户在聊天页面上传的图片或文档，以列表形式存储';
COMMENT ON COLUMN "conversation_message_t"."opinion_flag" IS '用户对于对话的评价，枚举值Y代表好评，N代表差评';
COMMENT ON COLUMN "conversation_message_t"."delete_flag" IS '用户前端删除后，删除标识将被置为true，达到数据软删除的效果。可选值Y/N';
COMMENT ON COLUMN "conversation_message_t"."create_time" IS '创建时间，审计字段';
COMMENT ON COLUMN "conversation_message_t"."update_time" IS '更新日期，审计字段';
COMMENT ON COLUMN "conversation_message_t"."created_by" IS '创建人ID，审计字段';
COMMENT ON COLUMN "conversation_message_t"."updated_by" IS '最后更新人ID，审计字段';
COMMENT ON TABLE "conversation_message_t" IS '承载对话中具体的响应消息内容';

CREATE TABLE "conversation_message_unit_t" (
  "unit_id" SERIAL,
  "message_id" int4,
  "conversation_id" int4,
  "unit_index" int4,
  "unit_type" varchar(100) COLLATE "pg_catalog"."default",
  "unit_content" varchar COLLATE "pg_catalog"."default",
  "delete_flag" varchar(1) COLLATE "pg_catalog"."default" DEFAULT 'N'::character varying,
  "create_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "update_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "updated_by" varchar(100) COLLATE "pg_catalog"."default",
  "created_by" varchar(100) COLLATE "pg_catalog"."default",
  CONSTRAINT "conversation_message_unit_t_pk" PRIMARY KEY ("unit_id")
);
ALTER TABLE "conversation_message_unit_t" OWNER TO "root";
COMMENT ON COLUMN "conversation_message_unit_t"."message_id" IS '形式外键，用于关联所属消息';
COMMENT ON COLUMN "conversation_message_unit_t"."conversation_id" IS '形式外键，用于关联所属对话';
COMMENT ON COLUMN "conversation_message_unit_t"."unit_index" IS '顺序号，用于前端展示排序';
COMMENT ON COLUMN "conversation_message_unit_t"."unit_type" IS '最小回答单元的类型';
COMMENT ON COLUMN "conversation_message_unit_t"."unit_content" IS '最小回复单元的完整内容';
COMMENT ON COLUMN "conversation_message_unit_t"."delete_flag" IS '用户前端删除后，删除标识将被置为true，达到数据软删除的效果。可选值Y/N';
COMMENT ON COLUMN "conversation_message_unit_t"."create_time" IS '创建时间，审计字段';
COMMENT ON COLUMN "conversation_message_unit_t"."update_time" IS '更新日期，审计字段';
COMMENT ON COLUMN "conversation_message_unit_t"."updated_by" IS '最后更新人ID，审计字段';
COMMENT ON COLUMN "conversation_message_unit_t"."created_by" IS '创建人ID，审计字段';
COMMENT ON TABLE "conversation_message_unit_t" IS '承载每条消息中agent的输出内容';

CREATE TABLE "conversation_record_t" (
  "conversation_id" SERIAL,
  "conversation_title" varchar(100) COLLATE "pg_catalog"."default",
  "delete_flag" varchar(1) COLLATE "pg_catalog"."default" DEFAULT 'N'::character varying,
  "update_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "create_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "updated_by" varchar(100) COLLATE "pg_catalog"."default",
  "created_by" varchar(100) COLLATE "pg_catalog"."default",
  CONSTRAINT "conversation_record_t_pk" PRIMARY KEY ("conversation_id")
);
ALTER TABLE "conversation_record_t" OWNER TO "root";
COMMENT ON COLUMN "conversation_record_t"."conversation_title" IS '对话标题';
COMMENT ON COLUMN "conversation_record_t"."delete_flag" IS '用户前端删除后，删除标识将被置为true，达到数据软删除的效果。可选值Y/N';
COMMENT ON COLUMN "conversation_record_t"."update_time" IS '更新日期，审计字段';
COMMENT ON COLUMN "conversation_record_t"."create_time" IS '创建时间，审计字段';
COMMENT ON COLUMN "conversation_record_t"."updated_by" IS '最后更新人ID，审计字段';
COMMENT ON COLUMN "conversation_record_t"."created_by" IS '创建人ID，审计字段';
COMMENT ON TABLE "conversation_record_t" IS '问答对话整体信息';

CREATE TABLE "conversation_source_image_t" (
  "image_id" SERIAL,
  "conversation_id" int4,
  "message_id" int4,
  "unit_id" int4,
  "image_url" varchar COLLATE "pg_catalog"."default",
  "cite_index" int4,
  "search_type" varchar(100) COLLATE "pg_catalog"."default",
  "delete_flag" varchar(1) COLLATE "pg_catalog"."default" DEFAULT 'N'::character varying,
  "create_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "update_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "created_by" varchar(100) COLLATE "pg_catalog"."default",
  "updated_by" varchar(100) COLLATE "pg_catalog"."default",
  CONSTRAINT "conversation_source_image_t_pk" PRIMARY KEY ("image_id")
);
ALTER TABLE "conversation_source_image_t" OWNER TO "root";
COMMENT ON COLUMN "conversation_source_image_t"."conversation_id" IS '形式外键，用于关联搜索来源所属的对话';
COMMENT ON COLUMN "conversation_source_image_t"."message_id" IS '形式外键，用于关联搜索来源所属的对话消息';
COMMENT ON COLUMN "conversation_source_image_t"."unit_id" IS '形式外键，用于关联搜索来源所属的最小消息单元（若有）';
COMMENT ON COLUMN "conversation_source_image_t"."image_url" IS '图片的url地址';
COMMENT ON COLUMN "conversation_source_image_t"."cite_index" IS '【预留】引用序列号，用于精确溯源';
COMMENT ON COLUMN "conversation_source_image_t"."search_type" IS '【预留】检索源类型，用于区分该记录来源的检索工具，可选值web/local';
COMMENT ON COLUMN "conversation_source_image_t"."delete_flag" IS '用户前端删除后，删除标识将被置为true，达到数据软删除的效果。可选值Y/N';
COMMENT ON COLUMN "conversation_source_image_t"."create_time" IS '创建时间，审计字段';
COMMENT ON COLUMN "conversation_source_image_t"."update_time" IS '更新日期，审计字段';
COMMENT ON COLUMN "conversation_source_image_t"."created_by" IS '创建人ID，审计字段';
COMMENT ON COLUMN "conversation_source_image_t"."updated_by" IS '最后更新人ID，审计字段';
COMMENT ON TABLE "conversation_source_image_t" IS '承载对话消息的搜索图片源信息';

CREATE TABLE "conversation_source_search_t" (
  "search_id" SERIAL,
  "unit_id" int4,
  "message_id" int4,
  "conversation_id" int4,
  "source_type" varchar(100) COLLATE "pg_catalog"."default",
  "source_title" varchar(400) COLLATE "pg_catalog"."default",
  "source_location" varchar(400) COLLATE "pg_catalog"."default",
  "source_content" varchar COLLATE "pg_catalog"."default",
  "score_overall" numeric(7,6),
  "score_accuracy" numeric(7,6),
  "score_semantic" numeric(7,6),
  "published_date" timestamp(0),
  "cite_index" int4,
  "search_type" varchar(100) COLLATE "pg_catalog"."default",
  "tool_sign" varchar(30) COLLATE "pg_catalog"."default",
  "create_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "update_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "delete_flag" varchar(1) COLLATE "pg_catalog"."default" DEFAULT 'N'::character varying,
  "updated_by" varchar(100) COLLATE "pg_catalog"."default",
  "created_by" varchar(100) COLLATE "pg_catalog"."default",
  CONSTRAINT "conversation_source_search_t_pk" PRIMARY KEY ("search_id")
);
ALTER TABLE "conversation_source_search_t" OWNER TO "root";
COMMENT ON COLUMN "conversation_source_search_t"."unit_id" IS '形式外键，用于关联搜索来源所属的最小消息单元（若有）';
COMMENT ON COLUMN "conversation_source_search_t"."message_id" IS '形式外键，用于关联搜索来源所属的对话消息';
COMMENT ON COLUMN "conversation_source_search_t"."conversation_id" IS '形式外键，用于关联搜索来源所属的对话';
COMMENT ON COLUMN "conversation_source_search_t"."source_type" IS '来源类型，用于区分source_location为网址或路径，可选值url/text';
COMMENT ON COLUMN "conversation_source_search_t"."source_title" IS '搜索来源的标题或文件名';
COMMENT ON COLUMN "conversation_source_search_t"."source_location" IS '搜索来源的网址链接或文件路径';
COMMENT ON COLUMN "conversation_source_search_t"."source_content" IS '搜索来源的原始文本';
COMMENT ON COLUMN "conversation_source_search_t"."score_overall" IS '来源与用户查询的整体相似度得分，由明细加权平均计算得出';
COMMENT ON COLUMN "conversation_source_search_t"."score_accuracy" IS '准确率评分';
COMMENT ON COLUMN "conversation_source_search_t"."score_semantic" IS '语义相似度评分';
COMMENT ON COLUMN "conversation_source_search_t"."published_date" IS '本地文件的上传日期或网络搜索的';
COMMENT ON COLUMN "conversation_source_search_t"."cite_index" IS '引用序列号，用于精确溯源';
COMMENT ON COLUMN "conversation_source_search_t"."search_type" IS '检索源类型，具体描述该搜索记录所使用的检索工具，可选值exa_web_search/knowledge_base_search';
COMMENT ON COLUMN "conversation_source_search_t"."tool_sign" IS '工具简单标识符，用于区分大模型输出总结文本中的索引来源';
COMMENT ON COLUMN "conversation_source_search_t"."create_time" IS '创建时间，审计字段';
COMMENT ON COLUMN "conversation_source_search_t"."update_time" IS '更新日期，审计字段';
COMMENT ON COLUMN "conversation_source_search_t"."delete_flag" IS '用户前端删除后，删除标识将被置为true，达到数据软删除的效果。可选值Y/N';
COMMENT ON COLUMN "conversation_source_search_t"."updated_by" IS '最后更新人ID，审计字段';
COMMENT ON COLUMN "conversation_source_search_t"."created_by" IS '创建人ID，审计字段';
COMMENT ON TABLE "conversation_source_search_t" IS '承载对话中响应消息所引用的搜索文本源信息';

CREATE TABLE "model_record_t" (
  "model_id" SERIAL,
  "model_repo" varchar(100) COLLATE "pg_catalog"."default",
  "model_name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "model_factory" varchar(100) COLLATE "pg_catalog"."default",
  "model_type" varchar(100) COLLATE "pg_catalog"."default",
  "api_key" varchar(500) COLLATE "pg_catalog"."default",
  "base_url" varchar(500) COLLATE "pg_catalog"."default",
  "max_tokens" int4,
  "used_token" int4,
  "display_name" varchar(100) COLLATE "pg_catalog"."default",
  "connect_status" varchar(100) COLLATE "pg_catalog"."default",
  "create_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "delete_flag" varchar(1) COLLATE "pg_catalog"."default" DEFAULT 'N'::character varying,
  "update_time" timestamp(0) DEFAULT CURRENT_TIMESTAMP,
  "updated_by" varchar(100) COLLATE "pg_catalog"."default",
  "created_by" varchar(100) COLLATE "pg_catalog"."default",
  CONSTRAINT "agent_engine_models_t_pk" PRIMARY KEY ("model_id")
);
ALTER TABLE "model_record_t" OWNER TO "root";
COMMENT ON COLUMN "model_record_t"."model_id" IS '模型ID，唯一主键';
COMMENT ON COLUMN "model_record_t"."model_repo" IS '模型路径地址';
COMMENT ON COLUMN "model_record_t"."model_name" IS '模型名称';
COMMENT ON COLUMN "model_record_t"."model_factory" IS '模型厂商，决定api-key与模型响应的具体格式。当前默认为OpenAI-API-Compatible。';
COMMENT ON COLUMN "model_record_t"."model_type" IS '模型类型，例如chat, embedding, rerank, tts, asr';
COMMENT ON COLUMN "model_record_t"."api_key" IS '模型APIkey，部分模型可用于鉴权';
COMMENT ON COLUMN "model_record_t"."base_url" IS '基础URL地址，用于请求远程模型服务';
COMMENT ON COLUMN "model_record_t"."max_tokens" IS '模型的最大可用Token数';
COMMENT ON COLUMN "model_record_t"."used_token" IS '模型在问答中已经使用的token数量';
COMMENT ON COLUMN "model_record_t"."display_name" IS '前台直接展示的模型名称，由用户自定义';
COMMENT ON COLUMN "model_record_t"."connect_status" IS '近一次检测的模型连通性状态，可选值：检测中、可用、不可用';
COMMENT ON COLUMN "model_record_t"."create_time" IS '创建时间，审计字段';
COMMENT ON COLUMN "model_record_t"."delete_flag" IS '用户前端删除后，删除标识将被置为true，达到数据软删除的效果。可选值Y/N';
COMMENT ON COLUMN "model_record_t"."update_time" IS '更新日期，审计字段';
COMMENT ON COLUMN "model_record_t"."updated_by" IS '最后更新人ID，审计字段';
COMMENT ON COLUMN "model_record_t"."created_by" IS '创建人ID，审计字段';
COMMENT ON TABLE "model_record_t" IS '用户在配置页面定义的模型清单';

INSERT INTO "agent_engine"."model_record_t" ("model_repo", "model_name", "model_factory", "model_type", "api_key", "base_url", "max_tokens", "used_token", "delete_flag", "create_time", "update_time", "display_name", "connect_status", "updated_by", "created_by") VALUES ('', 'tts_model', 'OpenAI-API-Compatible', 'tts', '', '', 0, 0, 'N', NULL, '2025-04-23 12:14:58', 'Volcano TTS', '不可用', NULL, NULL);
INSERT INTO "agent_engine"."model_record_t" ("model_repo", "model_name", "model_factory", "model_type", "api_key", "base_url", "max_tokens", "used_token", "delete_flag", "create_time", "update_time", "display_name", "connect_status", "updated_by", "created_by") VALUES ('', 'stt_model', 'OpenAI-API-Compatible', 'stt', '', '', 0, 0, 'N', NULL, NULL, 'Volcano STT', '不可用', NULL, NULL);
