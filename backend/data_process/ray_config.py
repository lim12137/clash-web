"""
Ray 配置管理模块

统一管理 Ray 初始化参数，避免 /dev/shm 空间不足警告
"""

import os
import logging
import ray
from typing import Dict, Any, Optional
from .config import config

logger = logging.getLogger(__name__)


class RayConfig:
    """Ray 配置管理器"""
    
    def __init__(self):
        self.plasma_directory = config.ray_plasma_directory
        self.object_store_memory_gb = config.ray_object_store_memory_gb
        self.temp_dir = config.ray_temp_dir
    
    def get_init_params(self, 
                       address: Optional[str] = None,
                       num_cpus: Optional[int] = None,
                       include_dashboard: bool = False,
                       dashboard_host: str = "0.0.0.0",
                       dashboard_port: int = 8265) -> Dict[str, Any]:
        """
        获取 Ray 初始化参数
        
        Args:
            address: Ray 集群地址，None 表示启动本地集群
            num_cpus: CPU 核心数
            include_dashboard: 是否包含 dashboard
            dashboard_host: Dashboard 主机地址
            dashboard_port: Dashboard 端口
            
        Returns:
            Ray 初始化参数字典
        """
        params = {
            "ignore_reinit_error": True,
            "_plasma_directory": self.plasma_directory,
        }
        
        if address:
            params["address"] = address
        else:
            # 本地集群配置
            if num_cpus:
                params["num_cpus"] = num_cpus
            
            # 对象存储内存配置（转换为字节）
            object_store_memory = int(self.object_store_memory_gb * 1024 * 1024 * 1024)
            params["object_store_memory"] = object_store_memory
            
            # 临时目录配置
            params["_temp_dir"] = self.temp_dir
            
            # Dashboard 配置
            if include_dashboard:
                params["include_dashboard"] = True
                params["dashboard_host"] = dashboard_host
                params["dashboard_port"] = dashboard_port
        
        return params
    
    def init_ray(self, **kwargs) -> bool:
        """
        初始化 Ray
        
        Args:
            **kwargs: 传递给 get_init_params 的参数
            
        Returns:
            是否初始化成功
        """
        try:
            if ray.is_initialized():
                logger.info("Ray 已经初始化，跳过重复初始化")
                return True
            
            params = self.get_init_params(**kwargs)
            
            logger.info("初始化 Ray 集群...")
            logger.info(f"Ray 配置参数:")
            for key, value in params.items():
                if key.startswith('_'):
                    logger.info(f"  {key}: {value}")
                elif key == 'object_store_memory':
                    logger.info(f"  {key}: {value / (1024**3):.1f} GB")
                else:
                    logger.info(f"  {key}: {value}")
            
            ray.init(**params)
            logger.info("✅ Ray 初始化成功")
            
            # 显示集群信息
            try:
                if hasattr(ray, 'cluster_resources'):
                    resources = ray.cluster_resources()
                    logger.info(f"Ray 集群资源: {resources}")
            except Exception as e:
                logger.debug(f"无法获取集群资源信息: {e}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ray 初始化失败: {str(e)}")
            return False
    
    def connect_to_cluster(self, address: str = "auto") -> bool:
        """
        连接到现有 Ray 集群
        
        Args:
            address: 集群地址，'auto' 表示自动发现
            
        Returns:
            是否连接成功
        """
        try:
            if ray.is_initialized():
                logger.info("Ray 已经初始化，跳过连接")
                return True
            
            params = self.get_init_params(address=address)
            
            logger.info(f"连接到 Ray 集群: {address}")
            ray.init(**params)
            logger.info("✅ 成功连接到 Ray 集群")
            
            return True
            
        except Exception as e:
            logger.info(f"{str(e)}")
            return False
    
    def start_local_cluster(self, 
                          num_cpus: Optional[int] = None,
                          include_dashboard: bool = True,
                          dashboard_port: int = 8265) -> bool:
        """
        启动本地 Ray 集群
        
        Args:
            num_cpus: CPU 核心数，None 表示使用所有可用核心
            include_dashboard: 是否启动 dashboard
            dashboard_port: Dashboard 端口
            
        Returns:
            是否启动成功
        """
        if num_cpus is None:
            num_cpus = os.cpu_count()
        
        return self.init_ray(
            num_cpus=num_cpus,
            include_dashboard=include_dashboard,
            dashboard_port=dashboard_port
        )
    
    def log_configuration(self):
        """记录当前配置信息"""
        logger.info("Ray 配置信息:")
        logger.info(f"  Plasma 目录: {self.plasma_directory}")
        logger.info(f"  对象存储内存: {self.object_store_memory_gb} GB")
        logger.info(f"  临时目录: {self.temp_dir}")


# 创建全局 Ray 配置实例
ray_config = RayConfig()


def init_ray_for_worker(address: str = "auto") -> bool:
    """
    为 Celery Worker 初始化 Ray 连接
    
    Args:
        address: Ray 集群地址
        
    Returns:
        是否初始化成功
    """
    logger.info("为 Celery Worker 初始化 Ray 连接...")
    ray_config.log_configuration()
    
    return ray_config.connect_to_cluster(address)


def init_ray_for_service(num_cpus: Optional[int] = None,
                        dashboard_port: int = 8265,
                        try_connect_first: bool = True) -> bool:
    """
    为数据处理服务初始化 Ray
    
    Args:
        num_cpus: CPU 核心数
        dashboard_port: Dashboard 端口
        try_connect_first: 是否先尝试连接现有集群
        
    Returns:
        是否初始化成功
    """
    logger.info("为数据处理服务初始化 Ray...")
    ray_config.log_configuration()
    
    if try_connect_first:
        # 先尝试连接现有集群
        logger.info("尝试连接现有 Ray 集群...")
        if ray_config.connect_to_cluster("auto"):
            return True
        
        logger.info("未找到现有集群，启动本地集群...")
    
    # 启动本地集群
    return ray_config.start_local_cluster(
        num_cpus=num_cpus,
        dashboard_port=dashboard_port
    ) 