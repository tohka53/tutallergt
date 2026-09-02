# Mundo Garage

Aplicación web para el control del taller: clientes, vehículos, cotizaciones con PDF,
órdenes de servicio con evidencia fotográfica y métricas de costo y ganancia.

Angular 18 (NgModule) + Angular Material + **Supabase** (Postgres, Auth y Storage).

---

## 1. Cómo entra cada quien

| Quién | Cómo entra | Qué puede hacer |
|-------|-----------|-----------------|
| **Taller** | Correo + contraseña (Supabase Auth) | Todo: clientes, vehículos, cotizaciones, servicios, costos, ganancias, configuración |
| **Cliente** | Sólo su número de teléfono, sin contraseña | Ver sus vehículos, sus cotizaciones y el avance de su servicio. **Sólo lectura** |

Reglas del acceso del cliente:

- El teléfono es único: dos clientes activos no pueden tener el mismo número.
- **Si el cliente no tiene vehículos registrados, no puede entrar.** El sistema se lo dice
  con esas palabras, para que sepa que debe pedirle al taller que registre su vehículo.
- El cliente **nunca** ve el costo del repuesto ni la ganancia. Eso ni siquiera sale del
  servidor: la función `portal_datos` no devuelve esas columnas.

El teléfono es una credencial débil a propósito —quien lo sepa puede ver el historial de
ese vehículo—, y por eso el portal del cliente es de sólo lectura y no muestra dinero del
taller. El panel del taller, que sí muestra costos y ganancias, exige contraseña.

---

## 2. Puesta en marcha

### 2.1 Base de datos

1. Entrar al proyecto de Supabase → **SQL Editor** → **New query**.
2. Pegar todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecutarlo.
   Es idempotente: se puede volver a correr sin romper nada.

Reutiliza las tablas que ya existían (`profiles`, `vehiculos`, `servicios`) agregándoles
columnas, y crea las que faltaban: `clientes`, `cotizaciones`, `cotizacion_items`,
`catalogo_items`, `servicio_fotos`, `taller_config` y `correlativos`.

### 2.2 La cuenta del taller

**Authentication → Users → Add user**, con correo y contraseña, y marcando
*Auto Confirm User*. Un disparador crea sola la fila en `profiles`.

No hay pantalla de registro dentro de la app a propósito: un registro abierto en la web
dejaría que cualquiera se hiciera "mecánico" con sólo abrir el enlace.

### 2.3 La app

```bash
npm install
npm start          # http://localhost:4200
npm run build      # producción
```

La primera vez que entra el taller se copia solo un catálogo de 34 repuestos y trabajos,
con costo y precio sugeridos, que después se puede editar desde **Catálogo**.

### 2.4 Primer uso, en orden

1. Entrar como taller.
2. **Clientes → Nuevo cliente**: el teléfono es obligatorio, es su llave de acceso.
3. **Vehículos → Nuevo vehículo** y asignárselo a ese cliente.
4. Desde ese momento el cliente ya puede entrar con su número. En la ficha del cliente
   aparece un aviso que dice si ya puede entrar o qué le falta.

---

## 3. Costos, precios y ganancia

Cada línea de la cotización lleva **dos** números:

| Campo | Qué es | ¿Lo ve el cliente? |
|-------|--------|--------------------|
| **Costo** | Lo que el taller paga por el repuesto | No |
| **Precio** | Lo que se le cobra al cliente | Sí |

La **mano de obra no tiene costo base**: no se compra en ningún lado, es tiempo del
taller. El sistema fuerza su costo a cero aunque alguien escriba otra cosa; si contara
como gasto, la ganancia saldría más baja de lo que realmente es.

```
subtotal  = repuestos + mano de obra (ya con descuentos)
costTotal = suma de (cantidad × costo) de los repuestos
ganancia  = subtotal − costTotal
total     = subtotal − anticipo        ← la cifra grande del PDF
```

El **anticipo** se resta del total pero **no** de la ganancia: es dinero del mismo
trabajo que ya se cobró antes, no una rebaja.

