/** Props passed from the edukado.ai platform into the game component. */
export interface GameProps {
  appId: string;
  grade: number;
  nodeCodes?: string[];
}

/** The game's internal question representation — decoupled from backend schema. */
export interface GameQuestion {
  id: string;
  prompt: string;
  latex: string;
  options: string[];
  correctIndex: number;
  reasoning: string;
  difficulty?: string;
}

/** Backend question shape (subset we care about). */
export interface BackendQuestion {
  id: string;
  appId: string;
  questionType: string;
  questionParts: QuestionPart[];
  options: BackendOption[];
  correctAnswerId: string;
  difficulty?: string;
  grade?: number;
  solutionSteps?: SolutionStep[];
}

export interface QuestionPart {
  type: 'text' | 'image';
  content: string;
  alt?: string;
}

export interface BackendOption {
  id: string;
  parts: QuestionPart[];
}

export interface SolutionStep {
  stepNumber: number;
  description: string;
  reasoning: string;
  result: string;
}
