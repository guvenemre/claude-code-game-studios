/**
 * QuestionService — fetches questions from the backend, adapts them to the
 * game's schema, and maintains a pre-fetched queue so gates never wait on
 * the network.
 */
import type {
  GameProps,
  GameQuestion,
  BackendQuestion,
} from '../types/question';
import { QUESTION_CONFIG } from '../config/game-config';

// ---------------------------------------------------------------------------
// Adapter: BackendQuestion → GameQuestion
// ---------------------------------------------------------------------------

/** Map option id ("A","B","C","D") to a 0-based index. */
function optionIdToIndex(id: string, options: BackendQuestion['options']): number {
  const idx = options.findIndex((o) => o.id === id);
  return idx >= 0 ? idx : 0;
}

/** Flatten questionParts[] into a single prompt + latex string. */
function extractPromptAndLatex(parts: BackendQuestion['questionParts']): {
  prompt: string;
  latex: string;
} {
  const textParts = parts.filter((p) => p.type === 'text');
  if (textParts.length === 0) return { prompt: '', latex: '' };

  // If content contains $...$ or \\frac etc., treat it as latex-bearing.
  // Split into plain prompt and the latex expression.
  const raw = textParts.map((p) => p.content).join(' ');

  // Extract $..$ or $$...$$ blocks as latex
  const latexMatch = raw.match(/\$([^$]+)\$/);
  if (latexMatch) {
    const latex = latexMatch[1];
    const prompt = raw.replace(/\$[^$]+\$/, '').trim();
    return { prompt: prompt || 'Solve:', latex };
  }

  // No inline latex — use the whole text as prompt
  return { prompt: raw, latex: '' };
}

/** Flatten a BackendOption's parts into a single display string. */
function flattenOptionParts(parts: BackendQuestion['options'][0]['parts']): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => {
      // Strip wrapping $ signs so KaTeX renders cleanly
      const content = p.content.trim();
      if (content.startsWith('$') && content.endsWith('$')) {
        return content.slice(1, -1);
      }
      return content;
    })
    .join(' ');
}

/** Combine solutionSteps into a single reasoning string. */
function buildReasoning(steps?: BackendQuestion['solutionSteps']): string {
  if (!steps || steps.length === 0) return '';
  // Use the first step's reasoning + result for a concise explanation
  const first = steps[0];
  return `${first.reasoning} → ${first.result}`;
}

/** Convert a BackendQuestion to the game's GameQuestion format. */
export function adaptQuestion(bq: BackendQuestion): GameQuestion {
  const { prompt, latex } = extractPromptAndLatex(bq.questionParts);

  return {
    id: String(bq.id),
    prompt,
    latex,
    options: bq.options.map((o) => flattenOptionParts(o.parts)),
    correctIndex: optionIdToIndex(bq.correctAnswerId, bq.options),
    reasoning: buildReasoning(bq.solutionSteps),
    difficulty: bq.difficulty,
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

interface FetchQuestionsResponse {
  questions: BackendQuestion[];
  count: number;
}

/** Fetch a batch of questions from the backend with timeout + retry. */
async function fetchFromBackend(
  props: GameProps,
): Promise<BackendQuestion[]> {
  const url = new URL(`${QUESTION_CONFIG.API_BASE_URL}/admin/questions`);
  url.searchParams.set('appId', props.appId);
  url.searchParams.set('grade', String(props.grade));
  if (props.nodeCodes && props.nodeCodes.length > 0) {
    url.searchParams.set('nodeCodes', props.nodeCodes.join(','));
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= QUESTION_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        QUESTION_CONFIG.FETCH_TIMEOUT,
      );

      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Backend responded ${res.status}`);
      }

      const data: FetchQuestionsResponse = await res.json();

      // Filter to multiple_choice only and limit to batch size
      return data.questions
        .filter((q) => q.questionType === QUESTION_CONFIG.QUESTION_TYPE_FILTER)
        .slice(0, QUESTION_CONFIG.BATCH_SIZE);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Failed to fetch questions');
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface QuestionQueue {
  /** Initialize the queue — fetches the first batch. Call once at game start. */
  init: (props: GameProps) => Promise<void>;
  /** Get the next question. Returns null if queue is empty. */
  next: () => GameQuestion | null;
  /** Whether the queue has been initialized and has questions ready. */
  isReady: () => boolean;
  /** Number of questions remaining in the queue. */
  remaining: () => number;
}

/** Create a QuestionQueue instance. */
export function createQuestionQueue(): QuestionQueue {
  let queue: GameQuestion[] = [];
  let ready = false;
  let gameProps: GameProps | null = null;
  let refilling = false;

  /** Shuffle array in place (Fisher-Yates). */
  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Fetch and enqueue a batch. */
  async function fetchBatch(): Promise<void> {
    if (!gameProps) return;
    const raw = await fetchFromBackend(gameProps);
    const adapted = raw.map(adaptQuestion);
    shuffle(adapted);
    queue.push(...adapted);
  }

  /** Background refill — non-blocking, no error surfaced to caller. */
  async function maybeRefill(): Promise<void> {
    if (
      refilling ||
      !gameProps ||
      queue.length > QUESTION_CONFIG.REFILL_THRESHOLD
    ) {
      return;
    }
    refilling = true;
    try {
      await fetchBatch();
    } catch {
      // Silently fail — we still have questions in queue
    } finally {
      refilling = false;
    }
  }

  return {
    async init(props: GameProps): Promise<void> {
      gameProps = props;
      queue = [];
      ready = false;
      refilling = false;
      await fetchBatch();
      ready = queue.length > 0;
    },

    next(): GameQuestion | null {
      if (queue.length === 0) return null;
      const question = queue.shift()!;

      // Trigger background refill if running low
      maybeRefill();

      return question;
    },

    isReady(): boolean {
      return ready;
    },

    remaining(): number {
      return queue.length;
    },
  };
}
