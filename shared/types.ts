export type SessionType = 'behavioral' | 'technical' | 'mixed' | 'quick_drill';
export type ExperienceLevel = 'entry' | 'mid' | 'senior';

export interface UserProfile {
  domain: string;
  experienceLevel: ExperienceLevel;
  sessionType: SessionType;
  targetCompany?: string;
}

export interface Question {
  id: string;
  text: string;
  domain: string;
  experienceLevel: ExperienceLevel;
  sessionType: SessionType;
  askedAt: number;
}

export interface Feedback {
  score: number;
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
}

export interface QAResult {
  question: Question;
  answerText: string;
  feedback: Feedback;
}

export interface SessionRecord {
  id: string;
  userProfile: UserProfile;
  results: QAResult[];
  startedAt: number;
  updatedAt: number;
}

export interface GenerateQuestionParams {
  domain: string;
  experienceLevel: ExperienceLevel;
  sessionType: SessionType;
  previousQuestions: Question[];
}

export interface EvaluateAnswerParams {
  question: Question;
  answerText: string;
  userProfile: UserProfile;
}

export interface ApiKeyStatus {
  hasKey: boolean;
}
