-- ============================================================================
-- HABITUS SD — Esquema SQL — Archivo 01b: GEOGRAFÍA ARGENTINA (complemento)
-- ============================================================================
-- Ejecutar DESPUÉS de 01_referencia.sql (usa las tablas paises/provincias/localidades
-- ya creadas en ese archivo). No vuelve a crear tablas, solo inserta datos.
-- Alcance: Argentina > Río Negro y Neuquén > localidades del Alto Valle / zona de
-- influencia de Cinco Saltos (confirmado con mapa de referencia, sesión 02).
-- ============================================================================

-- País
INSERT INTO paises (nombre, codigo_iso) VALUES
    ('Argentina', 'AR');

-- Provincias
INSERT INTO provincias (pais_id, nombre) VALUES
    ((SELECT id FROM paises WHERE nombre = 'Argentina'), 'Río Negro'),
    ((SELECT id FROM paises WHERE nombre = 'Argentina'), 'Neuquén');

-- Localidades — Río Negro (margen este/sur del Alto Valle, según el mapa)
INSERT INTO localidades (provincia_id, nombre) VALUES
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'Cinco Saltos'),
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'Cipolletti'),
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'General Fernández Oro'),
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'Allen'),
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'Catriel'),
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'Contralmirante Cordero'),
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'Barda del Medio');

-- Localidades — Neuquén (margen oeste/norte del Alto Valle, según el mapa)
INSERT INTO localidades (provincia_id, nombre) VALUES
    ((SELECT id FROM provincias WHERE nombre = 'Neuquén'), 'Neuquén Capital'),
    ((SELECT id FROM provincias WHERE nombre = 'Neuquén'), 'Plottier'),
    ((SELECT id FROM provincias WHERE nombre = 'Neuquén'), 'Centenario'),
    ((SELECT id FROM provincias WHERE nombre = 'Neuquén'), 'Vista Alegre'),
    ((SELECT id FROM provincias WHERE nombre = 'Neuquén'), 'Villa Manzano'),
    ((SELECT id FROM provincias WHERE nombre = 'Neuquén'), 'Senillosa');

-- ============================================================================
-- Vincular la sucursal Cinco Saltos (creada en 01_referencia.sql) con su localidad
-- ============================================================================

UPDATE sucursales
SET localidad_id = (SELECT id FROM localidades WHERE nombre = 'Cinco Saltos')
WHERE nombre = 'Cinco Saltos';

-- ============================================================================
-- FIN DEL ARCHIVO 01b
-- Siguiente paso: ejecutar 02_catalogo_stock.sql
-- ============================================================================
