-- UPDATE códigos de barra — generado desde Excel 27/06/2026
-- Ejecutar en: habitus-sd-production

UPDATE articulos SET codigo_barra = '7798139077958' WHERE nombre = 'Barra Proteica - Chocolate Dubai - Ultra Tech' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798101202562' WHERE nombre = 'Barra Proteica - Iron Bar Cookies & Cream - Gentech' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798363501038' WHERE nombre = 'Citrato De Magnesio - 450 Grs - Neutro - One Fit' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798265481087' WHERE nombre = 'Citrato De Potasio - 60 Comprimidos - Innovanaturals' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '617395134274' WHERE nombre = 'Collagen - Frutos Rojos - 210 Gr - Star Nutrition' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798363501021' WHERE nombre = 'Creatina Micronizada - Neutra - 500 Gr - One Fit' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7792981071980' WHERE nombre = 'Creatina Micronizada - Sobre 15 G - Neutro - Ena' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '617395130894' WHERE nombre = 'Creatina Monohidrato - 300 G Dp - Frutos Rojos - Star Nutrition' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798456650049' WHERE nombre = 'Cupcake Keto - 210 Gr - Chocolate - Granger' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798456650032' WHERE nombre = 'Cupcake Keto - 210 Gr - Vainilla - Granger' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798139076012' WHERE nombre = 'Energy Gel - Frutilla - Ultra Tech' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798363500413' WHERE nombre = 'Fat Destroyer Con Cafeína - 90 Cápsulas - One Fit' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '769493501592' WHERE nombre = 'Hydration Drink - Tubo 12 Unidades - Orange - Gu Energy' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '614143227127' WHERE nombre = 'Hydromax Sport Drink Doypack - 1320 Gr - Rinde 40 Serv - Pomelo' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '781159856068' WHERE nombre = 'Hydromax Sport Drink Doypack - 600 Gr - Rinde 20 Serv - Naranja' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798363501335' WHERE nombre = 'Omega 3 - 30 Cápsulas - One Fit' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798415030028' WHERE nombre = 'Óxido Nítrico - Limón - 210 Gr - One Fit' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798456650353' WHERE nombre = 'Pancakes Proteicos - 450 Gr - Avellanas - Granger' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798363500246' WHERE nombre = 'Pre Workout - Limón - 300 Gr - One Fit' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798363500253' WHERE nombre = 'Pre Workout - Uva - 300 Gr - One Fit' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798415030738' WHERE nombre = 'Resveratrol - 60 Capsulas - One Fit' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '781159856150' WHERE nombre = 'Sobre Energy Gel Sin Cafeina - Sin Sabor - Nutremax' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798333090586' WHERE nombre = 'Sobre Gel Lima, Limón Y Menta - Pont' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798333090562' WHERE nombre = 'Sobre Gel Mango Y Maracuyá - Pont' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798333090579' WHERE nombre = 'Sobre Gel Moras, Frambuesa E Hibiscus - Pont' AND codigo_barra IS NULL;
UPDATE articulos SET codigo_barra = '7798101204023' WHERE nombre = 'Zma - 60 Cápsulas - Gentech' AND codigo_barra IS NULL;

-- Verificación: 26 artículos actualizados
SELECT nombre, codigo_barra FROM articulos WHERE nombre IN (
  'Barra Proteica - Chocolate Dubai - Ultra Tech',
  'Barra Proteica - Iron Bar Cookies & Cream - Gentech',
  'Citrato De Magnesio - 450 Grs - Neutro - One Fit',
  'Citrato De Potasio - 60 Comprimidos - Innovanaturals',
  'Collagen - Frutos Rojos - 210 Gr - Star Nutrition',
  'Creatina Micronizada - Neutra - 500 Gr - One Fit',
  'Creatina Micronizada - Sobre 15 G - Neutro - Ena',
  'Creatina Monohidrato - 300 G Dp - Frutos Rojos - Star Nutrition',
  'Cupcake Keto - 210 Gr - Chocolate - Granger',
  'Cupcake Keto - 210 Gr - Vainilla - Granger',
  'Energy Gel - Frutilla - Ultra Tech',
  'Fat Destroyer Con Cafeína - 90 Cápsulas - One Fit',
  'Hydration Drink - Tubo 12 Unidades - Orange - Gu Energy',
  'Hydromax Sport Drink Doypack - 1320 Gr - Rinde 40 Serv - Pomelo',
  'Hydromax Sport Drink Doypack - 600 Gr - Rinde 20 Serv - Naranja',
  'Omega 3 - 30 Cápsulas - One Fit',
  'Óxido Nítrico - Limón - 210 Gr - One Fit',
  'Pancakes Proteicos - 450 Gr - Avellanas - Granger',
  'Pre Workout - Limón - 300 Gr - One Fit',
  'Pre Workout - Uva - 300 Gr - One Fit',
  'Resveratrol - 60 Capsulas - One Fit',
  'Sobre Energy Gel Sin Cafeina - Sin Sabor - Nutremax',
  'Sobre Gel Lima, Limón Y Menta - Pont',
  'Sobre Gel Mango Y Maracuyá - Pont',
  'Sobre Gel Moras, Frambuesa E Hibiscus - Pont',
  'Zma - 60 Cápsulas - Gentech'
) ORDER BY nombre;