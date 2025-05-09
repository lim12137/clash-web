from sqlalchemy import Column, Integer, String, TIMESTAMP, Sequence, Numeric
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func

class Base(DeclarativeBase):
    pass

class ConversationRecord(Base):
    """
    Overall information table for Q&A conversations
    """
    __tablename__ = "conversation_record_t"
    __table_args__ = {"schema": "nexent"}

    conversation_id = Column(Integer, Sequence("conversation_record_t_conversation_id_seq", schema="nexent"), primary_key=True, nullable=False)
    conversation_title = Column(String(100), doc="Conversation title")
    delete_flag = Column(String(1), default="N", doc="After the user deletes it on the frontend, the deletion flag will be set to \"Y\" for soft deletion. Optional values: Y/N")
    update_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Update date, audit field")
    create_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Creation time, audit field")
    updated_by = Column(String(100), doc="ID of the last updater, audit field")
    created_by = Column(String(100), doc="ID of the creator, audit field")

class ConversationMessage(Base):
    """
    Holds the specific response message content in the conversation
    """
    __tablename__ = "conversation_message_t"
    __table_args__ = {"schema": "nexent"}

    message_id = Column(Integer, Sequence("conversation_message_t_message_id_seq", schema="nexent"), primary_key=True, nullable=False)
    conversation_id = Column(Integer, doc="Formal foreign key used to associate with the所属 conversation")
    message_index = Column(Integer, doc="Sequence number for frontend display sorting")
    message_role = Column(String(30), doc="The role sending the message, such as system, assistant, user")
    message_content = Column(String, doc="The complete content of the message")
    minio_files = Column(String, doc="Images or documents uploaded by the user on the chat page, stored as a list")
    opinion_flag = Column(String(1), doc="User evaluation of the conversation. Enumeration value \"Y\" represents a positive review, \"N\" represents a negative review")
    delete_flag = Column(String(1), default="N", doc="After the user deletes it on the frontend, the deletion flag will be set to \"Y\" for soft deletion. Optional values: Y/N")
    create_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Creation time, audit field")
    update_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Update date, audit field")
    created_by = Column(String(100), doc="ID of the creator, audit field")
    updated_by = Column(String(100), doc="ID of the last updater, audit field")

class ConversationMessageUnit(Base):
    """
    Holds the agent's output content in each message
    """
    __tablename__ = "conversation_message_unit_t"
    __table_args__ = {"schema": "nexent"}

    unit_id = Column(Integer, Sequence("conversation_message_unit_t_unit_id_seq", schema="nexent"), primary_key=True, nullable=False)
    message_id = Column(Integer, doc="Formal foreign key used to associate with the所属 message")
    conversation_id = Column(Integer, doc="Formal foreign key used to associate with the所属 conversation")
    unit_index = Column(Integer, doc="Sequence number for frontend display sorting")
    unit_type = Column(String(100), doc="Type of the smallest answer unit")
    unit_content = Column(String, doc="Complete content of the smallest reply unit")
    delete_flag = Column(String(1), default="N", doc="After the user deletes it on the frontend, the deletion flag will be set to \"Y\" for soft deletion. Optional values: Y/N")
    create_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Creation time, audit field")
    update_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Update date, audit field")
    updated_by = Column(String(100), doc="ID of the last updater, audit field")
    created_by = Column(String(100), doc="ID of the creator, audit field")

class ConversationSourceImage(Base):
    """
    Holds the search image source information of conversation messages
    """
    __tablename__ = "conversation_source_image_t"
    __table_args__ = {"schema": "nexent"}

    image_id = Column(Integer, Sequence("conversation_source_image_t_image_id_seq", schema="nexent"), primary_key=True, nullable=False)
    conversation_id = Column(Integer, doc="Formal foreign key used to associate with the conversation to which the search source belongs")
    message_id = Column(Integer, doc="Formal foreign key used to associate with the conversation message to which the search source belongs")
    unit_id = Column(Integer, doc="Formal foreign key used to associate with the smallest message unit (if any) to which the search source belongs")
    image_url = Column(String, doc="URL address of the image")
    cite_index = Column(Integer, doc="[Reserved] Citation serial number for precise traceability")
    search_type = Column(String(100), doc="[Reserved] Search source type, used to distinguish the retrieval tool from which the record originates. Optional values: web/local")
    delete_flag = Column(String(1), default="N", doc="After the user deletes it on the frontend, the deletion flag will be set to \"Y\" for soft deletion. Optional values: Y/N")
    create_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Creation time, audit field")
    update_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Update date, audit field")
    created_by = Column(String(100), doc="ID of the creator, audit field")
    updated_by = Column(String(100), doc="ID of the last updater, audit field")

