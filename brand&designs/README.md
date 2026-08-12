# Marca FitPlan

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
| Icono en iOS | `app-icons/ios-1024.png` (App Store), `ios-180.png` (pantalla) |
| Icono en Android | `app-icons/android-512.png`, `android-192.png` |
| Perfil de Instagram y TikTok | `redes/perfil-400.png` (claro y pro disponibles) |
| Marca de agua en vídeo | `redes/marca-de-agua-blanca-1024.png` |
| Logo sobre foto o color plano | `app-icons/icono-transparente-blanco-1024.png` |
| Logo suelto sin fondo | `app-icons/icono-transparente-gradiente-1024.png`, `-negro-`, `-pro-` |
| Icono con borde redondeado propio | `app-icons/icono-redondeado-1024.png` |
| Cabecera de la web, fondo oscuro | `logo/png/lockup-h-oscuro.png` |
| Cabecera de la web, fondo claro | `logo/png/lockup-h-claro.png` |
| Cabecera sobre imagen | `logo/png/lockup-h-blanco-transp.png` |
| Lockup apilado | `logo/png/lockup-v-oscuro.png`, `-claro`, `-blanco-transp` |
| Documentos y facturas | `logo/svg/marca-negro.svg` |
| Camiseta oscura | `ropa/marca-blanco-4000.png` |
| Camiseta clara | `ropa/marca-negro-4000.png` |
| Bordado | `logo/svg/marca-negro.svg` — el bordador necesita vector |

---

## Fotos de perfil

En `redes/perfiles/` hay 20 archivos: cuatro tamaños por cinco variantes.

| Tamaño | Para qué |
|---|---|
| `instagram-1000` | Máximo que acepta Instagram. El que conviene subir |
| `instagram-400` | Suficiente si la plataforma comprime igualmente |
| `gmail-whatsapp-500` | Cuenta de Google, Gmail y WhatsApp Business |
| `gmail-minimo-250` | Mínimo que acepta Google |

Variantes: `opaco-oscuro` (la recomendada), `opaco-claro`, `opaco-pro`,
`transparente-gradiente` y `transparente-blanco`.

**Usa las opacas.** Instagram, Gmail y WhatsApp aplanan la imagen al subirla y
le ponen un fondo que tú no eliges — normalmente blanco o negro según dónde se
muestre. Una foto de perfil transparente acaba con un fondo imprevisible o
con el logo apenas visible. Las transparentes están ahí por si las necesitas
para montar algo encima de una foto, no para subirlas como avatar.

---

## Reglas de uso

**Espacio libre.** Deja alrededor del símbolo un margen igual a la mitad de su
altura. Es lo que evita que se ahogue junto a otros elementos.

**Tamaño mínimo.** 24 px de alto en pantalla, 12 mm impreso. Por debajo, las dos
piezas se juntan y se pierde el hueco en negativo, que es lo que la identifica.

**Una tinta para prenda.** En ropa se usa siempre plano, blanco o negro. El
gradiente es para pantalla: bordado no se puede reproducir y en serigrafía
encarece mucho.

**Iconos a sangre.** Los de `app-icons/ios-*`, `android-*`, `favicon-*` y las
fotos de perfil son cuadrados opacos y sin esquinas redondeadas **a propósito**:
Apple rechaza iconos con transparencia porque el sistema aplica la máscara él
mismo, e Instagram recorta la foto de perfil en círculo, así que un borde
redondeado dejaría huecos. Cuando el borde lo tengas que poner tú (dentro de la
web, por ejemplo), usa `app-icons/icono-redondeado-1024.png`.

**Transparencia.** Todo lo que lleva `transparente` o `transp` en el nombre, más
`logo/png/marca-*`, `redes/marca-de-agua-*` y `ropa/*`, viene con fondo
transparente. Los demás son opacos por diseño, no por descuido.

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
