# Plantillas de creatividades para redes

## `carrusel-ig.html` — carrusel de Instagram

Plantilla de referencia del formato aprobado para los posts de FitPlan AI.
Cualquier carrusel nuevo debe partir de este archivo y respetar su lenguaje
visual, cambiando solo el contenido.

### Especificaciones

- **Lienzo:** 1080 × 1350 px por diapositiva (formato 4:5, el que más superficie
  ocupa en el feed).
- **Exportación:** se renderiza a 2× (2160 × 2700). Se sube al doble a propósito:
  Instagram reescala hacia abajo y el texto queda más nítido que subiendo justo
  a 1080.
- **Número de diapositivas:** 5.

### Lenguaje visual

Sale del mundo de la hoja de registro del gimnasio: los números son la imagen.

| Elemento | Valor |
|---|---|
| Fondo | `#080E18` (tinta con sesgo azul) |
| Superficie | `#111B2B` |
| Pauta y filetes | `#1E2C42` |
| Acento de marca | `#3B82F6` |
| Señal de progreso | `#10B981` — **solo** para lo que cambia (incrementos, checks) |
| Texto secundario | `#7E90AB` |
| Texto principal | `#E8EEF7` |

- Pauta horizontal tenue cada 90 px y un filete vertical a 88 px del borde
  izquierdo: es el lomo del que cuelga todo el contenido.
- Titulares en grotesca del sistema, peso 800, interletraje muy cerrado
  (`-0.03em`). El gancho de la primera va en mayúsculas.
- **Todos los datos en monoespaciada** con `tabular-nums`: semanas, cargas,
  series, precios, índice de diapositiva. Es lo que ancla el diseño.
- Índice `01 / 05` arriba a la izquierda. La numeración es legítima porque un
  carrusel sí es una secuencia ordenada.

### Estructura de contenido (lo que hace que se comparta)

El orden no es estético, es estratégico: **el producto no aparece hasta la
cuarta diapositiva**.

1. **Gancho** — afirmación que para el scroll. Sin marca más allá del pie.
2. **El problema** — el dolor, ilustrado con una tabla de datos "muerta".
3. **El mecanismo** — la misma tabla, ahora viva, con los incrementos en verde.
4. **Qué incluye** — concreto y verificable.
5. **Cierre** — logo, precio real y URL.

Las tres primeras dan valor por sí solas. Eso es lo que permite que una cuenta
colaboradora lo comparta sin sentir que está haciendo de comercial ante su
propia audiencia.

### Reglas de copy

- Castellano peninsular, tuteo.
- Precios **siempre los reales** (`src/lib/stripePlanPrices.ts`). Nunca inventar
  una cifra más atractiva: una creatividad que no coincide con el checkout
  genera disputas de cobro y reseñas negativas.
- No anunciar funciones que no existen. Ejemplo concreto: **no hay panel para
  entrenadores externos** — el admin tiene un único email fijo en el código.
- Cerrar el pie con una pregunta contestable en pocas palabras. Los comentarios
  pesan mucho más que los likes, y nadie responde a una que exige un párrafo.

### Cómo exportar a PNG

Extraer cada `<section class="slide">` a un HTML independiente (reutilizando el
bloque de CSS de la plantilla) y renderizar con Chrome en modo headless:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1080,1350 \
  --screenshot=salida.png "file://$PWD/diapositiva.html"
```

Da PNG de 2160 × 2700 exactos. Es la vía fiable: pedirle al usuario que use
"Capture node screenshot" de las devtools resultó demasiado engorroso.
