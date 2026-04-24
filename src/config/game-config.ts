/** Question service configuration. */
export const QUESTION_CONFIG = {
  /** Backend API base URL. */
  API_BASE_URL: 'https://haid34u2cv3qdxofq3zcdldvem0mpipp.lambda-url.us-east-1.on.aws',

  /** Number of questions to pre-fetch per batch. */
  BATCH_SIZE: 10,

  /** Refill the queue when it drops to this many remaining. */
  REFILL_THRESHOLD: 3,

  /** Only fetch this question type for now. */
  QUESTION_TYPE_FILTER: 'multiple_choice',

  /** Timeout for fetch requests in ms. */
  FETCH_TIMEOUT: 8000,

  /** Max retry attempts on fetch failure. */
  MAX_RETRIES: 2,
} as const;
