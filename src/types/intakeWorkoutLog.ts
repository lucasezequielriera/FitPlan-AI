export type IntakeWorkoutSetLog = {
  kg: number | null;
  restAfterSec: number | null;
  /** Reps in reserve por serie (0 = al fallo / muy duro, 4 = muy fácil). Ausente en datos antiguos. */
  rir?: number | null;
};

export type IntakeWorkoutExerciseLog = {
  exerciseIndex: number;
  exerciseName: string;
  sets: IntakeWorkoutSetLog[];
  /** Nota libre del cliente para este ejercicio en esta sesión. */
  note?: string | null;
};

export type IntakeWorkoutSession = {
  id: string;
  planId: string;
  weekIndex: number;
  dayIndex: number;
  dayLabel: string;
  completedOn: string;
  exercises: IntakeWorkoutExerciseLog[];
  updatedAt: string | null;
};
