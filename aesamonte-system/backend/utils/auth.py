from functools import wraps
from flask import request, jsonify
import jwt

SECRET_KEY = "your_super_secret_key"

# Roles allowed to interact with the Purchase Module.
# Must match role_name values stored in the employee_role table exactly.
PURCHASE_ALLOWED_ROLES: frozenset[str] = frozenset({
    "Super Admin",
    "Manager",
    "Inventory Head",
})

def require_purchase_access(f):
    """
    Decorator that restricts a route to roles in PURCHASE_ALLOWED_ROLES.
    Reads the JWT from the Authorization header, extracts role_name, and
    returns 403 immediately if the role is not permitted.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Missing Authorization header"}), 401
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            role_name = payload.get('role_name', '')
            if role_name not in PURCHASE_ALLOWED_ROLES:
                return jsonify({"error": "You do not have permission to access the Purchase Module."}), 403
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid authentication token."}), 401
        return f(*args, **kwargs)
    return decorated_function


def require_permission(permission_key):
    """
    Decorator to check if the user's token contains the required permission.
    Example usage: @require_permission('inventory')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({"error": "Missing Authorization header"}), 401
            
            try:
                token = auth_header.split(" ")[1]
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                
                # Check the specific granular permission!
                user_permissions = payload.get('permissions', {})
                if not user_permissions.get(permission_key):
                    # They don't have access! Block the request.
                    return jsonify({"error": f"Access Denied: Lacks {permission_key} permissions"}), 403
                    
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Session expired. Please log in again."}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Invalid authentication token."}), 401
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator