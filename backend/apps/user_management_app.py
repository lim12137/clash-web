import logging
from typing import Optional, Any, Tuple
from fastapi import APIRouter, HTTPException, Header, Request
from dotenv import load_dotenv
from supabase import create_client, Client
import requests
import os

# 从常量文件中导入所需常量
from consts.const import SUPABASE_URL, SUPABASE_KEY
from consts.model import STATUS_CODES, ServiceResponse, UserSignUpRequest, UserSignInRequest, UserUpdateRequest
from utils.auth_utils import get_jwt_expiry_seconds, calculate_expires_at

# 加载环境变量
load_dotenv()
# httpx 日志级别设置为 WARNING
logging.getLogger("httpx").setLevel(logging.WARNING)

# 创建路由
router = APIRouter(prefix="/user", tags=["user"])

# 创建基础 Supabase 客户端
def get_supabase_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# 设置token到客户端
def set_auth_token_to_client(client: Client, token: str) -> None:
    # 确保token是纯JWT，去除可能的Bearer前缀
    jwt_token = token.replace("Bearer ", "") if token.startswith("Bearer ") else token
    
    try:
        # 只设置access_token
        client.auth.access_token = jwt_token
    except Exception as e:
        logging.error(f"设置访问令牌失败: {str(e)}")


# 从授权头获取 token，并创建已认证的 Supabase 客户端
def get_authorized_client(authorization: Optional[str] = Header(None)) -> Client:
    client = get_supabase_client()
    if authorization:
        token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
        set_auth_token_to_client(client, token)
    return client


# 获取当前用户，返回用户对象或None
def get_current_user_from_client(client: Client) -> Optional[Any]:
    try:
        user_response = client.auth.get_user()
        if user_response and user_response.user:
            return user_response.user
        return None
    except Exception as e:
        logging.error(f"获取当前用户失败: {str(e)}")
        return None


# 统一验证令牌函数，返回(是否有效, 用户对象)
def validate_token(token: str) -> Tuple[bool, Optional[Any]]:
    client = get_supabase_client()
    set_auth_token_to_client(client, token)
    try:
        user = get_current_user_from_client(client)
        if user:
            return True, user
        return False, None
    except Exception as e:
        logging.error(f"令牌验证失败: {str(e)}")
        return False, None


# 工具函数 - 获取当前用户，作为依赖项
async def get_current_user(request: Request) -> Any:
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(status_code=401, detail="未提供授权令牌")

    is_valid, user = validate_token(authorization)
    if not is_valid or not user:
        raise HTTPException(status_code=401, detail="无效的用户会话")

    return user


# 尝试延长会话有效期，返回新的会话信息或None
def extend_session(client: Client, refresh_token: str) -> Optional[dict]:
    try:
        response = client.auth.refresh_session(refresh_token)
        if response and response.session:
            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_at": calculate_expires_at(response.session.access_token),
                "expires_in_seconds": get_jwt_expiry_seconds(response.session.access_token)
            }
        return None
    except Exception as e:
        logging.error(f"延长会话失败: {str(e)}")
        return None


# 连通性检查
@router.get("/service_health", response_model=ServiceResponse)
async def service_health():
    try:
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        response = requests.get(f'{SUPABASE_URL}/auth/v1/health', headers={
            'apikey': os.getenv("SUPABASE_KEY")
        })
        
        if not response.ok:
            return ServiceResponse(
                code=STATUS_CODES["AUTH_SERVICE_UNAVAILABLE"],
                message="认证服务不可用",
                data=False
            )
        
        data = response.json()
        # 通过检查响应中是否包含name字段并且值为"GoTrue"来确认服务可用
        is_available = data and data.get("name") == "GoTrue"
        
        return ServiceResponse(
            code=STATUS_CODES["SUCCESS"] if is_available else STATUS_CODES["AUTH_SERVICE_UNAVAILABLE"],
            message="认证服务正常" if is_available else "认证服务不可用",
            data=is_available
        )
        
    except Exception as e:
        logging.error(f"认证服务连通性检查失败: {str(e)}")
        return ServiceResponse(
            code=STATUS_CODES["SERVER_ERROR"],
            message=f"认证服务连通性检查失败: {str(e)}",
            data=False
        )

# 用户注册
@router.post("/signup", response_model=ServiceResponse)
async def signup(request: UserSignUpRequest):
    client = get_supabase_client()
    try:
        response = client.auth.sign_up({
            "email": request.email,
            "password": request.password
        })

        if response.user:
            logging.info(f"用户 {request.email} 注册成功")

            return ServiceResponse(
                code=STATUS_CODES["SUCCESS"],
                message="用户注册成功",
                data={
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email,
                    },
                    "session": {
                        "access_token": response.session.access_token if response.session else None,
                        "refresh_token": response.session.refresh_token if response.session else None,
                        "expires_at": calculate_expires_at() if response.session else None,
                        "expires_in_seconds": get_jwt_expiry_seconds(response.session.access_token) if response.session else 3600
                    } if response.session else None
                }
            )
        else:
            return ServiceResponse(
                code=STATUS_CODES["SERVER_ERROR"],
                message="用户注册失败，supabase_client.auth.sign_up无返回值",
                data=None
            )

    except Exception as e:
        logging.error(f"用户注册失败: {str(e)}")
        error_message = str(e).lower()

        if "user already registered" in error_message or "email already in use" in error_message:
            return ServiceResponse(
                code=STATUS_CODES["USER_EXISTS"],
                message="该邮箱已被注册",
                data=None
            )

        return ServiceResponse(
            code=STATUS_CODES["SERVER_ERROR"],
            message=f"用户注册失败: {str(e)}",
            data=None
        )


