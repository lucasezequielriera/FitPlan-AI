import { create } from "zustand";
import { PlanAIResponse, UserInput } from "@/types/plan";

interface PlanState {
  user?: UserInput;
  plan?: PlanAIResponse;
  planId?: string; // ID del plan en Firestore
  setUser: (user: UserInput) => void;
  setPlan: (plan: PlanAIResponse) => void;
  setPlanId: (planId: string | undefined) => void;
  reset: () => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  user: undefined,
  plan: undefined,
  planId: undefined,
  setUser: (user) => set({ user }),
  setPlan: (plan) => set({ plan }),
  setPlanId: (planId) => set({ planId }),
  reset: () => set({ user: undefined, plan: undefined, planId: undefined }),
}));

