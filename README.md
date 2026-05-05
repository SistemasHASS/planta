# PaletsFront

Este proyecto usa [Angular CLI](https://github.com/angular/angular-cli) versión 21.2.9.

## Requisitos

- **Node.js**: recomendado **LTS** (por ejemplo Node 20/22)
- **npm**: el que viene con Node

Si usas `nvm`:

```bash
nvm install --lts
nvm use --lts
```

## Instalación

```bash
npm install
```

## Servidor de desarrollo

Para levantar el servidor de desarrollo local, ejecuta:

```bash
npm start
```

Cuando el servidor esté corriendo, abre tu navegador y entra a `http://localhost:4200/`. La aplicación se recargará automáticamente cada vez que modifiques archivos del proyecto.

## Generación de código (scaffolding)

Angular CLI incluye herramientas de scaffolding. Para generar un componente nuevo, ejecuta:

```bash
ng generate component component-name
```

Para ver la lista completa de schematics disponibles (como `components`, `directives` o `pipes`), ejecuta:

```bash
ng generate --help
```

## Compilación (build)

Para compilar el proyecto, ejecuta:

```bash
npm run build
```

Esto compila el proyecto y guarda los artefactos en el directorio `dist/`. Por defecto, el build de producción optimiza la aplicación para rendimiento.

## Pruebas unitarias

Para ejecutar pruebas unitarias con [Karma](https://karma-runner.github.io), usa:

```bash
npm test
```

## Pruebas end-to-end (e2e)

Para pruebas end-to-end (e2e), ejecuta:

```bash
ng e2e
```

Angular CLI no incluye un framework e2e por defecto. Puedes elegir el que mejor se adapte a tu necesidad.

## Recursos adicionales

Para más información sobre Angular CLI (incluyendo referencias de comandos), revisa: [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).
