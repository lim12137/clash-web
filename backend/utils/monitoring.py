"""
Global Monitoring Manager for Backend

This module initializes and configures the global monitoring manager instance
with backend environment variables. All other backend modules should import
`monitoring_manager` directly from this module.

Usage:
    from utils.monitoring import monitoring_manager
    
    @monitoring_manager.monitor_endpoint("my_service.my_function")
    async def my_function():
        return {"status": "ok"}
"""

from nexent.monitor import (
    MonitoringConfig,
    get_monitoring_manager
)
# Import configuration from backend (support both relative and absolute imports)
try:
    # Try relative import first (when running from backend directory)
    from consts.const import (
        ENABLE_TELEMETRY,
        SERVICE_NAME,
        JAEGER_ENDPOINT,
        PROMETHEUS_PORT,
        TELEMETRY_SAMPLE_RATE,
        LLM_SLOW_REQUEST_THRESHOLD_SECONDS,
        LLM_SLOW_TOKEN_RATE_THRESHOLD
    )
except ImportError:
    # Fallback to absolute import (when running from project root)
    from backend.consts.const import (
        ENABLE_TELEMETRY,
        SERVICE_NAME,
        JAEGER_ENDPOINT,
        PROMETHEUS_PORT,
        TELEMETRY_SAMPLE_RATE,
        LLM_SLOW_REQUEST_THRESHOLD_SECONDS,
        LLM_SLOW_TOKEN_RATE_THRESHOLD
    )

import logging

logger = logging.getLogger(__name__)

# ============================================================================
# Global Monitoring Manager Instance
# ============================================================================

# Get the global monitoring manager instance
monitoring_manager = get_monitoring_manager()

# Initialize monitoring configuration immediately when this module is imported


def _initialize_monitoring():
    """Initialize monitoring configuration with backend environment variables."""
    config = MonitoringConfig(
        enable_telemetry=ENABLE_TELEMETRY,
        service_name=SERVICE_NAME,
        jaeger_endpoint=JAEGER_ENDPOINT,
        prometheus_port=PROMETHEUS_PORT,
        telemetry_sample_rate=TELEMETRY_SAMPLE_RATE,
        llm_slow_request_threshold_seconds=LLM_SLOW_REQUEST_THRESHOLD_SECONDS,
        llm_slow_token_rate_threshold=LLM_SLOW_TOKEN_RATE_THRESHOLD
    )

    # Configure the SDK monitoring system using the singleton
    monitoring_manager.configure(config)
    logger.info(
        f"Global monitoring initialized: service_name={SERVICE_NAME}, enable_telemetry={ENABLE_TELEMETRY}")


# Initialize monitoring when module is imported
_initialize_monitoring()


# Export the global monitoring manager instance
__all__ = [
    'monitoring_manager'
]