En el formulario y en el detalle de la cotización, todo lo que tiene que ver con costos
va dentro de un recuadro con borde punteado y un candado que dice *"Sólo para ti · no
sale en el PDF"*. En el PDF y en el portal del cliente sólo aparece el precio.

---

## 4. El PDF y el envío por WhatsApp

`QuotationPdfService` reproduce el formato en papel de Mundo Garage: logo, cuadro
No./FECHA, la banda **COTIZACIÓN PARA**, la fila NOMBRE / NIT / PLACA, la fila
MARCA / LÍNEA / MODELO / C.C., la tabla y abajo SUBTOTAL, ANTICIPO, TOTAL y la cantidad
con letra.

> Ojo con los rótulos, porque en Guatemala se usan al revés que en el código:
> **MARCA** = Honda · **LÍNEA** = CR-V LX 4WD · **MODELO** = el año.
> En la base, `vehiculos.modelo` es el nombre del modelo, `vehiculos.linea` el texto
> largo que sale en el PDF y `vehiculos.anio` el año.

El botón **Enviar cotización** del detalle hace cosas distintas según dónde estés:

- **Teléfono o tablet**: abre el selector del sistema con el **PDF ya adjunto** y el
  mensaje escrito. Eliges WhatsApp y sólo te queda darle enviar.
- **Computadora**: copia la cotización **como imagen al portapapeles**, abre WhatsApp Web
  con el mensaje escrito y descarga el PDF. En WhatsApp basta pegar con `⌘V` / `Ctrl+V`:
  la imagen se manda junto con el mensaje.

### Por qué imagen y no PDF en la computadora

Un enlace `wa.me` sólo transporta **texto**; no existe forma de adjuntarle un archivo. Y
el portapapeles del navegador admite muy pocos formatos: **PNG sí, PDF no**. Así que la
imagen es la única manera de que la cotización viaje dentro del mismo mensaje sin salir
del navegador. El PDF se descarga igual, por si se prefiere adjuntarlo a mano.

La imagen se obtiene **rasterizando el PDF ya generado** (`QuotationImageService`, con
pdf.js), no dibujando la cotización otra vez: así la imagen y el PDF no pueden
desincronizarse nunca. El worker de pdf.js se copia a `assets/` desde `angular.json`, y la
librería entra por importación dinámica en su propio chunk (~83 kB comprimido) que sólo se
descarga en computadora y sólo al abrir el detalle de una cotización.

Si de verdad hiciera falta que el mensaje **se enviara solo** con el PDF adjunto, el único
camino es la **WhatsApp Business API** (cuenta de Meta Business, número verificado,
plantillas aprobadas, un servidor y costo por conversación). No hay atajo desde el
navegador.

El mensaje dice *"Hola {nombre}, tu cotización para {marca} {línea} {año} (placa
{placa})"*, con el número y el total.

Cuatro cosas que hacen esto más delicado de lo que parece, y que ya están resueltas.
**Si vas a tocar `quotation-delivery.service.ts`, léelas primero**: cada una costó una
vuelta de depuración.

1. **En la computadora no se usa el selector del sistema aunque el navegador lo tenga.**
   Chrome de macOS y de Windows implementan `navigator.share` con archivos, pero abren el
   panel de compartir del sistema operativo — y ahí **WhatsApp no aparece**. Por eso
   `esDispositivoTactil()` decide el camino: si no es táctil, WhatsApp Web y punto. Ojo:
   esa detección **no** protege del modo dispositivo de DevTools, que miente a propósito;
   para probar el camino de escritorio hay que salirse de la emulación.
2. **El orden en la computadora importa**: primero se copia la imagen y después se abre
   WhatsApp. El navegador exige que el documento tenga el foco para escribir en el
   portapapeles, y abrir la otra pestaña se lo quita.
3. **Se abre con `<a target="_blank">`, no con `window.open`.** Una ventana emergente
   puede quedar bloqueada en silencio: sin error y sin pestaña. Un clic sobre un enlace es
   navegación normal. (Si alguien vuelve a `window.open`: nunca pasarle `'noopener'`, con
   esa opción devuelve `null` aunque la ventana abra bien.)
