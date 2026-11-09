# Contribuir a ClaveLocal

Gracias por ayudar a construir una herramienta de privacidad abierta y accesible.

## Antes de comenzar

- Revisa los issues abiertos para evitar trabajo duplicado.
- Para cambios grandes, abre primero un issue explicando el problema, el beneficio y los riesgos.
- Nunca incluyas contraseñas reales, exportaciones de bóvedas, tokens o datos personales en commits, capturas, logs o issues.

## Flujo recomendado

1. Crea un fork y una rama descriptiva.
2. Mantén cada cambio enfocado en un solo problema.
3. Ejecuta `npm test`.
   Ejecuta también `npm ci --ignore-scripts`, `npx playwright install chromium`, `npm run test:e2e` y `npm run build` para los cambios de aplicación.
4. Comprueba manualmente crear, bloquear, abrir, exportar e importar una bóveda de prueba.
5. Abre un pull request explicando qué cambió, cómo se probó y si modifica el modelo de amenazas.

## Reglas para cambios de seguridad

- No sustituyas Web Crypto por criptografía implementada manualmente.
- No agregues scripts, fuentes o analítica de terceros.
- No debilites la política CSP con `unsafe-inline` o `unsafe-eval`.
- Toda migración del formato de bóveda debe conservar compatibilidad o proporcionar una ruta de recuperación comprobable.
- Los reportes de vulnerabilidades no deben publicarse como issues; sigue [SECURITY.md](SECURITY.md).

Al participar aceptas el [Código de conducta](CODE_OF_CONDUCT.md).

## Revisión y publicación

- Un PR de un fork ejecuta código no confiable en máquinas efímeras de GitHub, con token de lectura y sin secretos de publicación. No se usa `pull_request_target` ni runners propios.
- Los workflows fijan las acciones a commits completos; las actualizaciones se revisan con Dependabot.
- `package-lock.json` y `src-tauri/Cargo.lock` fijan las dependencias; la compilación de escritorio rechaza cambios implícitos del lockfile.
- La ejecución de workflows de todos los colaboradores externos requiere aprobación del responsable antes de empezar. Aprobar su ejecución no equivale a aprobar ni fusionar el código.
- CodeQL y la revisión de dependencias complementan las pruebas. No sustituyen la revisión humana.
- CODEOWNERS asigna la revisión a @JosuaPerez. La protección de `main` exige checks y revisión para colaboradores; el administrador conserva el bypass para mantenimiento de un proyecto con un único responsable. No se fusionan PR automáticamente.
- Compilar un PR no publica una versión. Los instaladores se publican manualmente desde un commit de `main` verificado; nunca se reutilizan artefactos de forks para un release.
- Revisa especialmente cambios en workflows, scripts de instalación, permisos nativos, cifrado y dependencias transitivas. Ejecuta contribuciones sospechosas únicamente en un entorno desechable y sin credenciales ni bóvedas reales.

Consulta [el modelo de amenazas](docs/THREAT_MODEL.md) para las limitaciones del producto y de su distribución.
