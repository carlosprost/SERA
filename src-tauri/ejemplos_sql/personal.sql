-- Ejemplo de Personal
CREATE TABLE IF NOT EXISTS "ejemplo_personal" (
    id_ejemplo_personal INTEGER PRIMARY KEY AUTOINCREMENT,
    legajo TEXT UNIQUE NOT NULL,
    nombre_completo TEXT NOT NULL,
    departamento TEXT,
    cargo TEXT,
    fecha_ingreso TEXT,
    salario_base REAL DEFAULT 0.0,
    bonificacion REAL DEFAULT 0.0,
    salario_total REAL DEFAULT 0.0
);

INSERT OR REPLACE INTO tablas (nombre_tabla, config) VALUES ('ejemplo_personal', '{
    "rules": [
        {
            "type": "simple",
            "field": "departamento",
            "operator": "equals",
            "value": "Dirección",
            "backgroundColor": "#e3f2fd",
            "textColor": "#1565c0",
            "applyTo": "row"
        }
    ],
    "calculatedFields": [
        {
            "targetField": "salario_total",
            "formula": "([salario_base] + [bonificacion])",
            "isActive": true
        }
    ],
    "allowAttachments": true
}');

INSERT INTO "ejemplo_personal" (legajo, nombre_completo, departamento, cargo, fecha_ingreso, salario_base, bonificacion, salario_total) VALUES 
('EMP-100', 'Ana María García', 'Dirección', 'Directora General', '2015-03-01', 5500.0, 1500.0, 7000.0),
('EMP-101', 'Carlos Ruiz', 'IT', 'Desarrollador Senior', '2018-06-15', 3200.0, 500.0, 3700.0),
('EMP-102', 'Lucía Fernández', 'RRHH', 'Especialista en Selección', '2020-01-10', 2100.0, 200.0, 2300.0),
('EMP-103', 'Miguel Torres', 'IT', 'Soporte Técnico', '2022-11-05', 1500.0, 100.0, 1600.0);
