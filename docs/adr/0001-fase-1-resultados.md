# ADR 0001 · Experimento de fase 1 en Windows

**Resultado:** se conserva `localStorage`. El reemplazo y la recuperación funcionaron con datos ficticios, pero la herencia de permisos requiere revisión y el corte de energía en VM sigue sin verificar.

Ejecuta `./scripts/prototype-native-storage.ps1` desde PowerShell en Windows con Node.js. El script usa únicamente los vectores ficticios v1 del repositorio. Crea una carpeta con nombre único bajo LocalAppData, sin usar la carpeta de la aplicación, y retira los archivos que creó al finalizar. Usa `FileStream.Flush(true)` para volcar el temporal y `File.Replace` para reemplazar el principal y conservar una copia con marca UTC. Comprueba los bytes contra los vectores y autentica el contenido con Web Crypto. Es una prueba de archivos, sin IPC ni integración con la app. [FileStream.Flush](https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.flush) · [File.Replace](https://learn.microsoft.com/en-us/dotnet/api/system.io.file.replace).

## Observaciones

Entorno probado: Windows 11 Home, compilación 26300, NTFS. Microsoft Defender Antivirus 4.18.26100.4 estaba habilitado con protección en tiempo real.

| Prueba | Resultado |
| --- | --- |
| Escritura inicial, volcado y lectura | La revisión de 310.000 iteraciones abrió. Con el temporal de 600.000 volcado, ambos archivos abrieron por separado. |
| Contención del archivo principal | Un handle sin permiso de compartir borrado provocó el error de uso compartido 32. El principal y el temporal siguieron abriendo y no se creó una copia de respaldo. |
| Reemplazo y recuperación | Al liberar el handle, la revisión nueva abrió como principal y la antigua como copia. Una copia manual del respaldo conservó sus bytes y se autenticó. |
| Permisos heredados | La carpeta, los temporales, el principal reemplazado y el respaldo conservaron la herencia. Todos tenían una concesión adicional de lectura y ejecución para un principal con SID de cuenta, además de los permisos esperados. La cuenta no se identifica en el reporte. La prueba con una segunda cuenta estándar y sus permisos efectivos queda pendiente. |
| Antivirus | El ensayo se ejecutó con Defender activo. El error 32 se indujo abriendo el archivo desde otro handle. Falta verificar los escenarios de bloqueo del temporal y la copia, y el comportamiento ante una intervención del antivirus. |
| Corte de energía y espacio | Sin verificar. El ensayo no apagó una VM ni agotó un volumen. Un temporal volcado no demuestra durabilidad ante pérdida de energía. |

El script señala la concesión adicional para revisión y deja los permisos heredados tal como los aplica Windows. Antes de proponer una DACL específica hay que comprobar el acceso efectivo de una segunda cuenta en un entorno desechable. Si el acceso adicional resulta efectivo para una cuenta fuera del conjunto permitido, se documentará la concesión concreta y se volverá a probar cualquier cambio de permisos, incluido el reemplazo y la recuperación.

La fase 2 depende de los criterios de salida del [ADR](0001-almacenamiento-nativo.md#criterio-de-salida-de-la-fase-1), incluida la recuperación tras cortes de energía en los puntos de escritura. Si esos resultados no se pueden obtener, el archivo nativo queda como experimento y la app sigue usando `localStorage`.
