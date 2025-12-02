import { ApiKeyStatus, EvaluateAnswerParams, Feedback, GenerateQuestionParams, Question } from '../../shared/types';

declare global {
  interface Window {
    ipcApi: {
      generateQuestion: (params: GenerateQuestionParams) => Promise<Question>;
      evaluateAnswer: (params: EvaluateAnswerParams) => Promise<Feedback>;
      getApiKeyStatus: () => Promise<ApiKeyStatus>;
      saveApiKey: (apiKey: string) => Promise<void>;
    };
  }
}

export {};
