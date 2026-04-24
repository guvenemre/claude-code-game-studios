/**
 * useQuestionQueue — React hook that wraps the QuestionService.
 *
 * Usage:
 *   const { isReady, next, remaining, error } = useQuestionQueue({ appId, grade, nodeCodes });
 *
 * Initializes on mount (fetches first batch). Call next() at gate time
 * to get a GameQuestion synchronously — no await needed.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameProps, GameQuestion } from '../types/question';
import { createQuestionQueue, type QuestionQueue } from '../services/question-service';

export interface UseQuestionQueueResult {
  /** Whether the initial batch has loaded and questions are available. */
  isReady: boolean;
  /** Get the next question from the queue. Returns null if exhausted. */
  next: () => GameQuestion | null;
  /** Number of questions remaining in the queue. */
  remaining: number;
  /** Error message if initial fetch failed. */
  error: string | null;
}

export function useQuestionQueue(props: GameProps): UseQuestionQueueResult {
  const queueRef = useRef<QuestionQueue | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize on mount or when props change
  useEffect(() => {
    const queue = createQuestionQueue();
    queueRef.current = queue;
    setIsReady(false);
    setError(null);

    queue
      .init(props)
      .then(() => {
        setIsReady(queue.isReady());
        setRemaining(queue.remaining());
        if (!queue.isReady()) {
          setError('No questions available for this grade/standard.');
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to load questions: ${msg}`);
        setIsReady(false);
      });
  }, [props.appId, props.grade, props.nodeCodes?.join(',')]);

  const next = useCallback((): GameQuestion | null => {
    if (!queueRef.current) return null;
    const question = queueRef.current.next();
    setRemaining(queueRef.current.remaining());
    return question;
  }, []);

  return { isReady, next, remaining, error };
}
