# Компоненты карты

Карта использует те же библиотеки D3 и TopoJSON, что и исходный сайт. Файлы сохранены локально, чтобы открытие карты не зависело от CDN.

- D3 **7.8.5**: https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js — ISC, полный текст в `vendor/d3-LICENSE`.
- TopoJSON **3.0.2**, объединённый browser bundle: https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js — ISC; уведомления компонентов сохранены в `vendor/topojson-client-LICENSE`, `vendor/topojson-server-LICENSE`, `vendor/topojson-simplify-LICENSE`.
- World Atlas **2.0.2**, `countries-110m.json`: https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json — ISC, `world-LICENSE`. Основа — Natural Earth, данные общественного достояния: https://www.naturalearthdata.com/about/terms-of-use/.

Границы на карте — схематические данные набора Natural Earth; они не используются для определения региона поездки. Группы поездок перенесены из исходного семейного архива.
