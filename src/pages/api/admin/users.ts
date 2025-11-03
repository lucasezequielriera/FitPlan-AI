import type { NextApiRequest, NextApiResponse } from "next";

// NOTA: Este API route no puede funcionar correctamente porque el SDK del cliente de Firebase
// en el servidor no tiene contexto de autenticación. Las reglas de Firestore requieren 
// request.auth que no está disponible en el servidor.
// 
// La solución es que el cliente lea directamente desde Firestore, que es lo que el código
// ya intenta hacer primero. Este API route solo se usa como fallback si la lectura directa falla.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Este endpoint no puede funcionar desde el servidor sin Firebase Admin SDK
  // El cliente debe leer directamente desde Firestore
  return res.status(501).json({ 
    error: "Este endpoint requiere que el cliente lea directamente desde Firestore. Por favor actualiza las reglas de Firestore en Firebase Console para permitir que los administradores lean la colección 'usuarios'." 
  });
}

