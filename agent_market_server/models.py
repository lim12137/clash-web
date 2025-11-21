"""
Database models for Agent Market Server
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class MarketAgent(Base):
    """Agent information table"""
    __tablename__ = 'market_agent_t'
    __table_args__ = {'schema': 'agent_market'}

    agent_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    display_name = Column(String(100))
    description = Column(Text)
    business_description = Column(Text)
    logo_url = Column(String(500))
    max_steps = Column(Integer, default=5)
    provide_run_summary = Column(Boolean, default=False)
    duty_prompt = Column(Text)
    constraint_prompt = Column(Text)
    few_shots_prompt = Column(Text)
    enabled = Column(Boolean, default=True)
    model_id = Column(Integer)
    model_name = Column(String(100))
    business_logic_model_id = Column(Integer)
    business_logic_model_name = Column(String(100))
    create_time = Column(TIMESTAMP, default=datetime.utcnow)
    update_time = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100))
    updated_by = Column(String(100))
    delete_flag = Column(String(1), default='N')

    # Relationships
    tools = relationship("MarketAgentToolRel", back_populates="agent")
    mcps = relationship("MarketAgentMcpRel", back_populates="agent")


class MarketTool(Base):
    """Tool information table"""
    __tablename__ = 'market_tool_t'
    __table_args__ = {'schema': 'agent_market'}

    tool_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    class_name = Column(String(100))
    description = Column(Text)
    inputs = Column(Text)
    output_type = Column(String(100))
    source = Column(String(100))
    usage = Column(String(100))
    params = Column(JSON)
    tool_metadata = Column('metadata', JSON)  # Use 'metadata' as database column name
    create_time = Column(TIMESTAMP, default=datetime.utcnow)
    update_time = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100))
    updated_by = Column(String(100))
    delete_flag = Column(String(1), default='N')

    # Relationships
    agents = relationship("MarketAgentToolRel", back_populates="tool")


class MarketMcpServer(Base):
    """MCP server information table"""
    __tablename__ = 'market_mcp_server_t'
    __table_args__ = {'schema': 'agent_market'}

    mcp_id = Column(Integer, primary_key=True, autoincrement=True)
    mcp_server_name = Column(String(100), nullable=False)
    mcp_url = Column(String(500), nullable=False)
    create_time = Column(TIMESTAMP, default=datetime.utcnow)
    update_time = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100))
    updated_by = Column(String(100))
    delete_flag = Column(String(1), default='N')

    # Relationships
    agents = relationship("MarketAgentMcpRel", back_populates="mcp")


class MarketAgentToolRel(Base):
    """Agent-Tool relationship table"""
    __tablename__ = 'market_agent_tool_rel_t'
    __table_args__ = {'schema': 'agent_market'}

    rel_id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(Integer, ForeignKey('agent_market.market_agent_t.agent_id', ondelete='CASCADE'), nullable=False)
    tool_id = Column(Integer, ForeignKey('agent_market.market_tool_t.tool_id', ondelete='CASCADE'), nullable=False)
    create_time = Column(TIMESTAMP, default=datetime.utcnow)
    created_by = Column(String(100))
    delete_flag = Column(String(1), default='N')

    # Relationships
    agent = relationship("MarketAgent", back_populates="tools")
    tool = relationship("MarketTool", back_populates="agents")


class MarketAgentMcpRel(Base):
    """Agent-MCP server relationship table"""
    __tablename__ = 'market_agent_mcp_rel_t'
    __table_args__ = {'schema': 'agent_market'}

    rel_id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(Integer, ForeignKey('agent_market.market_agent_t.agent_id', ondelete='CASCADE'), nullable=False)
    mcp_id = Column(Integer, ForeignKey('agent_market.market_mcp_server_t.mcp_id', ondelete='CASCADE'), nullable=False)
    create_time = Column(TIMESTAMP, default=datetime.utcnow)
    created_by = Column(String(100))
    delete_flag = Column(String(1), default='N')

    # Relationships
    agent = relationship("MarketAgent", back_populates="mcps")
    mcp = relationship("MarketMcpServer", back_populates="agents")

