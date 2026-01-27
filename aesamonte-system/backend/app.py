from flask import Flask, jsonify
from flask_cors import CORS
from database.views.inventory import get_inventory

app = Flask(__name__)
CORS(app)  # IMPORTANT for frontend access

@app.route("/api/inventory", methods=["GET"])
def inventory():
    return jsonify(get_inventory())

if __name__ == "__main__":
    app.run(debug=True)