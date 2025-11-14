import os
import sys
import types
import importlib


class FakeRay:
    def __init__(self, initialized=False):
        self._initialized = initialized
        self.inits = []
        self.cluster_resources_return = {}

    def is_initialized(self):
        return self._initialized

    def init(self, **kwargs):
        self._initialized = True
        self.inits.append(kwargs)

    def cluster_resources(self):
        return self.cluster_resources_return


def setup_mocks_for_ray_config(mocker, initialized=False):
    """Setup all necessary mocks before importing ray_config module"""
    fake_ray = FakeRay(initialized=initialized)
    
    # Mock ray module
    mocker.patch.dict(sys.modules, {"ray": fake_ray})
    
    # Stub celery module (required by app.py and tasks.py imported via __init__.py)
    if "celery.backends.base" not in sys.modules:
        backends_base_mod = types.ModuleType("celery.backends.base")
        backends_base_mod.DisabledBackend = type("DisabledBackend", (), {})
        sys.modules["celery.backends.base"] = backends_base_mod
    
    if "celery.exceptions" not in sys.modules:
        exceptions_mod = types.ModuleType("celery.exceptions")
        exceptions_mod.Retry = type("Retry", (Exception,), {})
        sys.modules["celery.exceptions"] = exceptions_mod
    
    if "celery.result" not in sys.modules:
        result_mod = types.ModuleType("celery.result")
        result_mod.AsyncResult = type("AsyncResult", (), {})
        sys.modules["celery.result"] = result_mod
    
    if "celery" not in sys.modules:
        celery_mod = types.ModuleType("celery")
        # Create a Celery class that accepts any arguments and has required attributes
        class FakeBackend:
            pass
        
        class FakeCelery:
            def __init__(self, *args, **kwargs):
                # Set backend to a non-DisabledBackend instance
                self.backend = FakeBackend()
                # Create a conf object with update method
                self.conf = types.SimpleNamespace(update=lambda **kwargs: None)
            
            def task(self, *args, **kwargs):
                # Return a decorator that returns the function unchanged
                def decorator(func):
                    return func
                return decorator
        
        # Stub classes and functions needed by tasks.py
        celery_mod.Celery = FakeCelery
        celery_mod.Task = type("Task", (), {})
        celery_mod.chain = lambda *args: None
        celery_mod.states = types.SimpleNamespace(
            PENDING="PENDING",
            STARTED="STARTED",
            SUCCESS="SUCCESS",
            FAILURE="FAILURE",
            RETRY="RETRY",
            REVOKED="REVOKED"
        )
        sys.modules["celery"] = celery_mod
    
    # Stub consts.const module
    if "consts" not in sys.modules:
        sys.modules["consts"] = types.ModuleType("consts")
        setattr(sys.modules["consts"], "__path__", [])
    if "consts.const" not in sys.modules:
        const_mod = types.ModuleType("consts.const")
        # Constants required by ray_config
        const_mod.RAY_OBJECT_STORE_MEMORY_GB = 0.25
        const_mod.RAY_TEMP_DIR = "/tmp/ray"
        const_mod.RAY_preallocate_plasma = False
        # Constants required by app.py (imported via __init__.py)
        const_mod.ELASTICSEARCH_SERVICE = "http://api"
        const_mod.REDIS_BACKEND_URL = "redis://test"
        const_mod.REDIS_URL = "redis://test"
        const_mod.DATA_PROCESS_SERVICE = "http://data-process"
        const_mod.FORWARD_REDIS_RETRY_DELAY_S = 0
        const_mod.FORWARD_REDIS_RETRY_MAX = 1
        const_mod.DISABLE_RAY_DASHBOARD = False
        sys.modules["consts.const"] = const_mod
    
    # Stub consts.model (required by utils.file_management_utils)
    if "consts.model" not in sys.modules:
        model_mod = types.ModuleType("consts.model")
        class ProcessParams:
            def __init__(self, chunking_strategy: str, source_type: str, index_name: str, authorization: str | None):
                self.chunking_strategy = chunking_strategy
                self.source_type = source_type
                self.index_name = index_name
                self.authorization = authorization
        model_mod.ProcessParams = ProcessParams
        sys.modules["consts.model"] = model_mod
    
    # Stub database modules (required by utils.file_management_utils and ray_actors)
    if "database" not in sys.modules:
        db_pkg = types.ModuleType("database")
        setattr(db_pkg, "__path__", [])
        sys.modules["database"] = db_pkg
    if "database.attachment_db" not in sys.modules:
        sys.modules["database.attachment_db"] = types.SimpleNamespace(
            get_file_size_from_minio=lambda object_name, bucket=None: 0,
        )
        setattr(sys.modules["database"], "attachment_db", sys.modules["database.attachment_db"])
    if "database.model_management_db" not in sys.modules:
        sys.modules["database.model_management_db"] = types.SimpleNamespace(
            get_model_by_model_id=lambda model_id, tenant_id=None: None
        )
        setattr(sys.modules["database"], "model_management_db", sys.modules["database.model_management_db"])
    
    # Stub utils modules (required by utils.file_management_utils)
    if "utils.auth_utils" not in sys.modules:
        sys.modules["utils.auth_utils"] = types.SimpleNamespace(
            get_current_user_id=lambda authorization: ("user-test", "tenant-test")
        )
    if "utils.config_utils" not in sys.modules:
        cfg_mod = types.ModuleType("utils.config_utils")
        cfg_mod.tenant_config_manager = types.SimpleNamespace(
            load_config=lambda tenant_id: {}
        )
        sys.modules["utils.config_utils"] = cfg_mod
    
    # Stub external dependencies (required by utils.file_management_utils)
    if "aiofiles" not in sys.modules:
        sys.modules["aiofiles"] = types.SimpleNamespace(
            open=lambda *args, **kwargs: types.SimpleNamespace(
                __aenter__=lambda: types.SimpleNamespace(
                    write=lambda content: None,
                    __aexit__=lambda *args: None
                ),
                __aexit__=lambda *args: None
            )
        )
    if "httpx" not in sys.modules:
        sys.modules["httpx"] = types.SimpleNamespace()
    if "requests" not in sys.modules:
        sys.modules["requests"] = types.SimpleNamespace()
    if "fastapi" not in sys.modules:
        fastapi_mod = types.ModuleType("fastapi")
        fastapi_mod.UploadFile = type("UploadFile", (), {})
        sys.modules["fastapi"] = fastapi_mod
    
    # Stub utils.file_management_utils (required by tasks.py)
    if "utils.file_management_utils" not in sys.modules:
        file_utils_mod = types.ModuleType("utils.file_management_utils")
        file_utils_mod.get_file_size = lambda *args, **kwargs: 0
        sys.modules["utils.file_management_utils"] = file_utils_mod
    
    # Stub ray_actors (required by tasks.py)
    if "backend.data_process.ray_actors" not in sys.modules:
        ray_actors_mod = types.ModuleType("backend.data_process.ray_actors")
        ray_actors_mod.DataProcessorRayActor = type("DataProcessorRayActor", (), {})
        sys.modules["backend.data_process.ray_actors"] = ray_actors_mod
    
    # Stub aiohttp (required by tasks.py)
    if "aiohttp" not in sys.modules:
        sys.modules["aiohttp"] = types.SimpleNamespace()
    
    # Stub nexent.data_process (required by tasks.py)
    if "nexent.data_process" not in sys.modules:
        sys.modules["nexent.data_process"] = types.SimpleNamespace(
            DataProcessCore=type("_Core", (), {"__init__": lambda self: None, "file_process": lambda *a, **k: []})
        )
    
    # Import and reload the module after mocks are in place
    import backend.data_process.ray_config as ray_config_module
    importlib.reload(ray_config_module)
    
    return ray_config_module, fake_ray


