import type { NextApiRequest, NextApiResponse } from "next";
import { getDbSafe } from "@/lib/firebase";
import { collection, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { sendTelegramMessage, formatNewUserMessage } from "@/lib/telegram";
import { requireUser } from "@/lib/userAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  const db = getDbSafe();
  if (!db) return res.status(501).json({ error: "Firestore no configurado" });
  
  // La identidad sale del ID token verificado, NUNCA del cuerpo. El comentario
  // anterior decía que se tomaba del body "ya que estamos en el servidor", pero
  // eso solo comprobaba que el campo no estuviera vacío: con el UID de otra
  // persona se le podía sobrescribir el perfil —nombre, sexo, altura, edad,
  // peso— que además alimenta la generación de sus planes (issue #27).
  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: "Identidad no verificada" });
  const userId = auth.uid;

  const { nombre, sexo, alturaCm, edad, peso } = req.body;
  
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
    
    // Si es un nuevo usuario, intentar obtener y guardar la ubicación desde la IP del request
    if (!userDoc.exists()) {
      try {
        // Obtener la IP del cliente
        const forwarded = req.headers["x-forwarded-for"];
        const ip = forwarded 
          ? (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : forwarded[0])
          : req.headers["x-real-ip"] || req.socket.remoteAddress || "";
        
        const clientIp = typeof ip === "string" ? ip : (Array.isArray(ip) ? ip[0] : String(ip || req.socket.remoteAddress || ""));
        
        // Obtener ubicación usando ip-api.com
        let locationUrl = "http://ip-api.com/json/?fields=status,country,countryCode,city,regionName";
        if (clientIp && clientIp !== "unknown" && clientIp !== "::1" && typeof clientIp === "string" && !clientIp.startsWith("127.")) {
          locationUrl = `http://ip-api.com/json/${clientIp}?fields=status,country,countryCode,city,regionName`;
        }
        
        const locationResponse = await fetch(locationUrl);
        
        if (locationResponse.ok) {
          const locationData = await locationResponse.json();
          if (locationData.status === "success") {
            if (locationData.city) {
              userData.ciudad = locationData.city;
            }
            if (locationData.country) {
              userData.pais = locationData.country;
            }
            console.log("✅ Ubicación del usuario obtenida y guardada:", { ciudad: locationData.city, pais: locationData.country });
          }
        }
      } catch (locationError) {
        console.warn("⚠️ No se pudo obtener ubicación del usuario:", locationError);
        // No bloquear el registro si falla obtener la ubicación
      }
      
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

