import { create } from "zustand";
import { PlanAIResponse, UserInput, PlanMultiFase } from "@/types/plan";

interface PlanState {
  user?: UserInput;
  plan?: PlanAIResponse;
  planId?: string; // ID del plan en Firestore
  planMultiFase?: PlanMultiFase; // Plan multi-fase (bulk_cut, lean_bulk)
  setUser: (user: UserInput) => void;
  setPlan: (plan: PlanAIResponse) => void;
  setPlanId: (planId: string | undefined) => void;
  setPlanMultiFase: (planMultiFase: PlanMultiFase | undefined) => void;
  reset: () => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  user: undefined,
  plan: undefined,
  planId: undefined,
  planMultiFase: undefined,
  setUser: (user) => set({ user }),
  setPlan: (plan) => set({ plan }),
  setPlanId: (planId) => set({ planId }),
  setPlanMultiFase: (planMultiFase) => set({ planMultiFase }),
  reset: () => set({ user: undefined, plan: undefined, planId: undefined, planMultiFase: undefined }),
}));