4. **El PDF y la imagen se preparan al cargar la pantalla**, no al hacer clic, para que
   entre el clic y la llamada al navegador no haya ningún `await`. Y después de enviar, el
   bloque con el enlace a WhatsApp queda **siempre** a la vista: los modos de fallar se ven
   todos igual desde el código, así que un aviso condicionado a detectar el fallo no sirve.

Para ver cómo queda el PDF sin levantar la app:

```bash
npm run audit:pdf         # shots/cotizacion.pdf + .png
npm run audit:pdf:largo   # 22 líneas y anticipo: comprueba el salto de página
npm run audit:imagen      # shots/cotizacion-imagen.png: la que se pega en WhatsApp
```

---

## 5. Métricas

En **Métricas** (menú del taller) se ve, por día, semana, mes, mes anterior, últimos tres
meses o año:

- Cuántos **vehículos distintos** se trabajaron.
- Cuánto se **cobró**, cuánto se **gastó** en repuestos y cuánta **ganancia** quedó.
- El margen y la comparación contra el período anterior de la misma duración.
- Gráfica de ganancia por mes y de vehículos por día de la semana.
- Una tabla con el detalle vehículo por vehículo.

**Qué cuenta:** sólo las cotizaciones que el cliente **aceptó** (botón *"Cliente aceptó"*)
o que ya se pasaron a orden de servicio. Los borradores y las enviadas sin respuesta no
son trabajo hecho, y contarlas inflaría los números hasta volverlos inútiles.

**Con qué fecha:** la de aceptación; si no hay, la de la cotización. Interesa cuándo entró
el trabajo, no cuándo se escribió el papel.

La semana empieza el **lunes**.

---

## 6. Arquitectura

```
src/app/
├── core/services/          # Toda la lógica de datos
│   ├── supabase.service.ts     # Único cliente de Supabase + traducción de errores
│   ├── auth.service.ts         # Dos formas de entrar (taller / cliente)
│   ├── data-sync.service.ts    # Carga todo a memoria al entrar
│   ├── mappers.ts              # Filas de la base ↔ modelos de la app
│   ├── metrics.util.ts         # Cálculo de métricas (funciones puras)
│   ├── quotation.service.ts    # Totales, costos y ganancia (funciones puras)
│   ├── quotation-pdf.service.ts
│   └── quotation-delivery.service.ts
├── shared/                 # Material, pipes (gtq), utilidades responsivas
├── models/                 # Interfaces TypeScript
├── auth/                   # Login
├── dashboard/              # Panel del taller
├── metrics/                # Métricas
├── clients/ vehicles/ quotations/ workshop-services/ parts-catalog/ settings/
└── client-portal/          # Lo que ve el cliente
```

### Por qué todo se carga a memoria

`DataSyncService` trae de Supabase clientes, vehículos, catálogo, cotizaciones, servicios
y fotos de una sola vez al entrar. Un taller maneja cientos de registros, no millones, y
tenerlos en memoria permite que las pantallas busquen, filtren y calculen métricas sin
una consulta por cada tecla. Después de cada escritura, el servicio correspondiente
vuelve a leer su tabla, así que lo que se ve siempre viene del servidor.

### Sesión y arranque

`APP_INITIALIZER` (ver `app.module.ts`) espera a que Supabase termine de leer la sesión
**antes** de pintar la primera pantalla. Sin esa espera, los guards preguntarían "¿hay
sesión?" mientras todavía se está leyendo y sacarían al login a alguien ya conectado —
el clásico "me saca cada vez que recargo".

### Seguridad

La llave publicable (`sb_publishable_...`) viaja dentro del navegador: **no es un
secreto**. Lo que protege los datos son:

- **RLS** en todas las tablas: `mecanico_id = auth.uid()`. El taller sólo alcanza sus
  propias filas.
- El rol `anon` **no tiene permiso sobre ninguna tabla**. Lo único que puede ejecutar son
  `portal_login` y `portal_datos`, funciones `SECURITY DEFINER` que devuelven únicamente
  las filas del teléfono que reciben, sin costos ni ganancias.
