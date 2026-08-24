import fs from "fs";
import path from "path";
import satori from "satori";
import sharp from "sharp";

/**
 * Renderiza las diapositivas del carrusel de Instagram en el servidor.
 *
 * Usa Satori (HTML/JSX -> SVG) y sharp (SVG -> PNG) en lugar de un navegador
 * headless: Chrome no está disponible en el entorno serverless de Vercel y
 * empaquetarlo dispararía el tamaño y el arranque en frío. La contrapartida es
 * que Satori solo entiende flexbox — nada de grid ni de <table> — así que las
 * tablas de registro se componen con filas flex.
 *
 * El diseño replica `marketing/plantillas/carrusel-ig.html`, que es el formato
 * aprobado. Ver su README para el porqué de cada decisión.
 */

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
/** Ancho útil dentro de los sangrados (132 izquierda, 88 derecha). */
const CONTENT_W = 860;
/** Se renderiza al doble y se deja que Instagram reescale: el texto queda más nítido. */
const SCALE = 2;

// Paleta "FitPlan Volt" (ver DESIGN_SYSTEM.md) — acento lima único en vez de
// la pareja azul/esmeralda anterior, negro neutro en vez de navy. `brand` y
// `signal` ya no son dos tonos distintos: se consolidan en el mismo acento
// lima, igual que el resto de la app pasó de "azul = marca, verde = éxito" a
// un único --accent. El logo (`Mark`, abajo) mantiene su gradiente real sin
// tocar — es el ícono de la app, fuera del alcance de este cambio de paleta.
const C = {
  ink: "#08090c",
  rule: "#242628",
  brand: "#cbff3d",
  signal: "#cbff3d",
  muted: "#9a9c98",
  paper: "#f5f7f2",
  body: "#c7c9c4",
  dead: "#6b6d6a",
};

function loadFont(file: string): Buffer {
  return fs.readFileSync(path.join(process.cwd(), "src/lib/socialContent/fonts", file));
}

type LoadedFont = { name: string; data: Buffer; weight: 400 | 800; style: "normal" };

let fontCache: LoadedFont[] | null = null;
async function getFonts(): Promise<LoadedFont[]> {
  if (fontCache) return fontCache;
  fontCache = [
    { name: "Inter", data: loadFont("inter-400.ttf"), weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: loadFont("inter-800.ttf"), weight: 800 as const, style: "normal" as const },
    { name: "Mono", data: loadFont("mono-400.ttf"), weight: 400 as const, style: "normal" as const },
  ];
  return fontCache;
}

/** Fila de una tabla de registro. `delta` en el acento de marca marca lo que cambia. */
export type LogRow = { week: string; sets: string; load: string; note?: string; delta?: string; dead?: boolean };

export type SlideSpec =
  | { kind: "hook"; index: number; total: number; headline: string; emphasis?: string; sub?: string }
  | { kind: "log"; index: number; total: number; title: string; columns: [string, string, string]; rows: LogRow[]; caption?: string; body?: string }
  | { kind: "list"; index: number; total: number; title: string; items: string[] }
  | { kind: "cta"; index: number; total: number; title: string; price?: string; url: string };

/**
 * Una diapositiva sin numerar. `Omit` a secas no sirve sobre una unión: al no
 * distribuirse, colapsaría las cuatro variantes en sus propiedades comunes y
 * se perderían `headline`, `title` y demás.
 */
export type SlideContent = SlideSpec extends infer T ? (T extends SlideSpec ? Omit<T, "index" | "total"> : never) : never;

/** La zancada: dos masas en tensión. Recuadro real del trazo: 150,264 750x608. */
const MARK_BOX = { x: 150, y: 264, w: 750, h: 608 };
const MARK_PATHS = [
  "M150 852 C 214 700, 318 566, 456 470 C 386 618, 336 742, 316 866 Z",
  "M556 872 C 636 662, 748 458, 900 264 C 852 500, 780 700, 690 872 Z",
];

