# Vectores fijos de compatibilidad v1

Datos exclusivamente ficticios, generados una vez con Node y Web Crypto mediante
`node test/vectors/generate.mjs` sobre el formato publicado en 0.3.2.
No regenerarlos al ejecutar pruebas ni para hacer pasar un cambio de formato.

Contraseña pública de prueba: `golden-ficticia-no-usar-en-la-vida-real`.
El contenido esperado está fijado literalmente en `test/golden.test.mjs`: una
entrada con HTML hostil como texto, Unicode, sin perfil y sin datos personales.
Los archivos prueban PBKDF2-SHA256 con 310.000 y 600.000 iteraciones, AES-256-GCM
y AAD `clavelocal:v1`. Salt e IV se generaron aleatoriamente; quedan congelados
en estos archivos, sin modificar el generador de aleatoriedad de la app.
