export interface GoalComponent {
  isCompleted(): boolean;
  getProgress(): number;
}

export class DailyGoal implements GoalComponent {
  private completed: boolean;

  public constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly roomId: string,
    public description: string,
    public readonly date: string,
    isCompleted = false
  ) {
    this.completed = isCompleted;
  }

  public isCompleted(): boolean {
    return this.completed;
  }

  public markComplete(): void {
    this.completed = true;
  }

  public getProgress(): number {
    return this.completed ? 1 : 0;
  }
}

export class CommitmentPlan {
  public constructor(
    public readonly memberId: string,
    private readonly goals: DailyGoal[] = []
  ) {}

  public addGoal(goal: DailyGoal): void {
    this.goals.push(goal);
  }

  public getProgress(): number {
    if (this.goals.length === 0) {
      return 0;
    }

    const totalProgress = this.goals.reduce(
      (progress, goal) => progress + goal.getProgress(),
      0
    );

    return totalProgress / this.goals.length;
  }

  public getGoals(): readonly DailyGoal[] {
    return this.goals;
  }
}

export class Member {
  public constructor(
    public readonly id: string,
    public readonly roomId: string,
    public readonly commitmentPlan: CommitmentPlan,
    public lastGoalCompletedDate: string | null = null
  ) {}

  public resetStreak(): void {
    this.lastGoalCompletedDate = null;
  }
}
