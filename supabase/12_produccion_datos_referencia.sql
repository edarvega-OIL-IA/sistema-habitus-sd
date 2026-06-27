-- ============================================================================
-- HABITUS SD — Archivo 12: DATOS DE REFERENCIA EN PRODUCCIÓN
-- ============================================================================
-- Ejecutar en: habitus-sd-production (Supabase SQL Editor)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. MEDIOS DE PAGO (ya ejecutado, incluido para referencia)
-- ---------------------------------------------------------------------------
DELETE FROM medios_pago;
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
  (6, '0%',     0.00, true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. UNIDADES DE MEDIDA
-- ---------------------------------------------------------------------------
INSERT INTO unidades_medida (id, nombre, abreviatura) VALUES
  (4, 'Unidad', 'u'),
  (5, 'Pack',   'pk'),
  (6, 'Caja',   'cj')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. RUBROS (21 operativos + 2 nuevos)
-- ---------------------------------------------------------------------------
INSERT INTO rubros (id, nombre, activo) VALUES
  (1,  'Proteínas',          true),
  (2,  'Creatinas',          true),
  (3,  'Barras de proteína', true),
  (4,  'Colágenos',          true),
  (5,  'Pre-entrenamiento',  true),
  (6,  'Aminoácidos',        true),
  (7,  'Quemadores',         true),
  (8,  'Salud y bienestar',  true),
  (9,  'Geles',              true),
  (10, 'Bebidas Isotónicas', true),
  (11, 'Glutamina',          true),
  (12, 'Multivitamínicos',   true),
  (13, 'Óxido Nítrico',      true),
  (14, 'Pro Hormonal',       true),
  (15, 'Energía',            true),
  (16, 'Ganadores de peso',  true),
  (17, 'Sales',              true),
  (18, 'Foods',              true),
  (19, 'Proteínas Vegetales',true),
  (22, 'Geles Cafeina',      true),
  (23, 'Shakers',            true)
ON CONFLICT (id) DO NOTHING;

-- Ajustar secuencia
SELECT setval('rubros_id_seq', 23);

-- ---------------------------------------------------------------------------
-- 5. MARCAS (38 marcas — sin Dymatize ni MuscleTech)
-- ---------------------------------------------------------------------------
INSERT INTO marcas (id, nombre, activo) VALUES
  (1,  'ENA',               true),
  (2,  'Star Nutrition',    true),
  (3,  'Gold Nutrition',    true),
  (4,  'Nutremax',          true),
  (5,  'Gentech',           true),
  (6,  'One Fit',           true),
  (7,  'Innovanaturals',    true),
  (8,  'Vita Tech',         true),
  (9,  'Body Advance',      true),
  (10, 'Ultra Tech',        true),
  (11, 'Xtrenght',          true),
  (12, 'Pulver',            true),
  (13, 'Mervick',           true),
  (14, 'GU Energy',         true),
  (15, 'Neix Reloaded',     true),
  (16, 'Optimum Nutrition', true),
  (18, 'Universal Nutrition',true),
  (20, 'BSN',               false),
  (21, 'Age Biologique',    false),
  (22, 'Bad Monkey',        false),
  (23, 'Everlast',          true),
  (24, 'Flip',              true),
  (25, 'Generation Fit',    false),
  (26, 'Geonat',            false),
  (27, 'Granger',           true),
  (28, 'Hoch Sport',        true),
  (29, 'HTN',               false),
  (30, 'King',              false),
  (31, 'Laddubar',          false),
  (32, 'Mrs Taste',         true),
  (33, 'Muecas',            false),
  (34, 'New Protein',       false),
  (35, 'NF Nutrition',      false),
  (36, 'Not Co',            false),
  (37, 'Nutrex',            false),
  (38, 'Nutrilab',          false),
  (39, 'Núcleo Fit',        false),
  (40, 'Pont',              true),
  (41, 'Victory Endurance', false)
ON CONFLICT (id) DO NOTHING;

-- Ajustar secuencia
SELECT setval('marcas_id_seq', 41);

-- ---------------------------------------------------------------------------
-- 6. EMISORES DE PAGO
-- ---------------------------------------------------------------------------
INSERT INTO emisores_pago (id, nombre, fiscaliza, activo) VALUES
  (1,  'Visa',            true,  true),
  (2,  'Mastercard',      true,  true),
  (3,  'Naranja',         true,  true),
  (4,  'Naranja X',       true,  true),
  (5,  'Cabal',           true,  true),
  (6,  'American Express',true,  true),
  (7,  'Mercado Pago',    true,  true),
  (8,  'Patagonia',       false, true),
  (9,  'OpenPay',         true,  true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. PROVEEDORES
-- ---------------------------------------------------------------------------
INSERT INTO proveedores (id, nombre_comercial, activo) VALUES
  (1, 'Black Suplementos', true),
  (2, 'Disfit',            true),
  (3, 'EPN',               true),
  (4, 'Vitatech',          true)
ON CONFLICT (id) DO NOTHING;

-- Ajustar secuencia
SELECT setval('proveedores_id_seq', 4);

-- ---------------------------------------------------------------------------
-- 8. TRANSPORTISTAS
-- ---------------------------------------------------------------------------
INSERT INTO transportistas (id, nombre, activo) VALUES
  (1, 'Andreani',         true),
  (2, 'Correo Argentino', true),
  (3, 'VIA CARGO',        true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. CATEGORÍAS Y CONCEPTOS DE GASTO
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
  (11, 'Otros Ingresos')
ON CONFLICT (id) DO NOTHING;

INSERT INTO conceptos_gasto (id, categoria_gasto_id, nombre) VALUES
  (1,  2,  'Sueldo'),
  (2,  2,  'Adelanto'),
  (3,  2,  'Cargas Sociales'),
  (4,  3,  'AFIP Monotributo'),
  (5,  3,  'Ingresos Brutos'),
  (6,  3,  'Municipalidad'),
  (7,  3,  'F931'),
  (8,  3,  'OSECAC'),
  (9,  3,  'FAECYS'),
  (10, 3,  'INACAP'),
  (11, 3,  'Sindicato'),
  (12, 4,  'Alquiler'),
  (13, 4,  'Mantenimiento'),
  (14, 5,  'Publicidad Instagram'),
  (15, 5,  'Diseño'),
  (16, 6,  'Empretienda'),
  (17, 6,  'GoDaddy'),
  (18, 6,  'Canva'),
  (19, 7,  'Luz EDERSA'),
  (20, 7,  'Gas Camuzzi'),
  (21, 7,  'Agua'),
  (22, 7,  'Internet'),
  (23, 7,  'Claro Celular'),
  (24, 7,  'Limpieza'),
  (25, 8,  'Coverweb'),
  (26, 8,  'Otros Sistema'),
  (27, 9,  'Sponsoreo Team Habitus'),
  (28, 10, 'Venta Local'),
  (29, 10, 'Venta Web'),
  (30, 11, 'Otro Ingreso'),
  (31, 1,  'Compra mercadería'),
  (44, 1,  'Flete compra')
ON CONFLICT (id) DO NOTHING;

-- Ajustar secuencias
SELECT setval('categorias_gasto_id_seq', 11);
SELECT setval('conceptos_gasto_id_seq', 44);

-- ---------------------------------------------------------------------------
-- 10. DEPOSITOS
-- ---------------------------------------------------------------------------
INSERT INTO depositos (id, sucursal_id, nombre, activo) VALUES
  (1, 1, 'Principal', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. VERIFICACIÓN FINAL
-- ---------------------------------------------------------------------------
SELECT 'medios_pago'      as tabla, COUNT(*) FROM medios_pago
UNION ALL SELECT 'tasas_iva',        COUNT(*) FROM tasas_iva
UNION ALL SELECT 'unidades_medida',  COUNT(*) FROM unidades_medida
UNION ALL SELECT 'rubros',           COUNT(*) FROM rubros
UNION ALL SELECT 'marcas',           COUNT(*) FROM marcas
UNION ALL SELECT 'emisores_pago',    COUNT(*) FROM emisores_pago
UNION ALL SELECT 'proveedores',      COUNT(*) FROM proveedores
UNION ALL SELECT 'transportistas',   COUNT(*) FROM transportistas
UNION ALL SELECT 'categorias_gasto', COUNT(*) FROM categorias_gasto
UNION ALL SELECT 'conceptos_gasto',  COUNT(*) FROM conceptos_gasto
UNION ALL SELECT 'depositos',        COUNT(*) FROM depositos;
