export type PresenceStatus = "STUDYING" | "ON_BREAK" | "AWAY";

export interface DailyGoal {
  id: string;
  userId: string;
  description: string;
  completed: boolean;
  date: string;
}