def test_ray_config_init(mocker):
    """Test RayConfig initialization"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker)
    
    config = ray_config_module.RayConfig()
    assert config.object_store_memory_gb == 0.25
    assert config.temp_dir == "/tmp/ray"
    assert config.preallocate_plasma is False


def test_get_init_params_local_cluster(mocker):
    """Test get_init_params for local cluster"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker)
    
    config = ray_config_module.RayConfig()
    params = config.get_init_params(num_cpus=4, include_dashboard=True)
    
    assert params["ignore_reinit_error"] is True
    assert params["num_cpus"] == 4
    assert params["include_dashboard"] is True
    assert params["dashboard_host"] == "0.0.0.0"
    assert params["dashboard_port"] == 8265
    assert params["object_store_memory"] == int(0.25 * 1024 * 1024 * 1024)
    assert params["_temp_dir"] == "/tmp/ray"
    assert params["object_spilling_directory"] == "/tmp/ray"


def test_get_init_params_local_cluster_no_dashboard(mocker):
    """Test get_init_params for local cluster without dashboard"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker)
    
    config = ray_config_module.RayConfig()
    params = config.get_init_params(num_cpus=2, include_dashboard=False)
    
    assert params["include_dashboard"] is False
    assert "dashboard_host" not in params
    assert "dashboard_port" not in params


def test_get_init_params_with_address(mocker):
    """Test get_init_params with cluster address"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker)
    
    config = ray_config_module.RayConfig()
    params = config.get_init_params(address="ray://localhost:10001")
    
    assert params["ignore_reinit_error"] is True
    assert params["address"] == "ray://localhost:10001"
    assert "num_cpus" not in params
    assert "object_store_memory" not in params


