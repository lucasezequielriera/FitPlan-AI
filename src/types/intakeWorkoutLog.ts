export type IntakeWorkoutSetLog = {
  kg: number | null;
  restAfterSec: number | null;
};

export type IntakeWorkoutExerciseLog = {
  exerciseIndex: number;
  exerciseName: string;
  sets: IntakeWorkoutSetLog[];
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