function Mark({ size }: { size: number }) {
  // viewBox ajustado al trazo: así el logo queda centrado de verdad en su hueco
  // en lugar de heredar el descuadre del lienzo original.
  const h = (size * MARK_BOX.h) / MARK_BOX.w;
  return (
    <svg width={size} height={h} viewBox={`${MARK_BOX.x} ${MARK_BOX.y} ${MARK_BOX.w} ${MARK_BOX.h}`}>
      {MARK_PATHS.map((d) => (
        <path key={d} fill="#cbff3d" d={d} />
      ))}
    </svg>
  );
}

/** Pauta horizontal cada 90 px: la hoja de registro del gimnasio. */
function Grid() {
  const lines = [];
  for (let y = 90; y < SLIDE_H; y += 90) {
    lines.push(
      <div key={y} style={{ position: "absolute", left: 0, right: 0, top: y, height: 1, backgroundColor: C.rule, opacity: 0.5 }} />
    );
  }
  return <div style={{ position: "absolute", inset: 0, display: "flex" }}>{lines}</div>;
}

function Frame({ index, total, children }: { index: number; total: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.ink,
        fontFamily: "Inter",
        padding: "96px 88px 88px 132px",
        position: "relative",
      }}
    >
      <Grid />
      {/* Lomo vertical del que cuelga el contenido */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 88, width: 1, backgroundColor: C.rule }} />

      <div style={{ display: "flex", fontFamily: "Mono", fontSize: 26, letterSpacing: 4, color: C.muted }}>
        <span style={{ color: C.brand }}>{String(index).padStart(2, "0")}</span>
        <span style={{ marginLeft: 14 }}>/</span>
        <span style={{ marginLeft: 14 }}>{String(total).padStart(2, "0")}</span>
      </div>

      {children}

      <div style={{ display: "flex", alignItems: "center", fontFamily: "Mono", fontSize: 24, color: C.muted, letterSpacing: 1 }}>
        {index === 1 ? (
          <div style={{ display: "flex", marginRight: 20 }}>
            <Mark size={46} />
          </div>
        ) : null}
        <span>FITPLAN</span>
      </div>
    </div>
  );
}

const grow = { display: "flex", flexGrow: 1 } as const;