- Los correlativos (`COT-0001`, `ORD-0001`) se generan en el servidor
  (`siguiente_correlativo`), no en el navegador, para que dos pestañas no choquen.

Esconder botones no es seguridad: `AuthorizationService` sólo evita mostrar acciones que
de todos modos fallarían.

### Archivos

| Bucket | Público | Qué guarda | Por qué |
|--------|---------|-----------|---------|
| `evidencias` | Sí | Fotos de las piezas | El cliente entra sin sesión y no puede firmar una URL. Las rutas llevan uuid y lo que contienen son fotos de piezas de carro |
| `documentos` | No | Tarjeta de circulación | Lleva datos personales del dueño: sólo el taller la abre, con enlace firmado que caduca en una hora |

Cada imagen se reduce a 1600 px de lado mayor y calidad JPEG 0.82 antes de subirla. El
mecánico usa el teléfono y cada foto pesa de 3 a 8 MB; sin reducir, el cliente con datos
móviles espera muchísimo. Reducida queda entre 20 y 100 KB. Si el canvas falla,
`downscaleImage` devuelve el archivo original: nunca se pierde la foto por optimizarla.

No se acepta HEIC/HEIF: Chrome y Firefox no lo dibujan, así que la foto se guardaría pero
el cliente vería un recuadro roto.

---

## 7. Pruebas

```bash
npm test           # interactivo (requiere Chrome)
npm run test:ci    # headless
```

38 pruebas. Cubren lo que puede salir mal en silencio: subtotales, el costo cero de la
mano de obra, la ganancia, el anticipo que no toca la ganancia, el total que no se va a
negativo, la cantidad en letras en los dos formatos, qué cotizaciones cuentan para las
métricas, la semana que empieza en lunes y el agrupado por vehículo.

Auditoría visual (necesita `npm i -D playwright`):

```bash
npm run build && npm run serve:dist   # en otra terminal
npm run audit:visual                  # capturas de todas las pantallas
npm run audit:dialogs                 # diálogos en móvil
npm run audit:mobile                  # scroll, teclado y menú lateral
npm run audit:pdf                     # el PDF de la cotización
npm run audit:imagen                  # la imagen que se pega en WhatsApp
```

Los scripts que recorren la app (`audit:visual`, `audit:dialogs`, `audit:mobile`,
`audit:photos`) necesitan una sesión válida de Supabase, así que hay que darles un correo
y una contraseña reales del taller.

---

## 8. Diseño adaptable

| Ancho | Comportamiento |
|-------|----------------|
| `< 1024px` | El menú lateral pasa a ser un cajón superpuesto; se cierra solo al navegar |
| `< 900px` | Cada fila de tabla se convierte en tarjeta; los formularios pasan a una columna |
| `640–900px` | Dos tarjetas por fila y formularios en dos columnas |
| `< 400px` | Tipografías y espaciados compactos |

`responsive.service.ts` es el punto único de verdad de los puntos de corte en TypeScript.
**Si cambias un valor ahí, cámbialo también en `styles.scss`.**

Las tablas se convierten en tarjetas con CSS: cada `<td>` lleva `data-label="..."` y la
celda principal `class="tc-cell-title"`. Como en móvil se oculta la cabecera, el
componente `<app-mobile-sort>` ofrece el ordenamiento en un desplegable.

Roboto y Material Icons se sirven desde los paquetes npm (`@fontsource/roboto`,
`material-icons`), no desde Google Fonts: la app funciona sin conexión y los iconos nunca
se ven como texto suelto.

---

## 9. Despliegue

`vercel.json` está configurado para Vercel: `npm ci`, `npm run build`, salida en
`dist/control-taller/browser` y reescrituras de SPA para que `/app/vehicles/xxx` no dé 404.

**Nunca versionar `node_modules`.** Un `node_modules` con binarios de macOS dentro del
repo hace que la compilación en Linux muera con `MODULE_NOT_FOUND` y el hosting siga
sirviendo el último despliegue que sí compiló — es decir, cambias el CSS y en producción
no se ve nada.
