# Sistema de Empaque Planta - Frontend (nuevo)

Version nueva del frontend de Planta, armada sobre la **Plantilla Base** (Tailwind + daisyUI + Lucide) con las mejoras de movil de **Aseguramiento de Calidad**. El frontend anterior (Bootstrap) sigue en `Temporal/planta` y no se toca.

**Stack:** Angular 21 (standalone) · Tailwind 3 + daisyUI 4 · Lucide (iconos) · Dexie (IndexedDB).

## Como correrlo

```bash
npm install
npm start          # http://localhost:4200
npm run build      # produccion en dist/planta-app
```

URL de la API: `src/environments/environment.ts` (`apiBaseUrl`, sin `/api` ni `/` al final) y `environment.prod.ts`. El backend debe permitir el origen `http://localhost:4200` con credenciales (CORS).

## Inicio de sesion (importante)

El backend actual de Planta (`api_planta`) autentica asi, y este frontend esta hecho para ese esquema:

- `POST /api/auth/login` con `{ usuario, password }` -> devuelve `{ user }` y guarda el JWT en la cookie HttpOnly `access_token` (8 horas).
- No hay refresh token ni endpoints de sesiones. Cuando el JWT vence, la API responde `401`: se muestra el aviso de sesion vencida y se vuelve al login. **Los datos offline pendientes no se borran.**
- Todas las llamadas a la API van con `withCredentials` (ver `shared/interceptors/auth.interceptor.ts`).
- La sesion y el usuario se guardan en Dexie para abrir la app sin internet. Si entra otro usuario o empresa en el mismo navegador, se elimina la base local anterior.
- Cerrar sesion exige internet y avisa si hay datos pendientes de sincronizar.

La plantilla original usa access token + refresh token (`/api/auth/refresh`, `/api/auth/sessions`). Para adoptarlo hay que cambiar tambien el backend; el cambio en este frontend queda acotado a `auth-api.service.ts`, `auth.service.ts` y `auth.interceptor.ts`.

Roles (`idRol`): ver `shared/guards/role.guard.ts` (`ADPLA`, `LOPLA`, `MOPLA`, `GMPLA`, `COPLA`, `OPPLA`).

## Estructura

```
src/app/
  auth/login/          Login
  layout/              Menu lateral (sidebar), barra superior (topbar) y contenido
  pages/               Una carpeta por pantalla (hoy solo `inicio`, con ejemplos de tabla y avisos)
  shared/
    components/        Modales (carga, aviso, confirmar, texto, sesion vencida), selects con buscador, paginador
    services/          Auth, conectividad y servicios de los modales
    interceptors/      auth (cookie JWT, 401/403) y connectivity (modo offline)
    guards/            auth y roles
    dexiedb/           Base local (schema/ y repository/). Nunca dentro de una pantalla
    utils/             Fechas, paginacion, portal de modales, uuid
```

## Estandares de pantalla (tomados de Aseguramiento)

- Encabezado con icono, filtros en tarjeta, tabla `table table-zebra` dentro de `.tabla-scroll` y `<app-paginator>` debajo. Ver `pages/inicio`.
- Estilos globales y fixes de movil/iOS en `src/styles.scss` (modales en `body`, botones sin salto de linea, tablas con encabezado fijo).
- Pantallas solo online: `data: { requiresInternet: true }` en la ruta y `requiresInternet: true` en el menu.

## Como crear una pantalla nueva

1. `pages/<modulo>/<modulo>.component.ts` (+ `.html`). Servicio HTTP en `shared/services/<modulo>-api.service.ts` y tipos en `shared/interfaces/`.
2. Ruta en `app.routes.ts` (dentro de `children`).
3. Enlace en `NAV_SECTIONS` de `layout/components/sidebar/sidebar.component.ts` (con `roles` si es restringida).
4. Datos offline: tabla en `dexiedb/db-table-names.ts`, indice en `dexiedb/schema/<modulo>-db-schema.ts`, nueva `version(n)` en `dexie-db.service.ts` y, si hay pendientes de subir, una linea en `pending-sync.service.ts`.
