import type { Timestamp } from "firebase/firestore";

export interface RegistroPeso {
  fecha: string;
  peso: number;
  timestamp?: Timestamp | Date | { seconds: number; nanoseconds?: number } | number | null;
}

export interface PlanMultiFaseData {
  pesoInicial: number;
  pesoObjetivoFinal: number;
  mesActual: number;
  totalMeses: number;
  faseActual: "BULK" | "CUT" | "LEAN_BULK" | "MANTENIMIENTO";
  pesoMetaEsteMes: number;
  fases?: Array<{
    nombre: string;
    meses: number[];
    objetivoFase: string;
    pesoInicio: number;
    pesoFin: number;
  }>;
  historialMeses?: Array<{
    mesNumero: number;
    fechaGeneracion?: string;
    datosAlIniciar?: {
      peso: number;
      fechaRegistro?: string;
      cintura?: number;
    };
    datosAlFinalizar?: {
      peso?: number;
      fechaRegistro?: string;
      adherenciaComida: "<50%" | "50-70%" | "70-80%" | ">80%";
      adherenciaEntreno: "<50%" | "50-70%" | "70-80%" | ">80%";
      energia: "muy_baja" | "baja" | "normal" | "alta" | "muy_alta";
      recuperacion: "mala" | "regular" | "normal" | "buena" | "excelente";
    };
  }>;
}

export interface SavedPlan {
  id: string;
  userId: string;
  plan: {
    plan: Record<string, unknown>;
    user: Record<string, unknown>;
  };
  planMultiFase?: PlanMultiFaseData;
  createdAt: Timestamp;
  isOldest?: boolean;
  registrosPeso?: RegistroPeso[];
  completado?: boolean;
}
