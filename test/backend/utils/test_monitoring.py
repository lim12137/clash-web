"""
Unit tests for backend monitoring utilities.

Tests the actual functionality and integration of the monitoring system.
"""

import pytest
from unittest.mock import MagicMock
from backend.utils.monitoring import monitoring_manager


class TestMonitoringUtilsModule:
    """Test backend monitoring utilities module functionality."""

    def test_monitoring_manager_exists(self):
        """Test that monitoring_manager is properly exported."""
        assert monitoring_manager is not None
        assert hasattr(monitoring_manager, 'configure')
        assert hasattr(monitoring_manager, 'monitor_endpoint')
        assert hasattr(monitoring_manager, 'monitor_llm_call')

    def test_monitoring_manager_methods_callable(self):
        """Test that monitoring manager methods are callable."""
        # These should not raise exceptions when called
        monitoring_manager.add_span_event("test_event")
        monitoring_manager.set_span_attributes(key="value")
        monitoring_manager.record_llm_metrics("ttft", 0.5, {})

        # Property access should work
        is_enabled = monitoring_manager.is_enabled
        assert isinstance(is_enabled, bool)

    def test_monitoring_manager_decorators(self):
        """Test that monitoring decorators work."""
        @monitoring_manager.monitor_endpoint("test_operation")
        def test_function():
            return {"result": "success"}

        # Function should work normally
        result = test_function()
        assert result == {"result": "success"}

    def test_monitoring_manager_llm_decorator(self):
        """Test that LLM monitoring decorator works."""
        @monitoring_manager.monitor_llm_call("test_model")
        def test_llm_function(**kwargs):
            # Should handle the _token_tracker kwarg
            return {"result": "llm_success"}

        # Function should work normally
        result = test_llm_function()
        assert result == {"result": "llm_success"}

    def test_monitoring_manager_context_manager(self):
        """Test that monitoring context manager works."""
        with monitoring_manager.trace_llm_request("test_op", "test_model") as span:
            # Should work whether span is None or a real span
            pass

    def test_token_tracker_creation(self):
        """Test that token tracker can be created."""
        tracker = monitoring_manager.create_token_tracker("test_model")
        assert tracker is not None

        # Should be able to call methods without errors
        tracker.record_first_token()
        tracker.record_token("test_token")
        tracker.record_completion(input_tokens=10, output_tokens=15)

    def test_fastapi_app_setup(self):
        """Test FastAPI app setup functionality."""
        mock_app = MagicMock()

        # Should return a boolean and not raise exceptions
        result = monitoring_manager.setup_fastapi_app(mock_app)
        assert isinstance(result, bool)

        # Should handle None app gracefully
        result = monitoring_manager.setup_fastapi_app(None)
        assert result is False

    def test_configuration_methods(self):
        """Test configuration-related methods."""
        from sdk.nexent.monitor.monitoring import MonitoringConfig

        # Should be able to configure without errors
        config = MonitoringConfig(
            enable_telemetry=False,
            service_name="test-service"
        )

        # Should not raise exceptions
        monitoring_manager.configure(config)

    def test_error_resilience(self):
        """Test that monitoring handles errors gracefully."""
        # These should not raise exceptions even if monitoring has issues
        try:
            monitoring_manager.add_span_event("test_event", {"key": "value"})
            monitoring_manager.set_span_attributes(test_attr="test_value")
            monitoring_manager.record_llm_metrics(
                "token_rate", 10.0, {"model": "test"})
        except Exception as e:
            pytest.fail(
                f"Monitoring methods should handle errors gracefully: {e}")

    def test_complex_decorator_scenario(self):
        """Test complex decorator usage scenarios."""
        @monitoring_manager.monitor_endpoint("complex_operation", exclude_params=["password"])
        async def async_function(username, password, debug=False):
            return {"username": username, "debug": debug}

        @monitoring_manager.monitor_endpoint("sync_operation")
        def sync_function(data):
            return {"processed": data}

        # Both should work
        import asyncio
        result1 = asyncio.run(async_function("user1", "secret", debug=True))
        assert result1["username"] == "user1"
        assert result1["debug"] is True

        result2 = sync_function("test_data")
        assert result2["processed"] == "test_data"

    def test_monitoring_with_exceptions(self):
        """Test monitoring behavior when decorated functions raise exceptions."""
        @monitoring_manager.monitor_endpoint("error_operation")
        def error_function():
            raise ValueError("Test error")

        # Exception should be propagated
        with pytest.raises(ValueError, match="Test error"):
            error_function()

    def test_module_attributes(self):
        """Test that the module has correct attributes."""
        import backend.utils.monitoring as monitoring_module

        # Should have monitoring_manager
        assert hasattr(monitoring_module, 'monitoring_manager')

        # Should have __all__ export list
        assert hasattr(monitoring_module, '__all__')
        assert 'monitoring_manager' in monitoring_module.__all__

    def test_singleton_behavior(self):
        """Test that monitoring manager maintains singleton behavior."""
        from backend.utils.monitoring import monitoring_manager as manager1
        from backend.utils.monitoring import monitoring_manager as manager2

        # Should be the same instance
        assert manager1 is manager2

    def test_edge_case_parameters(self):
        """Test monitoring with edge case parameters."""
        # Empty strings
        monitoring_manager.add_span_event("")
        monitoring_manager.set_span_attributes()

        # Large data
        large_data = {"key": "x" * 1000}
        monitoring_manager.add_span_event("large_event", large_data)

        # None values
        monitoring_manager.add_span_event("none_test", None)

    def test_concurrent_usage(self):
        """Test concurrent usage of monitoring manager."""
        import threading

        results = []

        def worker():
            try:
                monitoring_manager.add_span_event("concurrent_test")
                monitoring_manager.set_span_attributes(
                    worker_id=threading.current_thread().ident)
                results.append("success")
            except Exception as e:
                results.append(f"error: {e}")

        threads = [threading.Thread(target=worker) for _ in range(5)]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All workers should complete successfully
        assert len(results) == 5
        assert all(r == "success" for r in results)

    def test_decorator_parameter_filtering(self):
        """Test that parameter filtering works in decorators."""
        @monitoring_manager.monitor_endpoint("param_filter_test", exclude_params=["secret"])
        def function_with_secrets(public_data, secret, debug=True):
            return {"public": public_data, "debug": debug}

        # Should work without exposing secret parameter
        result = function_with_secrets("visible", "hidden", debug=False)
        assert result["public"] == "visible"
        assert result["debug"] is False

    def test_llm_decorator_with_token_tracker(self):
        """Test LLM decorator properly handles token tracker parameter."""
        @monitoring_manager.monitor_llm_call("gpt-4")
        def mock_llm_call(**kwargs):
            # Should receive _token_tracker parameter
            assert "_token_tracker" in kwargs
            token_tracker = kwargs["_token_tracker"]

            # Should be able to use token tracker (may be None when disabled)
            if token_tracker:
                token_tracker.record_first_token()
                token_tracker.record_token("test")
                token_tracker.record_completion(10, 5)

            return "LLM response"

        result = mock_llm_call()
        assert result == "LLM response"

    def test_context_manager_error_handling(self):
        """Test context manager handles errors properly."""
        try:
            with monitoring_manager.trace_llm_request("error_op", "test_model") as span:
                # Should be able to work with span even if it's None
                if span:
                    span.set_attribute("test", "value")
                # Raise an error to test error handling
                raise RuntimeError("Test error in context")
        except RuntimeError:
            # Error should be properly propagated
            pass

    def test_metrics_recording_all_types(self):
        """Test all types of metrics recording."""
        # Should handle different metric types
        monitoring_manager.record_llm_metrics("ttft", 0.5, {"model": "test"})
        monitoring_manager.record_llm_metrics(
            "token_rate", 10.5, {"model": "test"})
        monitoring_manager.record_llm_metrics(
            "tokens", 100, {"model": "test", "type": "input"})
        monitoring_manager.record_llm_metrics(
            "unknown_type", 42, {"model": "test"})

    def test_get_current_span(self):
        """Test getting current span functionality."""
        span = monitoring_manager.get_current_span()
        # Should return None when monitoring is disabled or no active span
        # Should not raise an exception
