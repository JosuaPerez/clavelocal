# ClaveLocal 🔐

**Generador y bóveda de contraseñas local, privada y de código abierto.**

![Presentación de ClaveLocal](assets/clavelocal-launch.png)

ClaveLocal nace de una idea sencilla: una herramienta de contraseñas debería ser útil sin obligarte a crear una cuenta ni enviar tus datos a un servidor. La bóveda se cifra en tu navegador y permanece en tu computadora.

> [!IMPORTANT]
> ClaveLocal está en una etapa inicial y todavía no ha recibido una auditoría independiente. Es un proyecto educativo y comunitario; para secretos críticos, utiliza un gestor de contraseñas con auditorías públicas y trayectoria comprobada.

## Funciones actuales

- Generador de contraseñas basado en `crypto.getRandomValues`.
- Bóveda cifrada con AES-256-GCM.
- Derivación de clave con PBKDF2-SHA-256 y 310.000 iteraciones.
- Búsqueda, categorías y favoritos.
- Copia rápida y limpieza del portapapeles después de 30 segundos cuando el navegador lo permite.
- Bloqueo automático tras 5 minutos sin actividad.
- Exportación e importación de copias cifradas.
- Sin telemetría, cuentas, anuncios, dependencias externas ni conexiones de red.

## Inicio rápido en Windows

Requisitos: [Node.js](https://nodejs.org/) 20 o posterior.

1. Descarga o clona este repositorio.
2. Haz doble clic en `Abrir ClaveLocal.bat`.
3. Crea una clave maestra de al menos 12 caracteres.
4. Mantén abierta la ventana de ClaveLocal mientras utilizas la aplicación.

También puedes iniciarla desde una terminal:

```powershell
npm start
```

La aplicación estará disponible únicamente en `http://127.0.0.1:4173`.

## Cómo protege los datos

```text
Clave maestra
    │
    ├─ PBKDF2-SHA-256 + salt aleatorio ──► clave AES-256
    │
    └─ AES-256-GCM + IV aleatorio ───────► bóveda cifrada en el navegador
```

La clave maestra no se guarda. Las entradas solo están descifradas en memoria mientras la bóveda permanece abierta. El almacenamiento persistente contiene únicamente el salt, los parámetros criptográficos y el texto cifrado autenticado.

## Desarrollo

No hay dependencias de producción.

```powershell
npm test
npm start
```

Antes de proponer cambios, consulta [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) y la [hoja de ruta](docs/ROADMAP.md).

## Principios del proyecto

1. **Local primero:** la red no debe ser necesaria para usar la bóveda.
2. **Privacidad verificable:** sin telemetría ni recopilación silenciosa.
3. **Seguridad comprensible:** decisiones documentadas y código fácil de revisar.
4. **Evolución abierta:** las mejoras se discuten mediante issues y pull requests.

## Licencia

MIT © 2026 Josua Perez. Consulta [LICENSE](LICENSE).
