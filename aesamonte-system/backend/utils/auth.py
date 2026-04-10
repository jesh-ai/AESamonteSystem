"""
Authentication and authorisation helpers.

Two decorators are provided:

    @require_permission(Permission.CREATE_INVENTORY)
        Checks that the caller's JWT contains the specific permission.
        System roles (SUPER_ADMIN, ADMIN) bypass this check entirely.

    @require_role(Roles.ADMIN)                   ← use sparingly
        Hard-gates a route to one or more named roles.
        Prefer require_permission for every ordinary business route;
        reserve require_role for the rare "only a system admin may do this"
        operations (e.g. deleting a role, resetting any password).
"""

from functools import wraps
import os
from flask import request, jsonify
import jwt

from utils.roles       import Roles, SYSTEM_ROLE_NAMES
from utils.permissions import Permission

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "aesamonte_rbac_secret_2025")


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _decode_token() -> dict:
    """
    Extract and verify the Bearer token from the current request.
    Returns the decoded payload dict.
    Raises jwt.InvalidTokenError / jwt.ExpiredSignatureError on failure.
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise jwt.InvalidTokenError("Missing or malformed Authorization header")
    token = auth_header.split(' ', 1)[1]
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


# ---------------------------------------------------------------------------
# Primary decorator — check a specific permission
# ---------------------------------------------------------------------------

def require_permission(permission: Permission):
    """
    Restrict a route to callers whose role grants the given permission.

    System roles (SUPER_ADMIN, ADMIN) bypass the check and always proceed.
    Every other role must have the permission explicitly granted in their
    role_permissions row.

    Usage:
        @bp.route("/inventory", methods=["POST"])
        @require_permission(Permission.CREATE_INVENTORY)
        def create_item(): ...
    """
    permission_value = permission.value if isinstance(permission, Permission) else permission

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                payload = _decode_token()

                # System roles have implicit god-mode — skip permission check.
                if payload.get('role_name') in SYSTEM_ROLE_NAMES:
                    return f(*args, **kwargs)

                # All other roles: check the flat permission list in the JWT.
                if permission_value not in payload.get('permissions', []):
                    return jsonify({
                        "error": f"Access Denied: Missing permission '{permission_value}'"
                    }), 403

            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Session expired. Please log in again."}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Invalid authentication token."}), 401

            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ---------------------------------------------------------------------------
# Secondary decorator — gate by role name (use sparingly)
# ---------------------------------------------------------------------------

def require_role(*allowed_roles: Roles):
    """
    Restrict a route to one or more specific named roles.

    Only use this for administrative operations that truly belong to a
    hardcoded role (e.g. the system admin management pages).  For every
    ordinary business action, use require_permission instead so that
    dynamic roles work correctly.

    Usage:
        @require_role(Roles.SUPER_ADMIN)
        @require_role(Roles.SUPER_ADMIN, Roles.ADMIN)
    """
    allowed_values = frozenset(
        r.value if isinstance(r, Roles) else r for r in allowed_roles
    )

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                payload = _decode_token()
                if payload.get('role_name') not in allowed_values:
                    return jsonify({"error": "Access Denied: Insufficient role"}), 403
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Session expired. Please log in again."}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Invalid authentication token."}), 401
            return f(*args, **kwargs)
        return decorated_function
    return decorator
