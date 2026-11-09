# Firma de Windows y confianza del instalador

El icono no elimina advertencias de Windows. El instalador incorpora el mismo icono de ClaveLocal que la aplicación y los accesos directos. No se empaquetan ejecutables con ofuscadores ni se desactiva el antivirus.

## Estado

No se dispone todavía de certificado de editor o identidad de Microsoft Artifact Signing. Por tanto, los instaladores siguen sin Authenticode. No se garantiza la ausencia de alertas SmartScreen o de antivirus, incluso después de obtener una firma válida: también intervienen reputación y heurísticas.

La firma de actualizaciones de Tauri sí autentica el archivo antes de ejecutarlo; no es una firma de identidad reconocida por Windows y no elimina su advertencia de editor.

## Integración preparada para un certificado de editor

Cuando el responsable obtenga un certificado de firma de código válido y lo tenga disponible en el almacén de Windows, configura `CLAVELOCAL_CERT_THUMBPRINT` y ejecuta `npm run desktop:build:signed`. El script valida la huella, exige Windows y configura firma SHA-256 y sellado de tiempo. Requiere las herramientas de firma de Windows y acceso autorizado al certificado. No introduce claves privadas en el repositorio ni fabrica un certificado autofirmado.

Para Microsoft Artifact Signing debe configurarse además la cuenta, el perfil de certificado, su identidad verificada y el proveedor de firma correspondiente. Esos datos y su posible coste requieren decisión del propietario. No se ha contratado ni conectado ningún servicio de pago.

Antes de publicar un instalador firmado se debe verificar que `Get-AuthenticodeSignature` devuelve `Valid` y que el editor mostrado corresponde al titular autorizado. La firma debe realizarse antes de la firma de actualización, porque modifica los bytes del archivo.

Referencias: https://v2.tauri.app/distribute/sign/windows/ y https://v2.tauri.app/plugin/updater/
