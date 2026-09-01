# Notas para trabajar en este repo

Aplicativo del taller **Mundo Garage**: control de vehículos, clientes, cotizaciones y
servicios. Angular 18 (NgModule, sin componentes standalone) + Angular Material +
Supabase. Todo el texto de la interfaz va en español de Guatemala.

## Reglas que no son obvias mirando el código

- **La mano de obra nunca tiene costo base.** `computeItemCost` devuelve 0 para
  `type === 'labor'` aunque alguien escriba un costo. Si contara como gasto, la ganancia
  saldría más baja de lo real.
- **El anticipo se resta del total, no de la ganancia.** Es dinero del mismo trabajo que
  ya se cobró antes, no una rebaja.
- **El costo y la ganancia jamás llegan al cliente.** No es sólo que la pantalla los
  oculte: la función `portal_datos` del servidor no devuelve esas columnas.
- **Rótulos guatemaltecos al revés del código:** MARCA = Honda, **LÍNEA** = CR-V LX 4WD,
  **MODELO** = el año. En la base: `vehiculos.modelo` es el nombre del modelo,
  `vehiculos.linea` el texto largo del PDF, `vehiculos.anio` el año.
- **Las métricas sólo cuentan cotizaciones `accepted` o `converted`**, por la fecha de
  aceptación. La semana empieza el lunes.
- **El cliente entra sólo con su teléfono y sólo si tiene vehículos.** Es de sólo lectura:
  no crea, no edita, no borra. Ni siquiera su propio perfil — si pudiera cambiar su
  teléfono se dejaría fuera del sistema.

## Dónde tocar

- Lógica de negocio pura y con pruebas: `quotation.service.ts` (totales),
  `metrics.util.ts` (métricas), `number-to-words.util.ts` (cantidad con letra).
- Traducción base ↔ app: `core/services/mappers.ts`. Si cambia una columna, se cambia
  ahí y ninguna pantalla se entera.
- Esquema de la base: `supabase/schema.sql`. Es idempotente; se vuelve a correr entero.
- Puntos de corte responsivos: `responsive.service.ts` **y** `styles.scss` — hay que
  cambiar los dos.

## Antes de dar algo por terminado

```bash
npm run build      # sin errores
npm run test:ci    # 38/38
npm run audit:pdf  # mirar shots/cotizacion.png: el PDF es el entregable al cliente
```

Nunca versionar `node_modules`: trae binarios de macOS y rompe la compilación en Linux.
