# Historial de cambios

Todos los cambios importantes se documentarán aquí siguiendo un esquema inspirado en Keep a Changelog.

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