function LogTable({ columns, rows }: { columns: [string, string, string]; rows: LogRow[] }) {
  return (
    // Ancho fijo (1080 - 132 de sangrado izquierdo - 88 de derecho): sin él,
    // Satori no acota la fila y la nota de la derecha se sale del lienzo en
    // lugar de ajustar línea.
    <div style={{ display: "flex", flexDirection: "column", width: CONTENT_W, marginTop: 56, fontFamily: "Mono" }}>
      <div style={{ display: "flex", width: CONTENT_W, paddingBottom: 18, borderBottom: `1px solid ${C.rule}`, fontSize: 22, color: C.muted, letterSpacing: 2 }}>
        <div style={{ display: "flex", width: 150, flexShrink: 0 }}>{columns[0].toUpperCase()}</div>
        <div style={{ display: "flex", width: 250, flexShrink: 0 }}>{columns[1].toUpperCase()}</div>
        <div style={{ display: "flex", width: 250, flexShrink: 0 }}>{columns[2].toUpperCase()}</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", width: CONTENT_W, alignItems: "center", padding: "26px 0", borderBottom: `1px solid ${C.rule}` }}>
          {/* Anchos fijos y sin encoger: con flexGrow, una nota larga estrujaba
              la columna de carga y partía "40 kg" en dos líneas. */}
          <div style={{ display: "flex", width: 150, flexShrink: 0, fontSize: 38, color: r.dead ? C.dead : C.paper }}>{r.week}</div>
          <div style={{ display: "flex", width: 250, flexShrink: 0, fontSize: 38, color: r.dead ? C.dead : C.paper }}>{r.sets}</div>
          <div style={{ display: "flex", width: 250, flexShrink: 0, fontSize: 38, color: r.dead ? C.dead : C.paper }}>{r.load}</div>
          <div style={{ display: "flex", width: 210, flexShrink: 0, justifyContent: "flex-end" }}>
            {r.delta ? (
              <span style={{ fontSize: 30, color: C.signal }}>{r.delta}</span>
            ) : (
              <span style={{ fontSize: 22, color: C.muted, textAlign: "right" }}>{r.note || ""}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Tick() {
  return (
    <svg width={34} height={34} viewBox="0 0 24 24" style={{ marginTop: 6 }}>
      <path d="M4 12.5l5.5 5.5L20 6" fill="none" stroke={C.signal} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SlideBody(spec: SlideSpec) {
  if (spec.kind === "hook") {
    return (
      <Frame index={spec.index} total={spec.total}>
        <div style={grow} />
        <div style={{ display: "flex", flexWrap: "wrap", fontSize: 112, fontWeight: 800, lineHeight: 1.0, letterSpacing: -4, color: C.paper, textTransform: "uppercase" }}>
          <span>{spec.headline}</span>
          {spec.emphasis ? <span style={{ color: C.signal }}>{` ${spec.emphasis}`}</span> : null}
        </div>
        {spec.sub ? <div style={{ display: "flex", marginTop: 32, fontSize: 40, color: C.muted, maxWidth: 780 }}>{spec.sub}</div> : null}
        <div style={grow} />
      </Frame>
    );
  }

  if (spec.kind === "log") {
    return (
      <Frame index={spec.index} total={spec.total}>
        <div style={grow} />
        <div style={{ display: "flex", fontSize: 74, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5, color: C.paper, maxWidth: 840 }}>{spec.title}</div>
        <LogTable columns={spec.columns} rows={spec.rows} />
        {spec.caption ? <div style={{ display: "flex", marginTop: 44, fontSize: 38, fontWeight: 800, letterSpacing: -1, color: C.paper }}>{spec.caption}</div> : null}
        {spec.body ? <div style={{ display: "flex", marginTop: 40, fontSize: 34, lineHeight: 1.45, color: C.body, maxWidth: 820 }}>{spec.body}</div> : null}
        <div style={grow} />
      </Frame>
    );
  }

  if (spec.kind === "list") {
    return (
      <Frame index={spec.index} total={spec.total}>
        <div style={grow} />
        <div style={{ display: "flex", fontSize: 74, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5, color: C.paper, maxWidth: 840 }}>{spec.title}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 52 }}>
          {spec.items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", marginBottom: 30 }}>
              <Tick />
              <div style={{ display: "flex", marginLeft: 24, fontSize: 34, lineHeight: 1.3, color: C.paper, maxWidth: 760 }}>{item}</div>
            </div>
          ))}
        </div>
        <div style={grow} />
      </Frame>
    );
  }

  return (
    <Frame index={spec.index} total={spec.total}>
      <div style={grow} />
      <div style={{ display: "flex" }}>
        <Mark size={132} />
      </div>
      <div style={{ display: "flex", marginTop: 44, fontSize: 74, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5, color: C.paper, maxWidth: 840 }}>{spec.title}</div>
      {spec.price ? <div style={{ display: "flex", marginTop: 28, fontFamily: "Mono", fontSize: 34, color: C.signal }}>{spec.price}</div> : null}
      <div style={{ display: "flex", marginTop: 56, fontSize: 40, fontWeight: 800, color: C.brand }}>{spec.url}</div>
      <div style={grow} />
    </Frame>
  );
}

/** Renderiza una diapositiva a PNG (2160 x 2700). */
export async function renderSlide(spec: SlideSpec): Promise<Buffer> {
  const fonts = await getFonts();
  const svg = await satori(SlideBody(spec), { width: SLIDE_W, height: SLIDE_H, fonts });
  return sharp(Buffer.from(svg))
    .resize(SLIDE_W * SCALE, SLIDE_H * SCALE, { fit: "fill" })
    .png()
    .toBuffer();
}
