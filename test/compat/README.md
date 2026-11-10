# Compatibilidad con 0.3.2

`v0.3.2-functions.js` congela literalmente `validateVault` de `vault.mjs` y las
cinco funciones de guardado de `app.js` del commit publicado `da930d1203cead91a4569d8f6e6fca338eb81ec9`.
Solo se retiró `export` del validador para cargar las funciones en un contexto
aislado de pruebas de Node. No se usa este archivo en la aplicación ni se regenera
durante las pruebas. Se simulan los controles DOM y la persistencia; se ejecutan
las funciones originales, no copias reimplementadas de su lógica.

La prueba verifica apertura/validación y conservación de `settings` al crear o
editar entradas, marcar favoritos, borrar, importar CSV y cambiar perfil. No
equivale a ejecutar un instalador antiguo: 0.3.2 ignora la política nueva y aplica
su bloqueo fijo aunque conserve el campo al guardar.