# 用户登录
@router.post("/signin", response_model=ServiceResponse)
async def signin(request: UserSignInRequest):
    client = get_supabase_client()
    try:
        response = client.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })

        # 从access_token中获取实际的过期时间
        expiry_seconds = get_jwt_expiry_seconds(response.session.access_token)
        expires_at = calculate_expires_at(response.session.access_token)

        logging.info(f"用户 {request.email} 登录成功，会话有效期为{expiry_seconds}秒")

        return ServiceResponse(
            code=STATUS_CODES["SUCCESS"],
            message=f"登录成功，会话有效期为{expiry_seconds}秒",
            data={
                "user": {
                    "id": response.user.id,
                    "email": response.user.email,
                    "role": response.user.role
                },
                "session": {
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token,
                    "expires_at": expires_at,
                    "expires_in_seconds": expiry_seconds
                }
            }
        )
    except Exception as e:
        logging.error(f"用户登录失败: {str(e)}")
        error_message = str(e).lower()

        if "invalid login credentials" in error_message:
            return ServiceResponse(
                code=STATUS_CODES["INVALID_CREDENTIALS"],
                message="邮箱或密码错误",
                data=None
            )

        return ServiceResponse(
            code=STATUS_CODES["SERVER_ERROR"],
            message=f"登录失败: {str(e)}",
            data=None
        )


# 刷新令牌
@router.post("/refresh_token", response_model=ServiceResponse)
async def refresh_token(request: Request):
    authorization = request.headers.get("Authorization")
    if not authorization:
        return ServiceResponse(
            code=STATUS_CODES["UNAUTHORIZED"],
            message="未提供授权令牌",
            data=None
        )

    client = get_authorized_client(authorization)
    try:
        session_data = await request.json()
        refresh_token = session_data.get("refresh_token")

        if not refresh_token:
            return ServiceResponse(
                code=STATUS_CODES["INVALID_INPUT"],
                message="未提供刷新令牌",
                data=None
            )

        session_info = extend_session(client, refresh_token)
        if not session_info:
            return ServiceResponse(
                code=STATUS_CODES["TOKEN_EXPIRED"],
                message="刷新令牌失败，可能令牌已过期",
                data=None
            )

        logging.info(f"令牌刷新成功：会话有效期为{session_info['expires_in_seconds']}秒")

        return ServiceResponse(
            code=STATUS_CODES["SUCCESS"],
            message="令牌刷新成功",
            data={"session": session_info}
        )
    except Exception as e:
        logging.error(f"刷新令牌失败: {str(e)}")
        error_message = str(e).lower()

        if "token is expired" in error_message or "invalid token" in error_message:
            return ServiceResponse(
                code=STATUS_CODES["TOKEN_EXPIRED"],
                message="刷新令牌已过期，请重新登录",
                data=None
            )

        return ServiceResponse(
            code=STATUS_CODES["SERVER_ERROR"],
            message=f"刷新令牌失败: {str(e)}",
            data=None
        )


# 用户登出
@router.post("/logout", response_model=ServiceResponse)
async def logout(request: Request):
    authorization = request.headers.get("Authorization")
    if not authorization:
        return ServiceResponse(
            code=STATUS_CODES["SUCCESS"],
            message="用户未登录",
            data=None
        )

    client = get_authorized_client(authorization)
    try:
        client.auth.sign_out()
        return ServiceResponse(
            code=STATUS_CODES["SUCCESS"],
            message="登出成功",
            data=None
        )
    except Exception as e:
        logging.error(f"用户登出失败: {str(e)}")
        return ServiceResponse(
            code=STATUS_CODES["SERVER_ERROR"],
            message=f"登出失败: {str(e)}",
            data=None
        )


# 获取当前用户会话
@router.get("/session", response_model=ServiceResponse)
async def get_session(request: Request):
    authorization = request.headers.get("Authorization")
    if not authorization:
        return ServiceResponse(
            code=STATUS_CODES["UNAUTHORIZED"],
            message="未提供授权令牌",
            data=None
        )

    # 使用统一的令牌验证函数
    is_valid, user = validate_token(authorization)

    if is_valid and user:
        return ServiceResponse(
            code=STATUS_CODES["SUCCESS"],
            message="会话有效",
            data={
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role
                }
            }
        )
    else:
        return ServiceResponse(
            code=STATUS_CODES["TOKEN_EXPIRED"],
            message="会话无效",
            data=None
        )


# 获取当前用户ID，若未登录则返回None
@router.get("/current_user_id", response_model=ServiceResponse)
async def get_user_id(request: Request):
    authorization = request.headers.get("Authorization")
    if not authorization:
        return ServiceResponse(
            code=STATUS_CODES["SUCCESS"],
            message="未提供授权令牌",
            data={"user_id": None}
        )

    # 使用统一的令牌验证函数
    is_valid, user = validate_token(authorization)

    if is_valid and user:
        return ServiceResponse(
            code=STATUS_CODES["SUCCESS"],
            message="获取用户ID成功",
            data={"user_id": user.id}
        )

    # 令牌无效时，尝试备用方法从令牌解析
    try:
        from utils.auth_utils import get_current_user_id_from_token
        user_id = get_current_user_id_from_token(authorization)
        if user_id:
            logging.info(f"从令牌解析用户ID成功: {user_id}")
            return ServiceResponse(
                code=STATUS_CODES["SUCCESS"],
                message="从令牌解析用户ID成功",
                data={"user_id": user_id}
            )
    except Exception as token_error:
        logging.warning(f"从令牌解析用户ID失败: {str(token_error)}")

    # 如果所有方法都失败，返回会话无效的信息
    return ServiceResponse(
        code=STATUS_CODES["SUCCESS"],  # 保持与原脚本一致的状态码
        message="用户未登录或会话无效",
        data={"user_id": None}
    )