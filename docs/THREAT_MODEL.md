# Modelo de amenazas · 0.2

## Qué protegemos

Entradas, notas y clave maestra frente a la lectura del archivo de bóveda cuando está bloqueado. AES-256-GCM autentica el ciphertext; PBKDF2-SHA256 deriva una clave no exportable, con salt de 16 bytes e IV nuevo de 12 bytes por escritura. La clave maestra no se persiste. Las bóvedas de 310.000 iteraciones se verifican antes de migrar a 600.000, dejando una copia cifrada anterior.

## Límites

- Malware, keyloggers, extensiones privilegiadas, acceso al proceso y una sesión desbloqueada quedan fuera de esa protección. No hay garantía de borrado físico de memoria JavaScript ni de historial del portapapeles de Windows.
- El bloqueo vacía campos y listas, cancela callbacks de copia y elimina referencias de la sesión. Se activa por inactividad y al ocultar el documento. No se promete integración con suspensión/bloqueo de sesión de Windows en esta versión.
- La bóveda local cifrada puede ser copiada y atacada offline. Una clave maestra larga y única es esencial; limitar intentos en la interfaz no detiene ese ataque.
- La copia anterior está en el mismo dispositivo: ayuda a recuperar una escritura, pero no sustituye una copia externa cifrada. Se descarga desde la pantalla inicial. Limpiar datos del navegador/WebView o perder el equipo puede destruir ambas.
- Los metadatos del envoltorio se validan estrictamente; importaciones se descifran y validan antes de reemplazar. Se permiten solo factores KDF conocidos para evitar trabajo arbitrario. El tamaño máximo es 4 MiB y 5.000 entradas.
- Escrituras usan Web Locks y comparación de versión almacenada. Se rechazan ventanas obsoletas y se bloquea al recibir cambios de almacenamiento.

## Aplicación y distribución

El escritorio empaqueta recursos locales con Tauri sin plugins de shell, archivos, HTTP ni actualización. La bóveda usa almacenamiento cifrado del WebView del usuario. La CSP no autoriza scripts remotos ni conexiones de la app. La web pública es una demo separada, sin formularios habilitados para secretos reales; no distribuye la app real por HTTP.

El instalador inicial no tiene firma de identidad de Windows. Los hashes de release detectan cambios respecto de esa publicación, pero no protegen frente al compromiso de la cuenta que publica. No existe actualizador automático. Incorporar Authenticode y, si llega un actualizador, verificación de su firma es trabajo pendiente.

## Contribuciones

Se tratan los PR como código no confiable. Los checks de PR no reciben credenciales de publicación. CODEOWNERS y las reglas de rama requieren revisión para contribuciones externas. El administrador mantiene capacidad de bypass; proteger su cuenta con 2FA/passkey y custodiar sus credenciales es una responsabilidad manual que este repositorio no puede verificar.

Dependabot, CodeQL, revisión de dependencias, fijación de acciones y protección contra secretos reducen riesgo pero no certifican ausencia de código malicioso. Los workflows se revisan como código de alta sensibilidad. GitHub Pages despliega solo desde `main`; la compilación de Windows solo sube artefactos, sin publicar releases. Las firmas futuras no deberán estar disponibles en workflows de PR.

## Verificación pendiente

Auditoría independiente, revisión específica de APIs nativas, firma de distribución, pruebas con usuarios en Windows y bloqueo integrado con eventos del sistema. No presentar 0.2 como producto auditado ni como único almacén de secretos críticos.

## Alertas conocidas al publicar 0.2

Dependabot detectó la alerta #1 de este repositorio: `glib` 0.18.5, severidad media, implementación no segura de `VariantStrIter`. La corrección indicada es 0.20.0. Llega mediante el stack GTK de Tauri en plataformas Unix; no se compila en el instalador Windows x86_64, que usa WebView2. Cargo.lock también enumera dependencias de otras plataformas, aunque no se incluyan en ese binario.

La alerta se mantiene abierta; no se descarta ni se fuerza una actualización incompatible. No se distribuye un paquete Linux. Antes de ofrecerlo debe actualizarse o corregirse ese árbol de dependencias y verificarse nuevamente. Referencia: https://github.com/JosuaPerez/clavelocal/security/dependabot/1
