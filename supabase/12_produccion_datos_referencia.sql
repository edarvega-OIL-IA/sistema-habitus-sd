-- ============================================================================
-- HABITUS SD — Archivo 12: DATOS DE REFERENCIA EN PRODUCCIÓN
-- ============================================================================
-- Ejecutar en: habitus-sd-production (Supabase SQL Editor)
-- Script idempotente — se puede re-ejecutar desde cero
-- Fuente de verdad: sandbox habitus-sd-sandbox al 27/06/2026
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. LIMPIEZA (orden inverso a dependencias FK)
-- ---------------------------------------------------------------------------
DELETE FROM conceptos_gasto;
DELETE FROM categorias_gasto;
DELETE FROM depositos;
DELETE FROM proveedores;
DELETE FROM transportistas;
DELETE FROM emisores_pago;
DELETE FROM rubros;
DELETE FROM marcas;
DELETE FROM unidades_medida;
DELETE FROM tasas_iva;
DELETE FROM medios_pago;

-- ---------------------------------------------------------------------------
-- 1. MEDIOS DE PAGO
-- ---------------------------------------------------------------------------
INSERT INTO medios_pago (id, nombre, fiscaliza_por_defecto, activo) VALUES
  (1, 'Efectivo',      false, true),
  (2, 'Débito',        true,  true),
  (3, 'Crédito',       true,  true),
  (4, 'Transferencia', false, true);

-- ---------------------------------------------------------------------------
-- 2. TASAS IVA
-- ---------------------------------------------------------------------------
INSERT INTO tasas_iva (id, nombre, porcentaje, activo) VALUES
  (4, '21%',   21.00, true),
  (5, '10.5%', 10.50, true),
  (6, '0%',     0.00, true);
SELECT setval('tasas_iva_id_seq', 6);

-- ---------------------------------------------------------------------------
-- 3. UNIDADES DE MEDIDA
-- ---------------------------------------------------------------------------
INSERT INTO unidades_medida (id, nombre, abreviatura) VALUES
  (4, 'Unidad', 'u'),
  (5, 'Pack',   'pk'),
  (6, 'Caja',   'cj');
SELECT setval('unidades_medida_id_seq', 6);

-- ---------------------------------------------------------------------------
-- 4. RUBROS
-- ---------------------------------------------------------------------------
INSERT INTO rubros (id, nombre, activo) VALUES
  (1,  'Proteínas',           true),
  (2,  'Creatinas',           true),
  (3,  'Barras de proteína',  true),
  (4,  'Colágenos',           true),
  (5,  'Pre-entrenamiento',   true),
  (6,  'Aminoácidos',         true),
  (7,  'Quemadores',          true),
  (8,  'Salud y bienestar',   true),
  (9,  'Geles',               true),
  (10, 'Bebidas Isotónicas',  true),
  (11, 'Glutamina',           true),
  (12, 'Multivitamínicos',    true),
  (13, 'Óxido Nítrico',       true),
  (14, 'Pro Hormonal',        true),
  (15, 'Energía',             true),
  (16, 'Ganadores de peso',   true),
  (17, 'Sales',               true),
  (18, 'Foods',               true),
  (19, 'Proteínas Vegetales', true),
  (22, 'Geles Cafeina',       true),
  (23, 'Shakers',             true);
SELECT setval('rubros_id_seq', 23);

-- ---------------------------------------------------------------------------
-- 5. MARCAS
-- ---------------------------------------------------------------------------
INSERT INTO marcas (id, nombre, activo) VALUES
  (1,  'ENA',                true),
  (2,  'Star Nutrition',     true),
  (3,  'Gold Nutrition',     true),
  (4,  'Nutremax',           true),
  (5,  'Gentech',            true),
  (6,  'One Fit',            true),
  (7,  'Innovanaturals',     true),
  (8,  'Vita Tech',          true),
  (9,  'Body Advance',       true),
  (10, 'Ultra Tech',         true),
  (11, 'Xtrenght',           true),
  (12, 'Pulver',             true),
  (13, 'Mervick',            true),
  (14, 'GU Energy',          true),
  (15, 'Neix Reloaded',      true),
  (16, 'Optimum Nutrition',  true),
  (18, 'Universal Nutrition',true),
  (20, 'BSN',                false),
  (21, 'Age Biologique',     false),
  (22, 'Bad Monkey',         false),
  (23, 'Everlast',           true),
  (24, 'Flip',               true),
  (25, 'Generation Fit',     false),
  (26, 'Geonat',             false),
  (27, 'Granger',            true),
  (28, 'Hoch Sport',         true),
  (29, 'HTN',                false),
  (30, 'King',               false),
  (31, 'Laddubar',           false),
  (32, 'Mrs Taste',          true),
  (33, 'Muecas',             false),
  (34, 'New Protein',        false),
  (35, 'NF Nutrition',       false),
  (36, 'Not Co',             false),
  (37, 'Nutrex',             false),
  (38, 'Nutrilab',           false),
  (39, 'Núcleo Fit',         false),
  (40, 'Pont',               true),
  (41, 'Victory Endurance',  false);
SELECT setval('marcas_id_seq', 41);

