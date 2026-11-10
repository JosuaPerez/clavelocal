# Perfil local y acceso personalizado

## Disponible desde 0.3.1

Cada bóveda tiene un perfil local con nombre de usuario. Al crearla se eligen nombre y clave maestra; al volver a abrir la app aparece **Hola, nombre** y se pide únicamente la clave. No se mantiene una sesión descifrada al cerrar ni se guarda la clave maestra.

Las bóvedas anteriores siguen abriéndose con su clave de siempre. Después del primer desbloqueo se invita a elegir un nombre. La personalización no reemplaza entradas ni cambia la clave maestra. El botón **Mi perfil** permite renombrar el perfil mientras la bóveda está abierta. No hay cuentas en servidores ni múltiples bóvedas seleccionables por nombre en esta versión.

## Datos y privacidad

- El perfil canónico, `{version: 1, username}`, se guarda dentro de la bóveda cifrada y acompaña las copias JSON.
- Para poder saludar antes de descifrar se conserva una copia visible del nombre en `clavelocal.profile.v1`, en el almacenamiento local del mismo usuario/navegador. La interfaz lo explica al crear y editar el perfil.
- El nombre no es un secreto ni un segundo factor de autenticación. Alterar ese cache no permite descifrar ni abrir la bóveda. Después de una autenticación válida se actualiza a partir del perfil cifrado.
- Un cache dañado o inexistente no impide abrir la bóveda. Un fallo al recordar el nombre tampoco invalida un desbloqueo correcto. La restauración de copias actualiza la bienvenida con el perfil restaurado.
- El formato de bóveda sigue siendo v1; el perfil es opcional para conservar lectura de copias antiguas. La importación CSV mantiene el perfil y las entradas existentes.

## Futuro: Windows Hello y passkeys

Todavía no se ha implementado desbloqueo con Windows Hello ni con passkeys. La tarjeta del perfil lo indica como próximo trabajo; no hay una verificación simulada ni una clave maestra guardada para omitir el cifrado.

La siguiente etapa requiere un diseño de protección de claves nativo: una clave de datos aleatoria para cifrar la bóveda, protegida por la clave maestra y, opcionalmente, por un mecanismo de claves del sistema que exija la verificación del usuario. Debe conservarse una ruta de recuperación con clave maestra y copias cifradas, y contemplarse el cambio de equipo, la revocación y el restablecimiento del PIN de Windows.

Una respuesta satisfactoria de un diálogo biométrico por sí sola no proporciona una clave de descifrado. Para passkeys, una firma WebAuthn tampoco equivale directamente a una clave AES; se debe estudiar una función compatible como PRF y sus límites de dispositivo, origen y recuperación. Antes de activarlo se necesitan una migración de formato comprobada y revisión de seguridad.

Referencias oficiales:

- https://learn.microsoft.com/windows/uwp/security/microsoft-passport
- https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.ui.userconsentverifier
- https://www.w3.org/TR/webauthn-3/#prf-extension

## Extensión de navegador

La extensión Chrome/Brave sigue como siguiente hito, después de este acceso personalizado. Su conexión requerirá un componente nativo con emparejamiento autenticado y permisos mínimos. El nombre recordado no servirá como prueba de identidad de la extensión ni como autorización para rellenar credenciales.