def test_get_init_params_custom_dashboard_port(mocker):
    """Test get_init_params with custom dashboard port"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker)
    
    config = ray_config_module.RayConfig()
    params = config.get_init_params(include_dashboard=True, dashboard_port=9000)
    
    assert params["dashboard_port"] == 9000


def test_init_ray_already_initialized(mocker):
    """Test init_ray when Ray is already initialized"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=True)
    
    config = ray_config_module.RayConfig()
    result = config.init_ray(num_cpus=2)
    
    assert result is True
    assert len(fake_ray.inits) == 0


def test_init_ray_success(mocker):
    """Test successful Ray initialization"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    config = ray_config_module.RayConfig()
    fake_ray.cluster_resources_return = {
        "memory": 8 * 1024 * 1024 * 1024,
        "object_store_memory": 2 * 1024 * 1024 * 1024
    }
    
    result = config.init_ray(num_cpus=2, include_dashboard=False)
    
    assert result is True
    assert len(fake_ray.inits) == 1
    assert fake_ray.inits[0]["num_cpus"] == 2
    assert fake_ray.inits[0]["include_dashboard"] is False
    assert os.environ.get("RAY_preallocate_plasma") == "false"


def test_init_ray_failure(mocker):
    """Test Ray initialization failure"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    def failing_init(**kwargs):
        raise RuntimeError("Ray init failed")
    
    fake_ray.init = failing_init
    
    config = ray_config_module.RayConfig()
    result = config.init_ray(num_cpus=2)
    
    assert result is False


def test_init_ray_cluster_resources_error(mocker):
    """Test init_ray handles cluster_resources error gracefully"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    def failing_cluster_resources():
        raise RuntimeError("Cannot get resources")
    
    fake_ray.cluster_resources = failing_cluster_resources
    
    config = ray_config_module.RayConfig()
    result = config.init_ray(num_cpus=2, include_dashboard=False)
    
    # Should still succeed even if cluster_resources fails
    assert result is True
    assert len(fake_ray.inits) == 1


def test_connect_to_cluster_already_initialized(mocker):
    """Test connect_to_cluster when Ray is already initialized"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=True)
    
    config = ray_config_module.RayConfig()
    result = config.connect_to_cluster("ray://localhost:10001")
    
    assert result is True
    assert len(fake_ray.inits) == 0


def test_connect_to_cluster_success(mocker):
    """Test successful connection to Ray cluster"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    config = ray_config_module.RayConfig()
    result = config.connect_to_cluster("ray://localhost:10001")
    
    assert result is True
    assert len(fake_ray.inits) == 1
    assert fake_ray.inits[0]["address"] == "ray://localhost:10001"
    assert os.environ.get("RAY_preallocate_plasma") == "false"


def test_connect_to_cluster_failure(mocker):
    """Test connection failure to Ray cluster"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    def failing_init(**kwargs):
        raise ConnectionError("Cannot connect")
    
    fake_ray.init = failing_init
    
    config = ray_config_module.RayConfig()
    result = config.connect_to_cluster("ray://localhost:10001")
    
    assert result is False


def test_start_local_cluster_with_num_cpus(mocker):
    """Test start_local_cluster with specified num_cpus"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    config = ray_config_module.RayConfig()
    result = config.start_local_cluster(num_cpus=4, include_dashboard=True, dashboard_port=8265)
    
    assert result is True
    assert len(fake_ray.inits) == 1
    assert fake_ray.inits[0]["num_cpus"] == 4
    assert fake_ray.inits[0]["include_dashboard"] is True
    assert fake_ray.inits[0]["dashboard_port"] == 8265


def test_start_local_cluster_without_num_cpus(mocker):
    """Test start_local_cluster without num_cpus (uses os.cpu_count)"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    # Mock os.cpu_count to return 8
    mocker.patch("backend.data_process.ray_config.os.cpu_count", return_value=8)
    
    config = ray_config_module.RayConfig()
    result = config.start_local_cluster(include_dashboard=False)
    
    assert result is True
    assert len(fake_ray.inits) == 1
    assert fake_ray.inits[0]["num_cpus"] == 8


