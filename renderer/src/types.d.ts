import { EvaluateAnswerParams, Feedback, GenerateQuestionParams, Question } from '../../shared/types';

declare global {
  interface Window {
    ipcApi: {
      generateQuestion: (params: GenerateQuestionParams) => Promise<Question>;
      evaluateAnswer: (params: EvaluateAnswerParams) => Promise<Feedback>;
    };
  }
}

export {};
