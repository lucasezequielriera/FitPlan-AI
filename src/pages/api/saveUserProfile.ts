import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe } from "@/lib/firebase";
import { collection, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { sendTelegramMessage, formatNewUserMessage } from "@/lib/telegram";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  const db = getDbSafe();
  if (!db) return res.status(501).json({ error: "Firestore no configurado" });
  
  // Obtener userId del body en lugar de auth.currentUser (ya que estamos en el servidor)
  const { userId, nombre, sexo, alturaCm, edad, peso } = req.body;
  
  if (!userId) {
    return res.status(401).json({ error: "Usuario no autenticado" });
  }
  
  if (!nombre || !sexo || !alturaCm || !edad) {
    return res.status(400).json({ error: "Faltan datos requeridos: nombre, sexo, alturaCm, edad" });
  }
  
  try {
    const userRef = doc(collection(db, "usuarios"), userId);
    
    // Verificar si ya existe el perfil
    const userDoc = await getDoc(userRef);
    
    const userData: Record<string, unknown> = {
      nombre,
      sexo,
      alturaCm: Number(alturaCm),
      edad: Number(edad),
      updatedAt: serverTimestamp(),
    };

    // Agregar peso si está presente
    if (peso !== undefined && peso !== null) {
      userData.peso = Number(peso);
    }
    
    if (!userDoc.exists()) {
      // Crear nuevo perfil
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
      });
      
      // Enviar notificación a Telegram si es un nuevo usuario (no bloqueante)
      try {
        const userDocForNotification = await getDoc(userRef);
        const userDataForNotification = userDocForNotification.data();
        
        const message = formatNewUserMessage({
          nombre: nombre || null,
          email: userDataForNotification?.email || null,
          createdAt: userDataForNotification?.createdAt?.toDate?.() || userDataForNotification?.createdAt || new Date(),
          ciudad: userDataForNotification?.ciudad || null,
          pais: userDataForNotification?.pais || null,
        });
        
        await sendTelegramMessage(message).catch((err) => {
          console.warn("⚠️ Error al enviar notificación de nuevo usuario a Telegram:", err);
        });
      } catch (telegramError) {
        console.warn("⚠️ Error al enviar notificación de nuevo usuario a Telegram:", telegramError);
      }
      
      res.status(200).json({ message: "Perfil creado", created: true });
    } else {
      // Actualizar perfil existente
      await setDoc(userRef, userData, { merge: true });
      res.status(200).json({ message: "Perfil actualizado", created: false });
    }
  } catch (e) {
    console.error("Error al guardar perfil:", e);
    res.status(500).json({ error: "No se pudo guardar el perfil" });
  }
}

