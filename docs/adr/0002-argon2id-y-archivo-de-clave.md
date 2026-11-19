# ADR 0002 · Argon2id y archivo de clave opcional

**Estado:** propuesta para decisión del propietario. **No hay implementación.** Este documento no cambia el formato `clavelocal-v1`, PBKDF2, el AAD `clavelocal:v1` ni ningún comando de IPC.

## Contexto

Hoy la bóveda se protege con AES-256-GCM y una clave derivada con PBKDF2-SHA256 de 600.000 iteraciones a partir de la clave maestra. Quien obtenga una copia del archivo cifrado (el perfil de WebView2, una exportación o la copia `.previous`) puede intentar adivinar la clave maestra sin conexión. Dos mejoras clásicas reducen ese riesgo:

1. Una función de derivación que consuma **memoria** además de tiempo, para encarecer los ataques con GPU o ASIC (Argon2id).
2. Un **segundo secreto local** mezclado en la derivación (archivo de clave), de modo que la clave maestra sola no baste.

Ninguna de las dos cambia la relación con la clave maestra: una clave maestra mediocre sigue siendo el eslabón débil.

### Estado de las herramientas (verificado)

- OWASP recomienda Argon2id con un mínimo de 19 MiB de memoria, 2 iteraciones y paralelismo 1, y para PBKDF2-HMAC-SHA256 recomienda 600.000 iteraciones (la cifra que ClaveLocal ya usa). [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- La propuesta *Modern Algorithms in the Web Cryptography API* (WICG) incluye Argon2d, Argon2i y Argon2id, pero es un **borrador de grupo comunitario no oficial, sin versión publicada** y su extracto no menciona implementaciones. [WICG webcrypto-modern-algos](https://wicg.github.io/webcrypto-modern-algos)
- El anuncio de pruebas de desarrollo de Chrome 150 sobre WebCrypto menciona ML-KEM, ML-DSA, ChaCha20-Poly1305 y X-Wing y **no menciona Argon2**. [blink-dev, 3 jun 2026](https://groups.google.com/a/chromium.org/g/blink-dev/c/WKF2N040tGM)
- Por tanto, hoy **Web Crypto no ofrece Argon2id de forma disponible para esta app**. Que WebView2 lo incorpore en el futuro es **pendiente de verificar** y no debe darse por hecho.
- **Pendiente de verificar:** el comportamiento exacto de memoria y tiempo de las implementaciones WASM y Rust citadas más abajo en equipos modestos. Este ADR no incluye mediciones propias.

## Opciones para Argon2id

| | A. Librería WASM vendorizada | B. Cálculo nativo en Rust (solo escritorio) | C. Mantener PBKDF2 y subir iteraciones |
|---|---|---|---|
| Idea | Incluir una implementación Argon2id en WebAssembly, con procedencia, licencia y hash fijados, igual que se vendoriza `glib`. | Un comando de Tauri recibe la clave maestra y devuelve la clave derivada o ejecuta el cifrado. | Aumentar las iteraciones de PBKDF2 (p. ej. 1.000.000+) y dejar Argon2id para cuando Web Crypto lo ofrezca. |
| Ventaja | Funciona igual en escritorio y navegador. Sin IPC nuevo. | Menos superficie de código de terceros en el frontend; rendimiento nativo. | Cero código nuevo y cero dependencias; ya probado. |
| Coste y riesgo | Rompe la regla de "cero JavaScript/WASM de terceros en runtime". Exige revisar la cadena de suministro y mantener el módulo al día. Riesgo de errores de implementación y de consumo de memoria alto en navegadores modestos. | **Contradice el ADR 0001**: allí los comandos "no aceptarían ... claves maestras". La clave maestra pasaría por IPC y por memoria de Rust. El modo navegador seguiría con PBKDF2, con dos rutas de derivación que mantener. | No resuelve la resistencia a GPU: sube el coste en tiempo, no en memoria. El desbloqueo se hace más lento para todos. |
| Denegación de servicio | Parámetros de memoria controlados por el archivo: un envoltorio malicioso podría pedir gigabytes. Hay que fijar un **máximo estricto** aceptado al abrir. | Igual para la ruta nativa. | Un envoltorio con iteraciones enormes ya está limitado a los dos valores permitidos. |

**Recomendación del ADR:** no implementar ninguna opción todavía. Si se decide avanzar, **la opción A es la menos intrusiva respecto al modelo de seguridad** (no mueve la clave maestra fuera de Web Crypto/JS) pero exige aceptar explícitamente una excepción a "cero código de terceros en runtime", con auditoría de esa dependencia. La opción B solo si el propietario decide revisar la regla del ADR 0001 de forma explícita. La opción C es el camino de menor riesgo mientras no haya revisión externa.

## Esbozo de envoltorio v2 (no es el formato final)

Solo para razonar sobre compatibilidad. No es una especificación.

- Un campo `kdf` que nombre el algoritmo (`PBKDF2-SHA256` o `Argon2id`) y sus parámetros (memoria, iteraciones, paralelismo, sal), todos incluidos en los datos autenticados para que no puedan alterarse sin que falle el descifrado.
- Una versión de formato propia (`clavelocal-v2`) en vez de reutilizar `-v1`, y un AAD distinto (`clavelocal:v2`) para evitar confusión entre versiones.
- **Protección contra rebajada:** al abrir, la app acepta solo un conjunto cerrado de parámetros con topes de memoria y tiempo. Un archivo que pida menos que el mínimo seguro actual se rechaza, no se acepta en silencio.
- **Compatibilidad:** 0.3.x–0.5.0 validan estrictamente el envoltorio v1 y **no abrirán un v2**. La migración debe avisar con claridad: quien migre no podrá volver a una versión anterior ni abrir ese archivo con ella.
- **Migración opcional y verificada:** nunca automática. Se ofrece tras autenticar con la clave maestra, se verifica releyendo y descifrando el resultado antes de sustituir, y se conserva `.previous` con la clave y el KDF anteriores. Hay que decidir cómo mostrar y eliminar esa copia, igual que en el cambio de clave maestra.
- **Vectores de prueba necesarios antes de cualquier implementación:** vectores fijos de Argon2id con parámetros de la propuesta (incluyendo uno al borde del tope de memoria), vectores de derivación completos v2, casos negativos de parámetros alterados y de rebajada, y vectores v1 existentes que deben seguir pasando sin cambios.

## Archivo de clave opcional

**Qué es:** un archivo con bytes aleatorios que se mezcla en la derivación junto con la clave maestra, como hacen otros gestores locales. **No es el mismo caso** que Windows Hello ni que una llave de hardware.

**Qué defiende.** Un atacante que solo obtenga la copia cifrada (perfil, exportación, copia anterior) y no el archivo de clave no puede probar claves maestras sin conexión, aunque la clave maestra sea débil.

**Qué no defiende.**
- Un atacante con acceso al equipo desbloqueado, o que obtenga **la copia cifrada y el archivo de clave** juntos (por ejemplo, si el archivo está en la misma carpeta de nube o en la misma copia de seguridad).
- Malware que lea la memoria o el teclado durante el uso.
- El caso en que el usuario guarda el archivo de clave junto a la bóveda: el beneficio desaparece.

**Si se pierde, la bóveda no se puede abrir.** Es la consecuencia más grave y la razón de que no sea una función "barata": exige decidir antes qué hace la app para evitar bloqueos permanentes.

Preguntas de diseño abiertas:

1. **Recuperación.** No existe una recuperación honesta si se pierden el archivo y no hay copia de él. ¿Se exige generar y confirmar una copia del archivo de clave al activarlo? ¿Se impide activarlo sin una exportación cifrada previa que pueda abrirse sin el archivo?
2. **Exportación y restauración.** Una copia cifrada exportada hereda la dependencia del archivo de clave. Hay que decidir si la copia exportada **requiere también el archivo** y cómo se explica en la pantalla de restauración, y qué pasa con `.previous`.
3. **Cambio de clave maestra.** ¿Se puede cambiar el archivo de clave por separado? ¿Cómo interactúa con la rotación de `.previous`?
4. **Soporte.** Un modo de fallo silencioso ("la contraseña es correcta pero no abre") es muy difícil de diagnosticar sin telemetría. Hay que definir mensajes de error distinguibles sin filtrar información útil a un atacante.
5. **Formato del archivo.** Tamaño mínimo y máximo, cómo se lee (no se envía a ningún sitio) y cómo se evita que se use por accidente un archivo equivocado, sin guardar su ruta.
6. **Relación con Windows Hello.** Hello debería desbloquear una clave local protegida por el dispositivo, con la clave maestra y el archivo como recuperación. Hay que aclarar cómo se combinan antes de implementar ninguno de los dos.

### Condiciones en las que NO se implementaría

- Si no se puede ofrecer una recuperación que el usuario entienda y compruebe en el momento de activarlo.
- Si la exportación cifrada no puede restaurarse de forma verificable en una instalación limpia **con** el archivo de clave.
- Si el almacenamiento y la recuperación del ADR 0001 siguen sin verificarse (corte de energía, permisos): sería añadir un modo de fallo permanente sobre una base no comprobada.
- Si no hay al menos una revisión externa del diseño criptográfico (véase abajo).

## Criterios de salida

Este ADR se considera listo para decidir cuando existan, y estén revisados:

1. Un documento de diseño criptográfico del envoltorio v2 y de la mezcla del archivo de clave, con el modelo de amenazas actualizado.
2. Vectores de prueba fijos y pruebas negativas descritos en la sección del envoltorio.
3. Una medición propia de memoria y tiempo de la opción elegida en equipos modestos (no se incluye aquí).
4. Una revisión externa del diseño, aunque sea informal y gratuita, por alguien distinto del autor.
5. Los criterios de salida del ADR 0001 sobre almacenamiento cumplidos o aplazados explícitamente.

## Pregunta al propietario

¿Quieres **(a)** dejar PBKDF2 y revisar este ADR cuando Web Crypto ofrezca Argon2id o haya revisión externa, **(b)** abrir una fase de diseño y medición de la opción A (WASM vendorizado, aceptando la excepción a "cero código de terceros en runtime"), o **(c)** abrir la discusión de revisar la regla del ADR 0001 para permitir la ruta nativa (B)? El archivo de clave se decide por separado y **no se recomienda implementarlo antes** de resolver el almacenamiento y de tener revisión externa.
