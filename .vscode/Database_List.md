Pa List nalang din dito yung sainyo for future reference lang din:

-- EMPLOYEE ROLE
CREATE TABLE IF NOT EXISTS employee_role (
    role_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    inventory_permissions BOOLEAN NOT NULL,
    order_permissions BOOLEAN NOT NULL,
    reports_permissions BOOLEAN NOT NULL,
    sales_permissions BOOLEAN NOT NULL,
    settings_permissions BOOLEAN NOT NULL
);

-- EMPLOYEE
CREATE TABLE IF NOT EXISTS employee (
    employee_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id INT NOT NULL,
    employee_name VARCHAR(50) NOT NULL,
    employee_password VARCHAR(50) NOT NULL,
    employee_status VARCHAR(50) NOT NULL,
    employee_email VARCHAR(50) NOT NULL,
    employee_contact VARCHAR(50) NOT NULL,
    CONSTRAINT fk_employee_role
        FOREIGN KEY (role_id)
        REFERENCES employee_role(role_id)
);

-- CUSTOMER
CREATE TABLE IF NOT EXISTS customer (
    customer_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_name VARCHAR(50) NOT NULL,
    customer_address VARCHAR(50) NOT NULL,
    customer_contact VARCHAR(20) NOT NULL,
    customer_email VARCHAR(50) NOT NULL
);

-- SUPPLIER
CREATE TABLE IF NOT EXISTS supplier (
    supplier_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_name VARCHAR(50) NOT NULL,
    supplier_address VARCHAR(50) NOT NULL,
    supplier_contact VARCHAR(20) NOT NULL,
    supplier_email VARCHAR(50) NOT NULL,
    contact_person VARCHAR(50) NOT NULL
);

-- INVENTORY
CREATE TABLE inventory (
    inventory_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id INT NOT NULL,
    employee_id INT NOT NULL,
    inventory_item_name VARCHAR(50) NOT NULL,
    unit_of_measure VARCHAR(20),
    inventory_quantity INT NOT NULL,
    inventory_status VARCHAR(20),
    inventory_unit_price NUMERIC(10,2),
    inventory_selling_price NUMERIC(10,2),

    CONSTRAINT fk_inventory_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES supplier(supplier_id)

    CONSTRAINT fk_inventory_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id),
);