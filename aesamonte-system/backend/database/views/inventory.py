from database.db_config import get_connection

def get_inventory():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            inventory_id,
            inventory_item_name,
            unit_of_measure,
            item_quantity,
            item_unit_price,
            item_selling_price
        FROM inventory
        WHERE item_status = 'Available'
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return [
        {
            "id": str(r[0]),
            "item": r[1],           
            "uom": r[2],
            "qty": r[3],
            "unitPrice": float(r[4]),
            "price": float(r[5])
        }
        for r in rows
    ]