class ConversationSourceSearch(Base):
    """
    Holds the search text source information referenced by the response messages in the conversation
    """
    __tablename__ = "conversation_source_search_t"
    __table_args__ = {"schema": "nexent"}

    search_id = Column(Integer, Sequence("conversation_source_search_t_search_id_seq", schema="nexent"), primary_key=True, nullable=False)
    unit_id = Column(Integer, doc="Formal foreign key used to associate with the smallest message unit (if any) to which the search source belongs")
    message_id = Column(Integer, doc="Formal foreign key used to associate with the conversation message to which the search source belongs")
    conversation_id = Column(Integer, doc="Formal foreign key used to associate with the conversation to which the search source belongs")
    source_type = Column(String(100), doc="Source type, used to distinguish whether source_location is a URL or a path. Optional values: url/text")
    source_title = Column(String(400), doc="Title or file name of the search source")
    source_location = Column(String(400), doc="URL link or file path of the search source")
    source_content = Column(String, doc="Original text of the search source")
    score_overall = Column(Numeric(7, 6), doc="Overall similarity score between the source and the user query, calculated by weighted average of details")
    score_accuracy = Column(Numeric(7, 6), doc="Accuracy score")
    score_semantic = Column(Numeric(7, 6), doc="Semantic similarity score")
    published_date = Column(TIMESTAMP(timezone=False), doc="Upload date of local files or network search date")
    cite_index = Column(Integer, doc="Citation serial number for precise traceability")
    search_type = Column(String(100), doc="Search source type, specifically describing the retrieval tool used for this search record. Optional values: exa_web_search/knowledge_base_search")
    tool_sign = Column(String(30), doc="Simple tool identifier used to distinguish the index source in the summary text output by the large model")
    create_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Creation time, audit field")
    update_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Update date, audit field")
    delete_flag = Column(String(1), default="N", doc="After the user deletes it on the frontend, the deletion flag will be set to \"Y\" for soft deletion. Optional values: Y/N")
    updated_by = Column(String(100), doc="ID of the last updater, audit field")
    created_by = Column(String(100), doc="ID of the creator, audit field")

class ModelRecord(Base):
    """
    Model list defined by the user on the configuration page
    """
    __tablename__ = "model_record_t"
    __table_args__ = {"schema": "nexent"}

    model_id = Column(Integer, Sequence("model_record_t_model_id_seq", schema="nexent"), primary_key=True, nullable=False, doc="Model ID, unique primary key")
    model_repo = Column(String(100), doc="Model path address")
    model_name = Column(String(100), nullable=False, doc="Model name")
    model_factory = Column(String(100), doc="Model vendor, determining the API key and the specific format of the model response. Currently defaults to OpenAI-API-Compatible.")
    model_type = Column(String(100), doc="Model type, such as chat, embedding, rerank, tts, asr")
    api_key = Column(String(500), doc="Model API key, used for authentication for some models")
    base_url = Column(String(500), doc="Base URL address for requesting remote model services")
    max_tokens = Column(Integer, doc="Maximum available tokens of the model")
    used_token = Column(Integer, doc="Number of tokens already used by the model in Q&A")
    display_name = Column(String(100), doc="Model name directly displayed on the frontend, customized by the user")
    connect_status = Column(String(100), doc="Model connectivity status of the latest detection. Optional values: Detecting, Available, Unavailable")
    create_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Creation time, audit field")
    delete_flag = Column(String(1), default="N", doc="After the user deletes it on the frontend, the deletion flag will be set to \"Y\" for soft deletion. Optional values: Y/N")
    update_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Update date, audit field")
    updated_by = Column(String(100), doc="ID of the last updater, audit field")
    created_by = Column(String(100), doc="ID of the creator, audit field")

class KnowledgeRecord(Base):
    """
    Records the description and status information of knowledge bases
    """
    __tablename__ = "knowledge_record_t"
    __table_args__ = {"schema": "nexent"}

    knowledge_id = Column(Integer, Sequence("knowledge_record_t_knowledge_id_seq", schema="nexent"), primary_key=True, nullable=False, doc="Knowledge base ID, unique primary key")
    index_name = Column(String(100), doc="Knowledge base name")
    knowledge_describe = Column(String(300), doc="Knowledge base description")
    delete_flag = Column(String(1), doc="Knowledge base status. Currently defaults to 1, if knowledge base status is 0, then this knowledge base is unavailable")
    create_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Creation time, audit field")
    update_time = Column(TIMESTAMP(timezone=False), server_default=func.now(), doc="Update date, audit field")
    updated_by = Column(String(100), doc="ID of the last updater, audit field")
    created_by = Column(String(100), doc="ID of the creator, audit field")