# Publicar una versión

1. Elegir un commit revisado de `main`; nunca un artefacto de un PR o fork.
2. Confirmar pruebas, CodeQL y compilación Windows satisfactorias para ese mismo commit. Revisar alertas de dependencias, no solo el color de los checks.
3. Preparar el artefacto del run correspondiente siguiendo [UPDATES.md](UPDATES.md). Comprobar hash, firma, versión y pruebas negativas. Si se dispone de Authenticode, aplicarlo antes de la firma del actualizador y volver a generar los hashes.
4. Crear el tag de versión apuntando al commit exacto y preparar las notas con cambios, migración y limitaciones. Esta versión se publica como prerelease experimental.
5. Adjuntar el instalador, firma, manifest y hashes. Antes de publicar comprobar que no hay secretos, datos de usuario ni artefactos de desarrollo.
6. Verificar el enlace público y la descarga; solo entonces publicar el manifest del canal. Mantener el origen de cada binario trazable a su run.

No hay publicación automática desde PR ni firma privada en los workflows. La firma Authenticode es pendiente; no afirmar que existe ni recomendar desactivar SmartScreen. Un hash no certifica por sí solo la identidad del editor.