def test_init_ray_for_worker(mocker):
    """Test init_ray_for_worker class method"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    # Mock log_configuration to avoid AttributeError on plasma_directory
    mocker.patch("backend.data_process.ray_config.ray_config.log_configuration")
    
    result = ray_config_module.RayConfig.init_ray_for_worker("ray://localhost:10001")
    
    assert result is True
    assert len(fake_ray.inits) == 1
    assert fake_ray.inits[0]["address"] == "ray://localhost:10001"


def test_init_ray_for_service_try_connect_first_success(mocker):
    """Test init_ray_for_service with try_connect_first=True and successful connection"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    # Mock log_configuration
    mocker.patch("backend.data_process.ray_config.ray_config.log_configuration")
    
    result = ray_config_module.RayConfig.init_ray_for_service(
        num_cpus=4,
        dashboard_port=8265,
        try_connect_first=True,
        include_dashboard=True
    )
    
    assert result is True
    # Should try to connect first, which will succeed
    assert len(fake_ray.inits) >= 1


def test_init_ray_for_service_try_connect_first_failure(mocker):
    """Test init_ray_for_service with try_connect_first=True but connection fails"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    # Mock log_configuration
    mocker.patch("backend.data_process.ray_config.ray_config.log_configuration")
    
    # Make connect_to_cluster fail first time, succeed second time (for start_local_cluster)
    call_count = [0]
    
    def mock_connect(self, address):
        call_count[0] += 1
        if call_count[0] == 1:
            return False  # First connection attempt fails
        return True
    
    mocker.patch.object(ray_config_module.RayConfig, "connect_to_cluster", side_effect=lambda address: mock_connect(None, address))
    mocker.patch("backend.data_process.ray_config.os.cpu_count", return_value=4)
    
    result = ray_config_module.RayConfig.init_ray_for_service(
        num_cpus=4,
        dashboard_port=8265,
        try_connect_first=True,
        include_dashboard=True
    )
    
    # Should fall back to start_local_cluster
    assert result is True


def test_init_ray_for_service_no_try_connect(mocker):
    """Test init_ray_for_service with try_connect_first=False"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    # Mock log_configuration
    mocker.patch("backend.data_process.ray_config.ray_config.log_configuration")
    mocker.patch("backend.data_process.ray_config.os.cpu_count", return_value=4)
    
    result = ray_config_module.RayConfig.init_ray_for_service(
        num_cpus=4,
        dashboard_port=8265,
        try_connect_first=False,
        include_dashboard=True
    )
    
    assert result is True
    # Should directly start local cluster
    assert len(fake_ray.inits) == 1
    assert fake_ray.inits[0]["num_cpus"] == 4


def test_get_init_params_object_store_memory_calculation(mocker):
    """Test object store memory calculation"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker)
    
    # Set custom memory size
    if "consts.const" in sys.modules:
        sys.modules["consts.const"].RAY_OBJECT_STORE_MEMORY_GB = 1.5
    
    # Reload to pick up new constant value
    importlib.reload(ray_config_module)
    
    config = ray_config_module.RayConfig()
    params = config.get_init_params(num_cpus=2)
    
    expected_bytes = int(1.5 * 1024 * 1024 * 1024)
    assert params["object_store_memory"] == expected_bytes


def test_init_ray_sets_preallocate_plasma_env(mocker):
    """Test that init_ray sets RAY_preallocate_plasma environment variable"""
    ray_config_module, fake_ray = setup_mocks_for_ray_config(mocker, initialized=False)
    
    # Set preallocate_plasma to True
    if "consts.const" in sys.modules:
        sys.modules["consts.const"].RAY_preallocate_plasma = True
    
    # Reload to pick up new constant value
    importlib.reload(ray_config_module)
    
    config = ray_config_module.RayConfig()
    config.preallocate_plasma = True
    
    config.init_ray(num_cpus=2, include_dashboard=False)
    
    assert os.environ.get("RAY_preallocate_plasma") == "true"
