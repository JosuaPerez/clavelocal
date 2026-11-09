# ClaveLocal 🔐

**Generador y bóveda de contraseñas local, privada y de código abierto.**

![Presentación de ClaveLocal](assets/clavelocal-launch.png)

ClaveLocal nace de una idea sencilla: una herramienta de contraseñas debería ser útil sin obligarte a crear una cuenta ni enviar tus datos a un servidor. La bóveda se cifra en tu navegador y permanece en tu computadora.

> [!IMPORTANT]
> ClaveLocal está en una etapa inicial y todavía no ha recibido una auditoría independiente. Es un proyecto educativo y comunitario; para secretos críticos, utiliza un gestor de contraseñas con auditorías públicas y trayectoria comprobada.

## Funciones actuales

- Generador de contraseñas basado en `crypto.getRandomValues`.
- Bóveda cifrada con AES-256-GCM.
- Derivación de clave con PBKDF2-SHA-256 y 600.000 iteraciones; migración de bóvedas antiguas después de autenticarlas.
- Búsqueda, categorías y favoritos.
- Copia rápida y limpieza del portapapeles después de 30 segundos cuando el navegador lo permite.
- Bloqueo automático tras 5 minutos sin actividad.
- Exportación e importación de copias cifradas.
- Sin telemetría, cuentas, anuncios ni conexiones de red de la bóveda. La versión de escritorio incorpora Tauri y WebView2.

## Inicio rápido en Windows

### Probar sin instalar

Abre [la demo pública](https://josuaperez.github.io/clavelocal/). Incluye datos ficticios; no permite guardar ni importar contraseñas reales.

### Descargar la aplicación

1. Abre [las versiones publicadas](https://github.com/JosuaPerez/clavelocal/releases).
2. Descarga el instalador `.exe` de Windows, instálalo para tu usuario y abre ClaveLocal. No necesitas Node.js ni Git.
3. Crea una clave maestra larga y única y exporta tu copia cifrada.

La versión 0.2 es experimental. El instalador inicial no tiene firma Authenticode: Windows puede mostrar una advertencia y una suma SHA-256 no sustituye una firma de identidad. No desactives las protecciones del sistema para instalarlo. Las actualizaciones son manuales.

La bóveda de escritorio se guarda cifrada en los datos de WebView2 de tu usuario. Es independiente de la del navegador: para migrar desde 0.1, exporta la copia desde el navegador y restáurala en la app. Conserva esa copia hasta verificar tus entradas.

### Ejecutar desde el código fuente

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

La app web no carga librerías remotas. Para construir el instalador se necesitan las herramientas de desarrollo de Tauri, Rust y C++ de Windows.

```powershell
npm test
npm run test:e2e
npm run build
npm start
```

Antes de proponer cambios, consulta [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) y la [hoja de ruta](docs/ROADMAP.md).

`npm run desktop:build` genera el instalador. Las pruebas de navegador requieren `npx playwright install chromium`. `npm run build` separa la aplicación real (`dist/`) de la web pública de demostración (`site/`); solo esta última se despliega en GitHub Pages.

## Principios del proyecto

1. **Local primero:** la red no debe ser necesaria para usar la bóveda.
2. **Privacidad verificable:** sin telemetría ni recopilación silenciosa.
3. **Seguridad comprensible:** decisiones documentadas y código fácil de revisar.
4. **Evolución abierta:** las mejoras se discuten mediante issues y pull requests.

## Licencia

MIT © 2026 Josua Perez. Consulta [LICENSE](LICENSE).
