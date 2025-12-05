import { contextBridge, ipcRenderer } from 'electron';
import { EvaluateAnswerParams, Feedback, GenerateQuestionParams, Question } from '../shared/types';

contextBridge.exposeInMainWorld('ipcApi', {
  generateQuestion: (params: GenerateQuestionParams): Promise<Question> => ipcRenderer.invoke('ai:generateQuestion', params),
  evaluateAnswer: (params: EvaluateAnswerParams): Promise<Feedback> => ipcRenderer.invoke('ai:evaluateAnswer', params),
  transcribeAudio: (payload: { audioBase64: string; mimeType?: string }): Promise<string> =>
    ipcRenderer.invoke('ai:transcribeAudio', payload)
});
