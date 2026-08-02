-- Ejemplo de Proyectos
CREATE TABLE IF NOT EXISTS "ejemplo_proyectos" (
    id_ejemplo_proyectos INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_proyecto TEXT UNIQUE NOT NULL,
    nombre_proyecto TEXT NOT NULL,
    responsable TEXT,
    presupuesto REAL DEFAULT 0.0,
    fecha_inicio TEXT,
    fecha_fin TEXT,
    dias_restantes INTEGER,
    estado TEXT
);

INSERT OR REPLACE INTO tablas (nombre_tabla, config) VALUES ('ejemplo_proyectos', '{
    "rules": [
        {
            "type": "simple",
            "field": "estado",
            "operator": "equals",
            "value": "En Curso",
            "backgroundColor": "#fff8e1",
            "textColor": "#f57f17",
            "applyTo": "cell",
            "targetColumn": "estado"
        },
        {
            "type": "simple",
            "field": "estado",
            "operator": "equals",
            "value": "Completado",
            "backgroundColor": "#e8f5e9",
            "textColor": "#2e7d32",
            "applyTo": "cell",
            "targetColumn": "estado"
        },
        {
            "type": "simple",
            "field": "estado",
            "operator": "equals",
            "value": "Atrasado",
            "backgroundColor": "#ffebee",
            "textColor": "#c62828",
            "applyTo": "row"
        }
    ],
    "allowAttachments": true
}');

INSERT INTO "ejemplo_proyectos" (codigo_proyecto, nombre_proyecto, responsable, presupuesto, fecha_inicio, fecha_fin, dias_restantes, estado) VALUES 
('PRJ-2024-A', 'Migración Cloud', 'Carlos Ruiz', 15000.0, '2024-01-10', '2024-06-30', 0, 'Completado'),
('PRJ-2024-B', 'Nueva App Móvil', 'Ana María García', 35000.0, '2024-05-01', '2024-12-15', 120, 'En Curso'),
('PRJ-2024-C', 'Campaña Marketing Q3', 'Lucía Fernández', 8000.0, '2024-07-01', '2024-09-30', -5, 'Atrasado');
