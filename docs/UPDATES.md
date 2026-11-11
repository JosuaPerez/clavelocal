# Actualizaciones de escritorio

## Para el usuario

La versión 0.2 no contiene actualizador: ciérrala e instala la versión actual manualmente una vez, usando el mismo usuario de Windows. Exporta antes una copia cifrada y conserva tu clave maestra. El identificador de aplicación se mantiene, por lo que una actualización normal conserva los datos locales; no desinstales ni selecciones borrar datos.

Desde 0.3, el botón **Buscar actualizaciones** consulta el canal publicado. No consulta ni transmite la bóveda. Si hay una versión nueva, puedes leer sus notas en **Ver novedades**. Con la bóveda abierta puedes descargar una copia cifrada desde la misma ventana. Marca la confirmación de copia y pulsa **Instalar y reiniciar** para descargar y verificar el archivo antes de ejecutar el instalador. Si falla la comprobación o la instalación, usa **Volver a buscar**. Puedes seguir usando la app sin conexión.

Los commits y los PR de GitHub no son actualizaciones instalables. Solo se anuncia una versión después de compilarla, verificarla, firmarla y publicarla por el responsable.

## Controles

- Canal fijo HTTPS: `https://josuaperez.github.io/clavelocal/updates/windows.json`.
- Clave pública incorporada en el binario; la clave privada no está en el repositorio ni en workflows de PR.
- Plugin oficial de Tauri, con `requireSignedVersion: true` y sin downgrades. Rechaza bytes alterados y manifest que anuncie una versión distinta de la firmada.
- Solo se admiten descargas HTTPS del directorio de releases de este repositorio.
- El contenido web no puede proporcionar una URL o una clave alternativa al actualizador. Solo están expuestos los comandos de comprobar e instalar.
- La bóveda se bloquea antes de instalar; la firma se valida antes de ejecutar el archivo. La firma de actualización es distinta de Authenticode.

## Publicar

1. Revisar el commit y sus dependencias. Esperar los checks `app-tests`, `codeql` y `windows-installer` en el mismo commit de `main`.
2. En el equipo autorizado de firma, ejecutar `node scripts/prepare-update.mjs --version X.Y.Z --run ID --signing-key RUTA_PRIVADA`. La clave se lee desde un archivo, no desde argumentos con su contenido. Si está cifrada, proporcionar su contraseña mediante un mecanismo seguro en `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
3. El script comprueba procedencia del run y hashes, firma el instalador con la versión, lo verifica con Minisign y comprueba que se rechazan tanto un archivo alterado como una versión incorrecta. Genera `work/release-vX.Y.Z/` sin publicar nada.
4. Preparar un release de GitHub apuntando al commit exacto de `release-info.json`; adjuntar instalador, `.sig`, `SHA256SUMS.txt` y `windows.json`. Publicarlo solo después de revisar los resultados. Los instaladores de PR nunca se firman ni publican.
5. Solo después de que las descargas estén públicas, actualizar `web/updates/windows.json` con el manifest generado, publicar Pages y verificar su URL. No anunciar versiones que aún no se pueden descargar.

Las firmas se hacen localmente; no se ha guardado la clave privada en GitHub. Conservar una copia de recuperación de esa clave fuera del repositorio, en almacenamiento seguro. Perderla impide continuar el canal para las instalaciones existentes; exponerla permite falsificar actualizaciones. La copia local de trabajo no sustituye una custodia duradera del propietario.

En este equipo se conserva en `.private/updater.key`, excluida de Git y con permisos NTFS limitados al usuario propietario y SYSTEM. No compartirla en chats, issues, PR ni capturas. Hacer una copia cifrada externa antes de borrar o mover el proyecto. La clave pública es la incluida en `src-tauri/tauri.conf.json`.

## Firma de Windows

Sin certificado de editor no podemos eliminar el aviso de editor desconocido. Véase [WINDOWS_SIGNING.md](WINDOWS_SIGNING.md). Si se incorpora Authenticode, firmar primero el EXE con la identidad de Windows y después calcular los hashes y la firma de actualización.
