import { contextBridge, ipcRenderer } from 'electron';
import { ApiKeyStatus, EvaluateAnswerParams, Feedback, GenerateQuestionParams, Question } from '../shared/types';

contextBridge.exposeInMainWorld('ipcApi', {
  generateQuestion: (params: GenerateQuestionParams): Promise<Question> => ipcRenderer.invoke('ai:generateQuestion', params),
  evaluateAnswer: (params: EvaluateAnswerParams): Promise<Feedback> => ipcRenderer.invoke('ai:evaluateAnswer', params),
  getApiKeyStatus: (): Promise<ApiKeyStatus> => ipcRenderer.invoke('config:getStatus'),
  saveApiKey: (apiKey: string): Promise<void> => ipcRenderer.invoke('config:saveKey', apiKey)
});
