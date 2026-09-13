/**
 * Detección de planes huérfanos: documentos de `planes` cuyo `userId` ya no
 * existe ni en `usuarios` ni en Firebase Auth (issue #5).
 *
 * La lógica vive aquí y no en el endpoint porque es lo único de todo esto que
 * puede causar un daño irreversible. Un falso positivo borra el plan de alguien
 * que sí existe, y un plan no se puede reconstruir. Separada, se puede probar
 * sin montar Firestore.
 *
 * La regla que lo gobierna todo: **ante cualquier duda, NO es huérfano.** Si
 * una comprobación falla —la consulta a Auth revienta, la respuesta viene
 * incompleta— el plan se queda donde está. Perder un huérfano en la lista
 * cuesta un documento de más; incluirlo de menos cuesta el plan de un usuario.
 */

/** Lo mínimo que hace falta saber de un plan para decidir. */
export type PlanRef = {
  id: string;
  userId: string | null;
};

export type ClasificacionPlanes = {
  /** Su `userId` no existe ni en `usuarios` ni en Auth. Se puede borrar. */
  huerfanos: PlanRef[];
  /** No tienen `userId`, o lo tienen vacío. Tampoco sirven a nadie, pero se
   *  cuentan aparte: su causa es otra y su arreglo también. */
  sinDuenyo: PlanRef[];
  /** El resto: tienen dueño vivo. Nunca se tocan. */
  conDuenyo: number;
};

/**
 * Decide qué planes son huérfanos.
 *
 * @param planes           todos los planes a clasificar
 * @param usuariosVivos    UIDs con documento en `usuarios`
 * @param cuentasVivas     UIDs con cuenta en Auth
 * @param uidsComprobados  UIDs para los que la comprobación de Auth SÍ se pudo
 *                         completar. Un UID ausente de este conjunto significa
 *                         "no lo sé", y eso se trata como "tiene dueño".
 */
export function clasificarPlanes(
  planes: PlanRef[],
  usuariosVivos: ReadonlySet<string>,
  cuentasVivas: ReadonlySet<string>,
  uidsComprobados: ReadonlySet<string>
): ClasificacionPlanes {
  const huerfanos: PlanRef[] = [];
  const sinDuenyo: PlanRef[] = [];
  let conDuenyo = 0;

  for (const plan of planes) {
    const uid = (plan.userId || "").trim();

    if (!uid) {
      sinDuenyo.push(plan);
      continue;
    }

    // Basta con que exista en UNO de los dos sitios para no tocarlo.
    if (usuariosVivos.has(uid) || cuentasVivas.has(uid)) {
      conDuenyo += 1;
      continue;
    }

    // No aparece en ninguno — pero ¿llegamos a preguntar por él en Auth? Si la
    // consulta falló, "no está en la lista de vivos" no significa que no exista.
    // Es la diferencia entre "sé que no está" y "no lo sé", y confundirlas es
    // exactamente lo que borraría planes de gente real.
    if (!uidsComprobados.has(uid)) {
      conDuenyo += 1;
      continue;
    }

    huerfanos.push(plan);
  }

  return { huerfanos, sinDuenyo, conDuenyo };
}

/** Trocea una lista. `auth.getUsers` acepta 100 identificadores por llamada. */
export function trocear<T>(items: T[], tamanyo: number): T[][] {
  if (tamanyo < 1) throw new Error("El tamaño de lote tiene que ser al menos 1");
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamanyo) {
    lotes.push(items.slice(i, i + tamanyo));
  }
  return lotes;
}
