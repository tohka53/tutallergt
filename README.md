# Taller Control

Aplicación web de demostración para la **administración y control de un taller mecánico**:
clientes, vehículos, tarjetas de circulación, cotizaciones (con PDF), conversión a
servicios, historial por vehículo y control de estados.

Construida con **Angular 18 (NgModule, sin componentes standalone)**, **Angular Material**,
**Reactive Forms** y **SCSS**. Funciona **sin backend**: los datos generales se guardan en
`localStorage` y los archivos (tarjetas de circulación) en `IndexedDB`. Todo el acceso a
datos está aislado en servicios, listo para sustituirse por una API REST.

---

## 1. Requisitos

- **Node.js 18.19+ o 20+** (probado con Node 22).
- **npm 9+**.
- **Google Chrome o Chromium** (solo para `npm test`).

## 2. Instalación

```bash
# Dentro de la carpeta del proyecto (tutallergt)
# Si existe una carpeta node_modules incompleta, elimínala primero:
rm -rf node_modules

npm install
```

> Nota: esta carpeta puede contener un `node_modules` parcial creado durante la generación.
> Ejecuta `rm -rf node_modules` antes de `npm install` para partir de cero.

## 3. Ejecutar en desarrollo

```bash
npm start
# o
ng serve
```

Abre `http://localhost:4200`.

## 4. Compilar para producción

```bash
ng build            # configuración de producción (por defecto)
```

✅ **Confirmado: `ng build` finaliza sin errores.**
Salida de la compilación de producción (optimizada):

```
Initial total            1.27 MB  (249 kB transferencia)
Lazy chunks: quotations, vehicles, workshop-services, clients,
             dashboard, parts-catalog, client-portal, auth, settings
Application bundle generation complete.
```

Todos los módulos de funcionalidad se cargan de forma **diferida (lazy loading)**.
jsPDF/html2canvas quedan en el chunk diferido de cotizaciones, no en el bundle inicial.

## 5. Pruebas

```bash
npm test              # modo interactivo (requiere Chrome)
npm run test:ci       # headless, sin sandbox (CI / contenedores)
```

Las pruebas cubren: cálculo de subtotales, impuestos y total; total en letras;
login mock y roles; restricción de eliminación de vehículos; acceso del cliente
solo a sus vehículos; validación de archivos (MIME + tamaño); numeración
correlativa; y conversión de cotización a servicio con prevención de duplicados.

---

## 6. Credenciales de demostración

| Rol      | Correo               | Contraseña |
|----------|----------------------|------------|
| Mecánico | `mecanico@demo.com`  | `Demo123!` |
| Cliente  | `cliente@demo.com`   | `Demo123!` |

En la pantalla de login hay tarjetas **“Ingresar como mecánico”** e **“Ingresar como
cliente”** que precargan las credenciales. La aplicación indica claramente
**“MODO DEMOSTRACIÓN”**. No se almacenan contraseñas reales.

Los datos de demostración (1 mecánico, 2 clientes, 3 vehículos —incluida una Honda CR-V
2011—, catálogo de 34 repuestos/trabajos, 1 cotización, 1 servicio en proceso y 1 servicio
entregado con su historial de estados) se cargan automáticamente la primera vez.

---

## 7. Arquitectura

```
src/app/
├── core/                     # Singletons: se importa una sola vez en AppModule
│   ├── guards/               # authGuard, roleGuard
│   ├── interceptors/         # apiInterceptor (listo para adjuntar el token JWT)
│   ├── layouts/              # Layout del mecánico y del cliente (sidebar colapsable)
│   ├── services/             # TODA la lógica de datos y negocio
│   └── core.module.ts
├── shared/                   # Reutilizable: se importa en cada módulo de funcionalidad
│   ├── components/           # confirm-dialog, access-denied, not-found
│   ├── pipes/                # gtq (moneda Q), fileSize
│   ├── material.module.ts    # Reexporta los módulos de Angular Material
│   ├── nav.util.ts           # Prefijo de ruta según rol (/app vs /portal)
│   ├── status.util.ts        # Etiquetas y colores de estados
│   └── shared.module.ts
├── models/                   # Interfaces TypeScript (User, Client, Vehicle, ...)
├── auth/                     # Login (lazy)
├── dashboard/                # Panel del mecánico (lazy)
├── client-portal/            # Dashboard y perfil del cliente (lazy)
├── clients/                  # CRUD de clientes (lazy)
├── vehicles/                 # CRUD, historial y visor de documentos (lazy)
├── parts-catalog/            # Catálogo de repuestos y trabajos (lazy)
├── quotations/               # Cotizaciones, PDF, envío, conversión (lazy)
├── workshop-services/        # Servicios y línea de tiempo de estados (lazy)
├── settings/                 # Configuración del taller (lazy)
├── app-routing.module.ts     # Rutas raíz + guards + layouts
└── app.module.ts
```

### Principios

- **Los componentes nunca acceden a `localStorage`/`IndexedDB` directamente.** Todo pasa
  por `StorageService` / `IndexedDbService`. Esto permite cambiar la persistencia sin tocar
  la UI.
- **Cada servicio de datos** (`ClientService`, `VehicleService`, `QuotationService`, …)
  expone métodos que devuelven `Observable`, simulando latencia con `delay()`. Sustituir el
  cuerpo por `HttpClient` es directo y **no cambia la firma pública**.
- **Autorización centralizada** en `AuthorizationService` y aplicada tanto en la UI (ocultar
  botones) como antes de ejecutar acciones sensibles (p. ej. eliminar vehículo).
