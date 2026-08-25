# Assets de marca — FitPlan

Todo lo de esta carpeta y los assets de marca de `public/` se generan con:

```bash
node "brand&designs/_generar.mjs"
```

**No editar los archivos a mano** — se pisan al correr el script. Si hace falta
una variante nueva, se agrega al script.

## Paleta

Marca: **"FitPlan Volt"** (ver `DESIGN_SYSTEM.md`).

| | Valor | Uso |
|---|---|---|
| Lima | `#cbff3d` | El mark. Color de marca. |
| Negro | `#08090c` | Fondo. |
| Blanco | `#FFFFFF` | Monocromo sobre fondos oscuros o de color. |
| Tinta | `#0B1220` | Monocromo sobre fondos claros (impresión, ropa). |

El mark va en **lima sólido**, nunca en degradado: el trazo es delgado y
diagonal, y un degradado de tres paradas deja el color inicial fuera del área
pintada — el logo termina saliendo del color equivocado.

## Estructura

```
logo/          La marca sola, fondo transparente
  svg/         Fuente vectorial (lima, blanco, negro)
  png/         Export a 1024px
app-icons/     Íconos cuadrados de app y favicons (incluye favicon.ico)
redes/         Fotos de perfil por red, en transparente y sobre negro
  instagram/ tiktok/ x/ facebook/ linkedin/ youtube/ gmail/
  marca-de-agua-*.png    Para superponer en vídeo/imagen
ropa/          4000px monocromo, para estampado
colores/       Referencia de paleta
```

## Qué sirve la app

El script copia a `public/` los archivos que sirve el sitio (favicon, ícono
social para Open Graph, íconos de PWA). Están listados en `A_PUBLIC` dentro del
script, y se sobrescriben en cada corrida — así no pueden quedar desincronizados
con los entregables de marca, que es lo que pasaba antes cuando se copiaban a
mano.

## Antecedente de marca

El ícono anterior con forma de manzana fue **rechazado por TikTok** por posible
infracción de marca. No volver a usarlo. El mark actual ("la zancada", dos
trazos en tensión) no tiene ese problema.