-- ---------------------------------------------------------------------------
-- 6. EMISORES DE PAGO
-- ---------------------------------------------------------------------------
INSERT INTO emisores_pago (id, nombre, fiscaliza, activo) VALUES
  (1, 'Visa',             true,  true),
  (2, 'Mastercard',       true,  true),
  (3, 'Naranja',          true,  true),
  (4, 'Naranja X',        true,  true),
  (5, 'Cabal',            true,  true),
  (6, 'American Express', true,  true),
  (7, 'Mercado Pago',     true,  true),
  (8, 'Patagonia',        false, true),
  (9, 'OpenPay',          true,  true);
SELECT setval('emisores_pago_id_seq', 9);

-- ---------------------------------------------------------------------------
-- 7. PROVEEDORES
-- ---------------------------------------------------------------------------
INSERT INTO proveedores (id, nombre_comercial, activo) VALUES
  (1, 'Black Suplementos', true),
  (2, 'Disfit',            true),
  (3, 'EPN',               true),
  (4, 'Vitatech',          true);
SELECT setval('proveedores_id_seq', 4);

-- ---------------------------------------------------------------------------
-- 8. TRANSPORTISTAS
-- ---------------------------------------------------------------------------
INSERT INTO transportistas (id, nombre, activo) VALUES
  (1, 'Andreani',         true),
  (2, 'Correo Argentino', true),
  (3, 'VIA CARGO',        true);
SELECT setval('transportistas_id_seq', 3);

-- ---------------------------------------------------------------------------
-- 9. DEPÓSITOS
-- ---------------------------------------------------------------------------
INSERT INTO depositos (id, sucursal_id, nombre, activo) VALUES
  (1, 1, 'Principal', true);
SELECT setval('depositos_id_seq', 1);

-- ---------------------------------------------------------------------------
-- 10. CATEGORÍAS DE GASTO
-- (producción no tiene columna tipo)
-- ---------------------------------------------------------------------------
INSERT INTO categorias_gasto (id, nombre) VALUES
  (1,  'Compras Mercadería'),
  (2,  'Empleados'),
  (3,  'Impuestos'),
  (4,  'Local Comercial'),
  (5,  'Marketing'),
  (6,  'Página Web'),
  (7,  'Servicios'),
  (8,  'Sistema'),
  (9,  'Team Habitus'),
  (10, 'Ventas'),
  (11, 'Otros Ingresos'),
  (13, 'Caja');
SELECT setval('categorias_gasto_id_seq', 13);

-- ---------------------------------------------------------------------------
-- 11. CONCEPTOS DE GASTO
-- (desde sandbox al 27/06/2026 — producción no tiene columna tipo)
-- ---------------------------------------------------------------------------
INSERT INTO conceptos_gasto (id, categoria_gasto_id, nombre) VALUES
  (33, 1,  'Compra mercadería'),
  (44, 1,  'Flete compra'),
  (5,  2,  'Sueldo'),
  (11, 2,  'Adelanto sueldo'),
  (12, 2,  'F931'),
  (13, 2,  'OSECAC'),
  (14, 2,  'FAECYS'),
  (15, 2,  'INACAP'),
  (16, 2,  'Sindicato'),
  (17, 2,  'Limpieza'),
  (18, 3,  'Ingresos Brutos'),
  (19, 3,  'Municipalidad'),
  (20, 3,  'AFIP Monotributo'),
  (1,  4,  'Alquiler'),
  (21, 4,  'Mantenimiento'),
  (22, 5,  'Publicidad Instagram'),
  (23, 5,  'Diseño'),
  (24, 6,  'Empretienda'),
  (25, 6,  'GoDaddy'),
  (26, 6,  'Canva'),
  (4,  7,  'Agua'),
  (27, 7,  'Luz EDERSA'),
  (28, 7,  'Gas Camuzzi'),
  (29, 7,  'Internet'),
  (30, 7,  'Claro celular'),
  (31, 8,  'Coverweb'),
  (32, 8,  'Otro sistema'),
  (34, 9,  'Sponsoreo suplementos'),
  (35, 10, 'Venta local'),
  (41, 13, 'Retiro'),
  (43, 13, 'Ingreso');
SELECT setval('conceptos_gasto_id_seq', 44);

-- ---------------------------------------------------------------------------
-- 12. VERIFICACIÓN FINAL
-- ---------------------------------------------------------------------------
SELECT 'medios_pago'       AS tabla, COUNT(*) AS filas FROM medios_pago
UNION ALL SELECT 'tasas_iva',         COUNT(*) FROM tasas_iva
UNION ALL SELECT 'unidades_medida',   COUNT(*) FROM unidades_medida
UNION ALL SELECT 'rubros',            COUNT(*) FROM rubros
UNION ALL SELECT 'marcas',            COUNT(*) FROM marcas
UNION ALL SELECT 'emisores_pago',     COUNT(*) FROM emisores_pago
UNION ALL SELECT 'proveedores',       COUNT(*) FROM proveedores
UNION ALL SELECT 'transportistas',    COUNT(*) FROM transportistas
UNION ALL SELECT 'depositos',         COUNT(*) FROM depositos
UNION ALL SELECT 'categorias_gasto',  COUNT(*) FROM categorias_gasto
UNION ALL SELECT 'conceptos_gasto',   COUNT(*) FROM conceptos_gasto;
