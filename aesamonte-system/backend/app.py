from flask import Flask
from flask_cors import CORS
from routes.auth import auth_bp
from routes.inventory import inventory_bp
from routes.orders import orders_bp
from routes.sales import sales_bp
from routes.supplier import supplier_bp
from routes.audit_log import audit_log_bp
from routes.users import users_bp
from routes.reports import reports_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(inventory_bp)
app.register_blueprint(orders_bp)
app.register_blueprint(sales_bp)
app.register_blueprint(supplier_bp)
app.register_blueprint(audit_log_bp)
app.register_blueprint(users_bp, url_prefix="/api")
app.register_blueprint(reports_bp)


if __name__ == "__main__":
    app.run(debug=True)
