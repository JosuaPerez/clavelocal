# GLib: corrección de GHSA-wrw7-89jp-8q8g

## Decisión

Tauri 2.12.5 usa GTK 0.18 en Linux/Unix. Ese árbol requiere GLib 0.18 y no admite
sustituirlo por GLib 0.20 de forma independiente. No se adopta una versión alfa
de Tauri para resolver esta alerta. Se conserva la API compatible de GLib 0.18.5
y se incorpora literalmente el arreglo de sus mantenedores.

- [Alerta del proyecto](https://github.com/JosuaPerez/clavelocal/security/dependabot/1).
- [Aviso RustSec](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
- [Corrección original revisada y fusionada](https://github.com/gtk-rs/gtk-rs-core/pull/1343).
- Commit original: `b5a4071e439bef2b5eea76c3aa25e5ae84839e34`.
- Archivo: `glib/src/variant_iter.rs`, función `VariantStrIter::impl_get`.

El cambio convierte el puntero local en mutable y pasa `&mut p` como argumento
de salida de `g_variant_get_child`. Evita escribir mediante una referencia
inmutable, que producía comportamiento indefinido al optimizar. No se cambia
la lógica del gestor, la criptografía ni el formato de las bóvedas.

## Procedencia y mantenimiento

Se extrajo la distribución oficial de crates.io `glib-0.18.5.crate`, cuyo SHA-256
es `233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5`,
idéntico al fijado previamente en Cargo.lock. Los 121 archivos originales y sus
licencias MIT/COPYRIGHT se conservan en `src-tauri/vendor/glib-0.18.5/`.

`security/glib-vendor.json` registra sus hashes originales. `test/vendor.test.mjs`
comprueba todos los archivos, rechaza adiciones/eliminaciones y exige que al
revertir únicamente las dos líneas del parche se recupere el hash original.
`.gitattributes` evita conversiones de finales de línea en Windows. La copia
local se selecciona mediante `[patch.crates-io]`; Cargo.lock conserva el número
de versión real y deja de apuntar a la distribución vulnerable del registro.
No se inventa una versión 0.20 ni se oculta la procedencia.

Una copia vendorizada requiere mantenimiento: futuras actualizaciones de Tauri
no reemplazan este parche automáticamente. Revisar nuevos avisos de GLib y
retirar el parche, la copia y la prueba especial cuando el árbol de Tauri permita
una versión oficial compatible corregida. No ignorar todos los avisos de GLib.

## Verificación

`npm test` incluye procedencia y comprobación de que quitar el arreglo falla.
El workflow `glib-security` ejecuta en Linux, en modo release, un paquete mínimo
del mismo workspace y lockfile que depende de la misma copia de GLib:

```text
cargo test --release --locked --manifest-path src-tauri/Cargo.toml -p clavelocal-glib-regression
```

Ejercita next, next_back, nth, nth_back, last, iteración normal/inversa, Unicode,
vacíos, un elemento y saltos fuera del rango. El paquete no se distribuye ni se
incluye en el instalador. La prueba Linux no equivale a soportar ni publicar una
app Linux. El mismo workflow verifica que el árbol de ejecución de Windows no
selecciona GLib; el workflow Windows sigue construyendo el instalador con --locked.

## Estado de Dependabot

El arreglo corrige el código afectado, pero no convierte GLib 0.18.5 en una
versión oficial corregida del registro. Dependabot evalúa la rama por defecto y
puede dejar de generar la alerta al desaparecer la dependencia de registro, o
seguir señalando el número de versión de la copia local. En ambos casos la
evidencia es el parche y sus pruebas, no que el contador de alertas sea cero.
No se descarta la alerta ni se añade una excepción general. Verificar su estado
después de fusionar este PR en main; antes de eso puede seguir abierta.
