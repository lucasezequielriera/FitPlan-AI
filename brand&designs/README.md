# Marca FitPlan AI

Identidad basada en **la zancada**: dos masas en tensión, una que empuja y otra
que despega. Es un cuerpo en movimiento reducido a lo mínimo, sin dibujar a
nadie. El hueco entre las dos piezas forma un tercer trazo en negativo, y es lo
que hace la silueta reconocible.

Sustituye al icono de manzana anterior, que fue **rechazado por TikTok en
agosto de 2026 por posible infracción de marca** (parecido con Apple).

---

## Estructura

```
brand&designs/
  logo/svg/      Fuentes vectoriales — usar siempre estas para reescalar
  logo/png/      Símbolo suelto y lockups en mapa de bits
  app-icons/     Iconos de aplicación y favicons
  redes/         Fotos de perfil y marca de agua para vídeo
  ropa/          Alta resolución a una tinta, para estampación y bordado
  colores/       Paleta visual y tokens CSS
  _generar.mjs   Regenera todos los PNG desde los SVG
```

Para regenerar todo tras cambiar un SVG:

```bash
node "brand&designs/_generar.mjs"
```

---

## Qué archivo usar en cada sitio

| Dónde | Archivo |
|---|---|
| Favicon del navegador | `app-icons/favicon-16.png`, `-32`, `-48` |
| Logo sobre foto o color | `app-icons/icono-transparente-blanco-1024.png` |
| Logo suelto sin fondo | `app-icons/icono-transparente-gradiente-1024.png` · `-negro-` · `-pro-` |
| Icono en iOS | `app-icons/ios-1024.png` (App Store), `ios-180.png` (pantalla) |
| Icono en Android | `app-icons/android-512.png`, `android-192.png` |
| Perfil de Instagram y TikTok | `redes/perfil-400.png` |
| Marca de agua en vídeo | `redes/marca-de-agua-blanca-512.png` (fondo transparente) |
| Cabecera de la web, fondo oscuro | `logo/png/lockup-horizontal-oscuro.png` |
| Cabecera de la web, fondo claro | `logo/png/lockup-horizontal-claro.png` |
| Documentos y facturas | `logo/svg/zancada-negro.svg` |
| Camiseta oscura | `ropa/zancada-blanco-4000.png` |
| Camiseta clara | `ropa/zancada-negro-4000.png` |
| Bordado | `logo/svg/zancada-negro.svg` — el bordador necesita vector |

---

## Reglas de uso

**Espacio libre.** Deja alrededor del símbolo un margen igual a la mitad de su
altura. Es lo que evita que se ahogue junto a otros elementos.

**Tamaño mínimo.** 24 px de alto en pantalla, 12 mm impreso. Por debajo, las dos
piezas se juntan y se pierde el hueco en negativo, que es lo que la identifica.

**Una tinta para prenda.** En ropa se usa siempre plano, blanco o negro. El
gradiente es para pantalla: bordado no se puede reproducir y en serigrafía
encarece mucho.

**Iconos a sangre.** Los de , ,  y las
fotos de perfil son cuadrados opacos y sin esquinas redondeadas **a propósito**:
Apple rechaza iconos con transparencia porque el sistema aplica la máscara él
mismo, e Instagram recorta en círculo, así que un borde redondeado dejaría
huecos. Para poner el borde tú, usa .

**No hacer:** rotar el símbolo, cambiar la inclinación relativa de las dos
piezas, separarlas más, aplicar sombras o contornos, ni recolorearlo fuera de la
paleta.

---

## Color

La paleta completa, con su uso, está en `colores/paleta.png`. Los valores para
código están en `colores/tokens.css`.

**Principal** — azul, cian y verde sobre tinta. Es la de producto y contenido.

**Pro / Luxury** — obsidiana y champán. Pensada para el plan premium o una línea
de ropa, cuando quieras que se lea como algo más caro. Se activa con
`data-brand="pro"` en la raíz.

Una regla que conviene respetar: **el verde señal (`#10E5B0`) es solo para lo
que mejora** — incrementos de carga, objetivos cumplidos, progresión. Usado como
color decorativo pierde su valor de lectura inmediata, que es justo lo que lo
hace útil en los carruseles.

---

## Pendiente antes de invertir dinero

El símbolo **no tiene estudio de viabilidad de marca**. Antes de encargar
serigrafía, bordado o el registro de la marca, conviene:

1. Búsqueda inversa de imagen en Google y Yandex.
2. [TMview](https://www.tmdn.org/tmview/), clases **9** (software), **25** (ropa)
   y **41** (entrenamiento).
3. Estudio profesional con un agente de propiedad industrial (200-400 € en
   España).

Es la lección del icono anterior: salió más caro rehacerlo que haberlo
comprobado a tiempo.
