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
4. Comprueba manualmente crear, bloquear, abrir, exportar e importar una bóveda de prueba.
5. Abre un pull request explicando qué cambió, cómo se probó y si modifica el modelo de amenazas.

## Reglas para cambios de seguridad

- No sustituyas Web Crypto por criptografía implementada manualmente.
- No agregues scripts, fuentes o analítica de terceros.
- No debilites la política CSP con `unsafe-inline` o `unsafe-eval`.
- Toda migración del formato de bóveda debe conservar compatibilidad o proporcionar una ruta de recuperación comprobable.
- Los reportes de vulnerabilidades no deben publicarse como issues; sigue [SECURITY.md](SECURITY.md).

Al participar aceptas el [Código de conducta](CODE_OF_CONDUCT.md).
