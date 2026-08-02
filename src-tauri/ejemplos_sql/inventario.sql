-- Ejemplo de Inventario
CREATE TABLE IF NOT EXISTS "ejemplo_inventario" (
    id_ejemplo_inventario INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    producto TEXT NOT NULL,
    categoria TEXT,
    stock INTEGER DEFAULT 0,
    precio_unitario REAL DEFAULT 0.0,
    total_valor REAL DEFAULT 0.0,
    estado TEXT
);

INSERT OR REPLACE INTO tablas (nombre_tabla, config) VALUES ('ejemplo_inventario', '{
    "rules": [
        {
            "type": "simple",
            "field": "stock",
            "operator": "lt",
            "value": "10",
            "backgroundColor": "#ffebee",
            "textColor": "#c62828",
            "applyTo": "row"
        },
        {
            "type": "simple",
            "field": "stock",
            "operator": "gt",
            "value": "49",
            "backgroundColor": "#e8f5e9",
            "textColor": "#2e7d32",
            "applyTo": "cell",
            "targetColumn": "estado"
        }
    ],
    "calculatedFields": [
        {
            "targetField": "total_valor",
            "formula": "([stock] * [precio_unitario])",
            "isActive": true
        },
        {
            "targetField": "estado",
            "formula": "SI([stock] < 10; \"CRÍTICO\"; SI([stock] >= 50; \"ÓPTIMO\"; \"NORMAL\"))",
            "isActive": true
        }
    ],
    "allowAttachments": true
}');

INSERT INTO "ejemplo_inventario" (codigo, producto, categoria, stock, precio_unitario, total_valor, estado) VALUES 
('EQ-001', 'Laptop Dell XPS 15', 'Electrónica', 5, 1200.50, 6002.50, 'CRÍTICO'),
('EQ-002', 'Monitor Samsung 27"', 'Periféricos', 15, 250.00, 3750.00, 'NORMAL'),
('EQ-003', 'Teclado Mecánico Keychron', 'Periféricos', 55, 85.00, 4675.00, 'ÓPTIMO'),
('MO-001', 'Silla Ergonómica Herman Miller', 'Mobiliario', 2, 850.00, 1700.00, 'CRÍTICO'),
('MO-002', 'Escritorio Elevable en L', 'Mobiliario', 20, 450.00, 9000.00, 'NORMAL');
