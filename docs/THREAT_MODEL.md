# Modelo de amenazas · 0.3

## Qué protegemos

Entradas, notas y clave maestra frente a la lectura del archivo de bóveda cuando está bloqueado. AES-256-GCM autentica el ciphertext; PBKDF2-SHA256 deriva una clave no exportable, con salt de 16 bytes e IV nuevo de 12 bytes por escritura. La clave maestra no se persiste. Las bóvedas de 310.000 iteraciones se verifican antes de migrar a 600.000, dejando una copia cifrada anterior.

## Límites

- Desbloquear una bóveda de 600.000 iteraciones no escribe el archivo ni rota `.previous`; un perfil ausente se guarda solo al completarlo. La misma clave y salt se reutilizan entre sesiones; cada cifrado genera un IV aleatorio de 96 bits. No se rota la clave por abrir. El presupuesto de IV aleatorios bajo una clave es finito: el límite de 2^32 invocaciones de [NIST SP 800-38D §8.3](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) no debe tratarse como garantía de ausencia de colisiones. Esta app limita entradas, pero no cuenta cifrados de por vida.
- Al migrar desde 310.000 se guardan nuevos parámetros solo si la escritura tiene éxito. Si falla, se abre con clave, salt e iteraciones originales, usados también en las ediciones posteriores. Los conflictos entre ventanas no se tratan como fallos recuperables de migración.
- La copia anterior rota solo con escrituras reales. `localStorage` no ofrece una transacción de dos claves: si falla la escritura principal, se intenta restaurar `.previous`. Si también falla esa restauración, la principal permanece intacta, pero `.previous` pudo cambiar; se informa y se recomienda exportar. Si falla escribir la copia, se aborta antes de tocar la principal. Las copias comparten el límite de espacio del almacenamiento local.

- Malware, keyloggers, extensiones privilegiadas, acceso al proceso y una sesión desbloqueada quedan fuera de esa protección. No hay garantía de borrado físico de memoria JavaScript ni de historial del portapapeles de Windows.
- El bloqueo vacía campos y listas y elimina referencias de la sesión. No cancela la limpieza pendiente del portapapeles, que conserva solo un digest y plazo. Se activa por inactividad y al ocultar el documento. No se promete integración con suspensión/bloqueo de sesión de Windows en esta versión.
- La bóveda local cifrada puede ser copiada y atacada offline. Una clave maestra larga y única es esencial; limitar intentos en la interfaz no detiene ese ataque.
- La copia anterior está en el mismo dispositivo: ayuda a recuperar una escritura, pero no sustituye una copia externa cifrada. Se descarga desde Ayuda, incluso con la bóveda bloqueada. Limpiar datos del navegador/WebView o perder el equipo puede destruir ambas.
- Los metadatos del envoltorio se validan estrictamente; importaciones se descifran y validan antes de reemplazar. Se permiten solo factores KDF conocidos para evitar trabajo arbitrario. El tamaño máximo es 4 MiB y 5.000 entradas.
- Escrituras usan Web Locks y comparación de versión almacenada. Se rechazan ventanas obsoletas y se bloquea al recibir cambios de almacenamiento.

## Aplicación y distribución

El escritorio empaqueta recursos locales con Tauri, sin APIs genéricas de shell, archivos ni HTTP expuestas al contenido web. La bóveda usa almacenamiento cifrado del WebView del usuario. La CSP no autoriza scripts remotos; en escritorio admite únicamente el IPC nativo requerido por dos comandos de actualización y `copy_secret`. La web pública es una demo separada, sin formularios habilitados para secretos reales; no distribuye la app real por HTTP.

## Portapapeles

En navegador se intenta limpiar a los 30 s y al volver a mostrar la página, solo si el digest del texto coincide. El temporizador conserva SHA-256, no retiene deliberadamente el texto original. Esto no garantiza borrado físico de strings del motor JavaScript. Los permisos, suspensión de temporizadores y cierre de la página pueden impedir la limpieza; se avisa cuando falla. La comparación y escritura de la API web no son atómicas respecto de otras aplicaciones: existe una ventana de carrera. Nunca se borra a ciegas ante un error de lectura.

