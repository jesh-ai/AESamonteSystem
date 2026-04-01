"""
Static permission definitions for the AE Samonte system.

These are the only actions that exist in the system.  The Admin can create as
many dynamic roles as they like, but every role's power is limited to some
subset of the values defined here.  Adding a new feature means adding a new
Permission constant – nothing else in the auth layer needs to change.

Usage (on a route):
    from utils.auth        import require_permission
    from utils.permissions import Permission

    @bp.route("/inventory", methods=["POST"])
    @require_permission(Permission.CREATE_INVENTORY)
    def create_item(): ...
"""

from enum import Enum


class Permission(str, Enum):
    """
    Canonical action keys stored in the JWT and in role_permissions.
    Inheriting from str means Permission.VIEW_SALES == "view_sales" is True,
    so values can be compared directly against strings fetched from the DB.
    """

    # ── Dashboard ────────────────────────────────────────────────────────────
    VIEW_DASHBOARD    = "view_dashboard"

    # ── Sales ─────────────────────────────────────────────────────────────────
    VIEW_SALES        = "view_sales"
    CREATE_SALE       = "create_sale"
    EDIT_SALE         = "edit_sale"
    ARCHIVE_SALE      = "archive_sale"
    EXPORT_SALES      = "export_sales"

    # ── Inventory ─────────────────────────────────────────────────────────────
    VIEW_INVENTORY    = "view_inventory"
    CREATE_INVENTORY  = "create_inventory"
    EDIT_INVENTORY    = "edit_inventory"
    ARCHIVE_INVENTORY = "archive_inventory"
    EXPORT_INVENTORY  = "export_inventory"

    # ── Orders ────────────────────────────────────────────────────────────────
    VIEW_ORDERS       = "view_orders"
    CREATE_ORDER      = "create_order"
    EDIT_ORDER        = "edit_order"
    ARCHIVE_ORDER     = "archive_order"
    EXPORT_ORDERS     = "export_orders"

    # ── Supplier ──────────────────────────────────────────────────────────────
    VIEW_SUPPLIER     = "view_supplier"
    CREATE_SUPPLIER   = "create_supplier"
    EDIT_SUPPLIER     = "edit_supplier"
    ARCHIVE_SUPPLIER  = "archive_supplier"
    EXPORT_SUPPLIER   = "export_supplier"

    # ── Reports ───────────────────────────────────────────────────────────────
    VIEW_REPORTS      = "view_reports"
    EXPORT_REPORTS    = "export_reports"

    # ── Settings ──────────────────────────────────────────────────────────────
    VIEW_SETTINGS     = "view_settings"
    EDIT_SETTINGS     = "edit_settings"


# ---------------------------------------------------------------------------
# Mapping from the role_permissions table columns to Permission values.
# Key: (module_name, column_name)   Value: Permission constant
#
# This is the single source of truth that translates the DB's boolean flags
# into the flat permission list stored in the JWT.
# ---------------------------------------------------------------------------
COLUMN_TO_PERMISSION: dict[tuple[str, str], Permission] = {
    ("dashboard", "can_view"):    Permission.VIEW_DASHBOARD,

    ("sales",     "can_view"):    Permission.VIEW_SALES,
    ("sales",     "can_create"):  Permission.CREATE_SALE,
    ("sales",     "can_edit"):    Permission.EDIT_SALE,
    ("sales",     "can_archive"): Permission.ARCHIVE_SALE,
    ("sales",     "can_export"):  Permission.EXPORT_SALES,

    ("inventory", "can_view"):    Permission.VIEW_INVENTORY,
    ("inventory", "can_create"):  Permission.CREATE_INVENTORY,
    ("inventory", "can_edit"):    Permission.EDIT_INVENTORY,
    ("inventory", "can_archive"): Permission.ARCHIVE_INVENTORY,
    ("inventory", "can_export"):  Permission.EXPORT_INVENTORY,

    ("orders",    "can_view"):    Permission.VIEW_ORDERS,
    ("orders",    "can_create"):  Permission.CREATE_ORDER,
    ("orders",    "can_edit"):    Permission.EDIT_ORDER,
    ("orders",    "can_archive"): Permission.ARCHIVE_ORDER,
    ("orders",    "can_export"):  Permission.EXPORT_ORDERS,

    ("supplier",  "can_view"):    Permission.VIEW_SUPPLIER,
    ("supplier",  "can_create"):  Permission.CREATE_SUPPLIER,
    ("supplier",  "can_edit"):    Permission.EDIT_SUPPLIER,
    ("supplier",  "can_archive"): Permission.ARCHIVE_SUPPLIER,
    ("supplier",  "can_export"):  Permission.EXPORT_SUPPLIER,

    ("reports",   "can_view"):    Permission.VIEW_REPORTS,
    ("reports",   "can_export"):  Permission.EXPORT_REPORTS,

    ("settings",  "can_view"):    Permission.VIEW_SETTINGS,
    ("settings",  "can_edit"):    Permission.EDIT_SETTINGS,
}


# Set of every valid permission value string — used for validation.
ALL_PERMISSIONS: frozenset[str] = frozenset(p.value for p in Permission)
