import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/adminAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authResult = await requireAdmin(req);
    if (!authResult.ok) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    // Usar Firebase Admin SDK (bypass las reglas de Firestore)
    const db = getAdminDb();
    const auth = getAdminAuth();

    if (!db || !auth) {
      return res.status(500).json({
        error: "Firebase Admin SDK no configurado. Configura FIREBASE_ADMIN_PRIVATE_KEY y FIREBASE_ADMIN_CLIENT_EMAIL en las variables de entorno."
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId es requerido" });
    }

    // Verificar que no se está intentando eliminar al admin
    if (userId === authResult.uid) {
      return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
    }

    // Obtener datos del usuario antes de eliminarlo (para verificar email)
    const userRef = db.collection("usuarios").doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado en la base de datos" });
    }

    const userData = userDoc.data();
    const userEmail = userData?.email?.toLowerCase();
    
    // Verificar que no se elimine al admin
    if (userEmail === "admin@fitplan-ai.com") {
      return res.status(400).json({ error: "No se puede eliminar al usuario administrador" });
    }

    // 1. Eliminar todos los planes asociados al usuario.
    //
    // Va ANTES de borrar el usuario y su cuenta a propósito, y si falla se
    // aborta aquí. Antes el catch solo escribía en el log y seguía: se borraba
    // el usuario igual y sus planes quedaban con un `userId` que ya no existe
    // en ningún sitio. Eso es lo que produce los huérfanos del #5 — y mientras
    // pasaba, el panel recibía `success: true` (issue #12).
    //
    // Abortar deja todo como estaba, planes y usuario incluidos, así que el
    // admin puede reintentar sin haber dejado nada a medias.
    let planesBorrados = 0;
    try {
      const plansSnapshot = await db.collection("planes")
        .where("userId", "==", userId)
        .get();

      // `allSettled` y no `all`: con `all`, la primera eliminación que falla
      // oculta el resultado de todas las demás, así que no se puede decir
      // cuántas quedaron sin borrar ni cuántas sí se fueron.
      const resultados = await Promise.allSettled(plansSnapshot.docs.map(doc => doc.ref.delete()));
      const fallidas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      planesBorrados = resultados.length - fallidas.length;

      if (fallidas.length > 0) {
        console.error(`❌ ${fallidas.length}/${resultados.length} plan(es) de ${userId} no se pudieron borrar:`, fallidas[0].reason);
        return res.status(500).json({
          error: "No se pudieron borrar todos los planes del usuario",
          detail: `Fallaron ${fallidas.length} de ${resultados.length}. No se borró nada más: el usuario y su cuenta siguen existiendo, se puede reintentar.`,
          planesBorrados,
          planesFallidos: fallidas.length,
        });
      }
      console.log(`✅ ${planesBorrados} plan(es) eliminado(s)`);
    } catch (error) {
      console.error("Error al consultar o eliminar planes:", error);
      return res.status(500).json({
        error: "No se pudieron borrar los planes del usuario",
        detail: error instanceof Error ? error.message : "Error desconocido",
      });
    }

    // 2. Eliminar el documento del usuario en Firestore
    try {
      await userRef.delete();
      console.log("✅ Documento de usuario eliminado de Firestore");
    } catch (error) {
      console.error("Error al eliminar documento de usuario:", error);
      return res.status(500).json({ error: "Error al eliminar documento de usuario", detail: error instanceof Error ? error.message : "Error desconocido" });
    }

    // 3. Eliminar el usuario de Firebase Auth
    try {
      await auth.deleteUser(userId);
      console.log("✅ Usuario eliminado de Firebase Auth");
    } catch (error: unknown) {
      console.error("Error al eliminar usuario de Auth:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";

      // Que la cuenta ya no exista en Auth no es un fallo: el paso ya está
      // hecho. Pero se comprobaba con `errorMessage.includes("not found")`, y
      // firebase-admin no dice eso nunca — lanza el código `auth/user-not-found`
      // con el mensaje "There is no user record corresponding to the provided
      // identifier". Así que ese caso, el más común al reintentar un borrado a
      // medias, devolvía 500 después de haber borrado los planes y el documento.
      //
      // Es el error simétrico del #12: aquel informaba éxito habiendo fallado;
      // este informaba fallo habiendo funcionado. Se mira el código, que es el
      // contrato estable, y se deja el texto solo como red de seguridad.
      const codigo = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "";
      const cuentaYaNoExiste =
        codigo === "auth/user-not-found" || /no user record|not found/i.test(errorMessage);

      if (!cuentaYaNoExiste) {
        return res.status(500).json({ error: "Error al eliminar usuario de Auth", detail: errorMessage });
      }
      console.log("ℹ️ La cuenta ya no existía en Auth; el paso se da por hecho.");
    }

    return res.status(200).json({
      success: true,
      message: "Usuario eliminado correctamente",
      planesBorrados,
    });
  } catch (error: unknown) {
    console.error("Error al eliminar usuario:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ error: "Error al eliminar usuario", detail: message });
  }
}

