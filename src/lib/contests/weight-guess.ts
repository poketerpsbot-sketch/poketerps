export const WEIGHT_GUESS_MAX_ATTEMPTS = 2;

export type WeightGuessAttempt = {
  attemptNumber: number;
  numericValue: number;
  unit: string;
  submittedAt: Date | string;
  updatedAt: Date | string;
};