En Windows `copy_secret` admite de 1 a 4096 unidades UTF-16, rechaza NUL y no devuelve ni permite leer secretos. Usa los bindings `windows-sys =0.61.2` y SHA-256 de `sha2 =0.10.9`, ya presentes en Cargo.lock; no se modifica la criptografía de la bóveda. La copia coloca antes del texto los tres formatos de exclusión documentados por [Microsoft](https://learn.microsoft.com/en-us/windows/win32/dataxchg/clipboard-formats#cloud-clipboard-and-clipboard-history-formats). Un único trabajador nativo conserva digest, número de secuencia y plazo, comprueba y vacía bajo el mismo `OpenClipboard`, con dos reintentos de un segundo si está ocupado. Una nueva copia reinicia el plazo. Se intenta limpiar también al cerrar o salir normalmente.

No protege frente a software que lea el contenido durante el plazo, historial previo, gestores de portapapeles que ignoren las exclusiones, bloqueo persistente de la API o terminación forzada del proceso. No se garantiza borrado físico de memoria nativa. El comportamiento real de historial, sincronización, temporización y cierre en WebView2 requiere comprobación manual; compilar y ejecutar pruebas puras no lo certifica.

No se añaden capacidades genéricas: los comandos propios registrados ya están disponibles para el contenido local por defecto en [Tauri 2](https://v2.tauri.app/security/capabilities/). La nueva superficie se limita a copiar texto que ese contenido ya posee; no ofrece lectura, rutas, URLs de destino ni ejecución. No se configura acceso remoto.

El instalador no tiene todavía firma de identidad de Windows. Los hashes de release detectan cambios respecto de esa publicación, pero no protegen frente al compromiso de la cuenta que publica. El actualizador de 0.3 usa el plugin oficial de Tauri para verificar firma y versión antes de ejecutar el instalador; se activa solo por una petición del usuario, con endpoint y clave pública fijos. La clave privada se custodia localmente, fuera de Git y de CI. Authenticode sigue pendiente: la firma del actualizador no sustituye la identidad del editor de Windows. Véase [UPDATES.md](UPDATES.md).

## Perfil local

Desde 0.3.1 el perfil canónico está dentro del cifrado. El nombre se replica en un cache visible solo para el saludo previo al desbloqueo, con información explícita al usuario. Ese dato puede ser leído o alterado por quien tenga acceso al almacenamiento local; no autentica, no cambia la derivación de clave y se corrige desde la bóveda después de un desbloqueo válido. Windows Hello y passkeys no están activos. Detalles en [LOCAL_PROFILE.md](LOCAL_PROFILE.md).

## CSV

Los CSV se procesan en memoria dentro del equipo. Se exige una bóveda abierta y se valida cada registro antes de cifrar el conjunto. Las filas se añaden; no sustituyen entradas existentes. La vista previa no muestra contraseñas. Se detectan duplicados exactos, se avisan las filas inválidas y el usuario confirma antes de persistir. Al cancelar o bloquear se eliminan referencias y controles de la importación. No se garantiza borrar físicamente la memoria del runtime; el archivo original sin cifrar permanece en su ubicación y debe gestionarlo el propietario. No se evalúan fórmulas ni HTML del CSV.

## Contribuciones

Se tratan los PR como código no confiable. Los checks de PR no reciben credenciales de publicación. CODEOWNERS y las reglas de rama requieren revisión para contribuciones externas. El administrador mantiene capacidad de bypass; proteger su cuenta con 2FA/passkey y custodiar sus credenciales es una responsabilidad manual que este repositorio no puede verificar.

Dependabot, CodeQL, revisión de dependencias, fijación de acciones y protección contra secretos reducen riesgo pero no certifican ausencia de código malicioso. Los workflows se revisan como código de alta sensibilidad. GitHub Pages despliega solo desde `main`; la compilación de Windows solo sube artefactos, sin publicar releases. Las firmas futuras no deberán estar disponibles en workflows de PR.

## Verificación pendiente

Las pruebas de compatibilidad abren dos archivos cifrados fijos con datos ficticios del formato v1 publicado (310.000 y 600.000 iteraciones), rechazan un byte alterado y verifican la conservación del contenido al migrar. No se regeneran durante las pruebas y no constituyen una auditoría independiente.

Auditoría independiente, revisión específica de APIs nativas, firma de distribución, pruebas con usuarios en Windows y bloqueo integrado con eventos del sistema. No presentar 0.2 como producto auditado ni como único almacén de secretos críticos.

## Alertas conocidas al publicar 0.2

Dependabot detectó la alerta #1 de este repositorio: `glib` 0.18.5, severidad media, implementación no segura de `VariantStrIter`. La corrección indicada es 0.20.0. Llega mediante el stack GTK de Tauri en plataformas Unix; no se compila en el instalador Windows x86_64, que usa WebView2. Cargo.lock también enumera dependencias de otras plataformas, aunque no se incluyan en ese binario.

La alerta se mantiene abierta; no se descarta ni se fuerza una actualización incompatible. No se distribuye un paquete Linux. Antes de ofrecerlo debe actualizarse o corregirse ese árbol de dependencias y verificarse nuevamente. Referencia: https://github.com/JosuaPerez/clavelocal/security/dependabot/1
