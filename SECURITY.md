# Política de seguridad

## Estado

ClaveLocal es software experimental y aún no ha sido auditado de forma independiente. No se recomienda como único almacén de secretos críticos.

## Reportar una vulnerabilidad

No abras un issue público con detalles explotables ni adjuntes una bóveda real. Utiliza la opción **Report a vulnerability** de GitHub Security Advisories en este repositorio. Incluye:

- versión o commit afectado;
- pasos mínimos para reproducir;
- impacto esperado;
- propuesta de mitigación, si la tienes.

Se intentará confirmar el reporte en un plazo de 7 días. La corrección y divulgación se coordinarán con la persona que reportó el problema.

## Alcance prioritario

- pérdida o corrupción de bóvedas;
- acceso a entradas sin la clave maestra;
- debilidades en generación aleatoria, derivación de clave o cifrado;
- ejecución de contenido almacenado;
- filtración por red, logs o telemetría;
- importaciones manipuladas que provoquen ejecución o pérdida de datos.
- actualización desde un origen no autorizado, sin firma válida o con versión distinta de la firmada.

Nunca compartas una clave maestra ni una exportación con datos reales para demostrar un problema.

## Controles de contribuciones

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo de revisión y [el modelo de amenazas](docs/THREAT_MODEL.md) para los límites. Los cambios externos no se publican automáticamente: pasan por pruebas, análisis de código y revisión del responsable. Las alertas automáticas no sustituyen una auditoría independiente.
