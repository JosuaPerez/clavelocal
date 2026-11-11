# Historial de cambios

Todos los cambios importantes se documentarán aquí siguiendo un esquema inspirado en Keep a Changelog.

## [Sin publicar]

- Recordatorio de copia cifrada tras 30 días sin solicitar una descarga de la bóveda actual.
- ADR de almacenamiento de escritorio con alternativas, propuesta de migración y plan de pruebas, pendiente de decisión del propietario.
- Cambio de clave maestra con salt nuevo, verificación de escritura y opciones para exportar la bóveda actual o eliminar explícitamente la copia local anterior.
- Comprobación de claves maestras al crear una bóveda y etiquetas cualitativas para las contraseñas de entradas.
- El servidor local avisa si su puerto está ocupado y falla antes de abrir el navegador; añade cabeceras COOP y CORP.
- Pruebas de consistencia entre los módulos de la app, el servidor y el empaquetado; escaneo ampliado a módulos transitivos.

## [0.4.0] - 2026-11-10

- Versión experimental con las mejoras integradas de seguridad, recuperación y bloqueo.
- Prueba nativa de copia, formatos de exclusión, conservación de otro texto y limpieza temporizada en el Windows aislado de CI, con datos ficticios.
- La limpieza nativa compara el número de secuencia confirmado tras cerrar la escritura del portapapeles; el valor anterior podía impedir limpiar la copia.

- Ajustes cifrados de bloqueo: inactividad de 1/5/15/30 minutos y bloqueo al ocultar inmediato o con 15/60 segundos de espera. Se mantienen los valores predeterminados de 5 minutos e inmediato.
- Las bóvedas sin ajustes se abren sin migración adicional. Las funciones publicadas de 0.3.2 aceptan y conservan el campo al guardar, pero ignoran sus opciones y aplican su bloqueo fijo (probado con funciones congeladas de esa versión, no con un instalador antiguo).

- Limpieza de portapapeles que no se cancela al bloquear; navegador con reintento al volver y aviso si no tiene permiso.
- Comando nativo de copia en Windows con exclusión de historial/sincronización, temporizador independiente de la UI, comparación bajo bloqueo del portapapeles e intento de limpieza al cerrar.

- Apertura sin volver a cifrar ni rotar la copia anterior cuando no se requiere migración. Una migración que no se puede guardar permite abrir con los parámetros originales y muestra un aviso.
- Recuperación de la copia anterior si falla la escritura principal; aviso explícito si también falla esa recuperación.

- Vectores fijos de compatibilidad del formato v1, con 310.000 y 600.000 iteraciones, rechazo de alteraciones y conservación del contenido al migrar.
- Backport verificable de la corrección original de GLib para GHSA-wrw7-89jp-8q8g, conservando compatibilidad con GTK/Tauri 2. Prueba Linux del iterador con optimizaciones y comprobación de procedencia de los archivos vendorizados.
- Un cierre tardío del diálogo CSV ya no vacía una importación reabierta; regresión reproducible añadida durante la validación.

## [0.3.2] - 2026-11-09

- Paginación de 10 entradas en Todas, Favoritas, categorías y resultados de búsqueda.
- Controles Anterior/Siguiente y contador de página al principio y al final de la lista.
- Búsqueda sobre toda la categoría seleccionada, reinicio a la primera página al filtrar y ajuste automático al eliminar la última entrada de una página.
- Acceso simplificado: demo discreta y centrada; recuperación y copia anterior trasladadas a Ayuda.
- Pruebas de navegación con 500 entradas ficticias y recuperación desde la pantalla bloqueada mediante Ayuda.

## [0.3.1] - 2026-11-09

- Creación de perfil local con usuario y clave maestra; bienvenida personalizada al volver a abrir la app.
- Edición del nombre desde Mi perfil y migración de bóvedas antiguas después de autenticarlas.
- Perfil canónico cifrado, cache visible limitado al nombre y conservación del perfil al importar CSV o restaurar copias.
- Pruebas de reapertura, cache alterado, contraseña incorrecta, renombrado y restauración del perfil.
- Diseño documentado para Windows Hello/passkeys como funcionalidad futura, sin habilitarla ni guardar la clave maestra.

## [0.3.0] - 2026-11-09

- Importación local de CSV de Chrome/Brave, con mapeo de columnas, resumen previo, detección de duplicados exactos y guardado cifrado sin reemplazar entradas.
- Separación visible entre importar CSV y restaurar copias JSON; herramientas accesibles en ventanas estrechas.
- Botón de actualización de escritorio con confirmación, firma del archivo vinculada a su versión y rechazo de versiones anteriores.
- Clave privada de actualización fuera del repositorio y de los workflows de PR; preparación manual desde artefactos verificados de main.
- Icono explícito del instalador e integración preparada para un certificado Authenticode válido, todavía no disponible.
- Pruebas de CSV, interfaz del actualizador y verificación de firmas con casos negativos.

## [0.2.0] - 2026-11-09

- Demo pública de lectura con datos ficticios y página de descarga.
- Empaquetado experimental para Windows con Tauri; sin Node.js para el usuario final.
- PBKDF2-SHA256 de 600.000 iteraciones y migración autenticada de bóvedas 0.1.
- Validación de importaciones antes del reemplazo, copia cifrada anterior y restauración desde la pantalla bloqueada.
- Guardado con control de concurrencia, detección de corrupción y gestión de fallos de almacenamiento.
- Limpieza de campos y listas al bloquear; bloqueo al ocultar el documento.
- Mensaje preciso sobre limitaciones del portapapeles y estimación de contraseñas.
- Pruebas de criptografía, persistencia y flujos de navegador.
- CODEOWNERS, plantillas de PR/feedback, Dependabot, CodeQL y revisión de dependencias.
- Modelo de amenazas y separación entre compilación, demo y publicación de releases.

## [0.1.0] - 2026-11-09

### Añadido

- Generador criptográficamente seguro con opciones de longitud y tipos de caracteres.
- Bóveda AES-256-GCM protegida por clave maestra.
- Organización por categorías, favoritos y búsqueda.
- Exportación e importación cifradas.
- Bloqueo automático y limpieza del portapapeles.
- Aplicación local sin cuentas, telemetría ni dependencias de producción.