- **Layouts por rol**: `/app/**` para el mecánico, `/portal/**` para el cliente, protegidos
  por `authGuard` + `roleGuard`.
- **Configuración del taller** (nombre, logo, correo, teléfono, dirección, NIT, moneda,
  % de impuesto, tamaño máximo de archivo) centralizada en `WorkshopSettingsService` y
  editable desde la pantalla de Configuración; alimenta el encabezado y el PDF.

### Paleta de marca

Negro `#111111` · Amarillo `#FFC107` · Blanco `#FFFFFF` · Azul `#1565C0` ·
Gris de fondo `#F4F6F8` · Gris oscuro `#343A40`. Definida como variables CSS en
`src/styles.scss` (`--tc-*`) y reflejada en el PDF de cotización.

---

## 8. Cómo reemplazar los servicios mock por una API REST

El código ya está preparado. Pasos:

1. **Capa de persistencia** — En `StorageService` cada método (`get/set/remove`) hoy usa
   `localStorage`. Sustituir por llamadas `HttpClient`, o crear un `HttpStorageService` con
   la misma interfaz e inyectarlo mediante un token de DI.

2. **Servicios de dominio** — En `ClientService`, `VehicleService`, `QuotationService`,
   `WorkshopServiceService`, `PartsCatalogService`: reemplazar los cuerpos que devuelven
   `of(...)` por `this.http.get/post/put/delete(...)` contra `environment.apiBaseUrl`. Las
   firmas (`list()`, `create()`, `update()`, …) se mantienen, por lo que los componentes no
   cambian.

3. **Autenticación** — En `AuthService.login()` reemplazar la verificación mock por
   `POST /auth/login` que devuelva un **JWT**. Guardar el token (idealmente cookie httpOnly)
   y descartar el guardado de credenciales. Descomentar la lógica del `apiInterceptor` para
   adjuntar `Authorization: Bearer <token>` y manejar 401/403.

4. **Autorización en el servidor** — `AuthorizationService` y `roleGuard` son solo la primera
   barrera (UX). **En producción, cada endpoint debe volver a validar el rol y la propiedad
   del recurso en el backend.** Ocultar botones no es seguridad.

5. **Almacenamiento de archivos** — `IndexedDbService` implementa
   `saveBlob/getBlob/deleteBlob`. Crear un adaptador equivalente para **Supabase Storage,
   Firebase Storage, Amazon S3 o una API propia** y sustituirlo por inyección de dependencias
   en `VehicleDocumentService`. No almacenar documentos personales en `localStorage`.

6. **Envío de cotizaciones** — `QuotationDeliveryService` define el contrato. Implementar
   `EmailDeliveryAdapter` (SendGrid/SES con adjunto PDF) y `WhatsAppDeliveryAdapter`
   (WhatsApp Business API o enlace `wa.me` + PDF alojado), reemplazando el `MockDeliveryAdapter`.

7. **Correlativos** — Hoy se generan en el cliente (`COT-0001`, `ORD-0001`). En producción
   deben generarse en el servidor para evitar colisiones.

8. **Semilla** — Eliminar `SeedDataService`; los datos vendrán del backend.

---

## 9. Variables de entorno para producción

Configurables en `src/environments/environment.ts`:

| Variable         | Descripción                                                        |
|------------------|--------------------------------------------------------------------|
| `production`     | Marca el modo de compilación.                                      |
| `useMockBackend` | `true` = demo local; `false` = usar API REST real.                 |
| `apiBaseUrl`     | URL base de la API (p. ej. `https://api.tallercontrol.gt`).        |
| `fileStorage`    | Destino de archivos: `indexeddb` \| `supabase` \| `s3` \| `api`.   |

La versión de producción con backend requeriría además, **en el servidor** (no en el
frontend): secreto de firma **JWT**, credenciales de la base de datos, credenciales del
proveedor de correo (API key de SendGrid/SES), token de la WhatsApp Business API y las
credenciales/bucket del almacenamiento de archivos (Supabase/Firebase/S3).

---

## 10. Estado de las fases

| Fase | Entregable | Estado |
|------|------------|--------|
| 1–2  | Proyecto, arquitectura y módulos | ✅ |
| 3    | Modelos y datos mock (semilla realista) | ✅ |
| 4    | Autenticación mock, guards y roles | ✅ |
| 5    | Layouts y dashboards (mecánico + cliente) | ✅ |
| 6    | Clientes y vehículos (con catálogo de marcas/modelos) | ✅ |
| 7    | Carga y visor de tarjeta de circulación (IndexedDB) | ✅ |
| 8    | Catálogo de repuestos y trabajos (34 ítems) | ✅ |
| 9    | Cotizaciones y cálculos (subtotales, impuestos, total en letras) | ✅ |
| 10   | Generación y vista previa del PDF (jsPDF + autotable) | ✅ |
| 11   | Entrega simulada por correo y WhatsApp | ✅ |
| 12   | Conversión de cotización a servicio (sin duplicados) | ✅ |
| 13   | Servicios e historial por vehículo | ✅ |
| 14   | Pruebas unitarias | ✅ |
| 15   | `ng build` sin errores | ✅ |

---

## 11. Verificación realizada

- `ng build` (**producción**, por defecto): **sin errores ni advertencias**.
- `ng build --configuration development`: correcto.
- Type-check de las pruebas (`tsc -p tsconfig.spec.json`): **sin errores**.
- Lógica de negocio ejecutada de forma aislada (subtotales, impuestos, total, total en
  letras): **12/12 aserciones correctas**.
- `npm test` requiere un navegador Chrome/Chromium instalado localmente.
