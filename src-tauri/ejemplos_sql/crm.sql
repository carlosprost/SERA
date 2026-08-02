-- Ejemplo CRM: Tablas vinculadas (Clientes y Ventas)

-- 1. Tabla de Clientes
CREATE TABLE IF NOT EXISTS "ejemplo_clientes" (
    id_ejemplo_clientes INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT UNIQUE NOT NULL,
    razon_social TEXT NOT NULL,
    email TEXT,
    telefono TEXT,
    clasificacion TEXT
);

INSERT OR REPLACE INTO tablas (nombre_tabla, config) VALUES ('ejemplo_clientes', '{
    "rules": [
        {
            "type": "simple",
            "field": "clasificacion",
            "operator": "equals",
            "value": "VIP",
            "backgroundColor": "#fff3e0",
            "textColor": "#e65100",
            "applyTo": "row"
        }
    ]
}');

INSERT INTO "ejemplo_clientes" (rut, razon_social, email, telefono, clasificacion) VALUES 
('11222333-4', 'Acme Corp', 'contacto@acme.com', '+56911223344', 'VIP'),
('44555666-7', 'Globex Corporation', 'ventas@globex.com', '+56944556677', 'Regular'),
('77888999-0', 'Initech', 'info@initech.com', '+56977889900', 'Regular');

-- 2. Tabla de Ventas (Vinculada a Clientes)
CREATE TABLE IF NOT EXISTS "ejemplo_ventas" (
    id_ejemplo_ventas INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_factura TEXT UNIQUE NOT NULL,
    cliente_id INTEGER,
    fecha_venta TEXT,
    monto REAL,
    estado_pago TEXT
);

INSERT OR REPLACE INTO tablas (nombre_tabla, config) VALUES ('ejemplo_ventas', '{
    "rules": [
        {
            "type": "simple",
            "field": "estado_pago",
            "operator": "equals",
            "value": "Pendiente",
            "backgroundColor": "#ffebee",
            "textColor": "#c62828",
            "applyTo": "cell",
            "targetColumn": "estado_pago"
        }
    ],
    "linkedFields": [
        {
            "localField": "cliente_id",
            "remoteTable": "ejemplo_clientes",
            "remoteField": "id_ejemplo_clientes",
            "displayField": "razon_social"
        }
    ]
}');

INSERT INTO "ejemplo_ventas" (numero_factura, cliente_id, fecha_venta, monto, estado_pago) VALUES 
('F-00100', 1, '2024-07-28', 1500.50, 'Pagado'),
('F-00101', 1, '2024-07-29', 3200.00, 'Pendiente'),
('F-00102', 2, '2024-07-30', 850.00, 'Pagado'),
('F-00103', 3, '2024-07-31', 4500.00, 'Pendiente');
