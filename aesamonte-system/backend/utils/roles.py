from enum import Enum


class Roles(str, Enum):
    """
    Canonical role names as stored in employee_role.role_name.
    Inheriting from str means Roles.ADMIN == "Admin" is True, so
    enum members can be compared directly against strings from the DB.

    Keep this list in sync with your employee_role table.
    Only SUPER_ADMIN and ADMIN are truly "hardcoded" — all other roles are
    dynamic and should NOT be checked by name in application logic.
    """
    SUPER_ADMIN = "Super Admin"
    ADMIN       = "Admin"
    MANAGER     = "Manager"


# ---------------------------------------------------------------------------
# System roles bypass ALL permission checks (they have implicit god-mode).
# These role names also cannot be deleted through the API.
# ---------------------------------------------------------------------------
SYSTEM_ROLE_NAMES: frozenset[str] = frozenset({
    Roles.SUPER_ADMIN.value,
    Roles.ADMIN.value,
})

# Role assigned to an employee when they are removed from their current role.
# Must match an existing employee_role.role_name value in the database.
DEFAULT_ROLE_NAME: str = "Staff"
