import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { randomUUID } from 'crypto';
import { GenerateQuestionParams, EvaluateAnswerParams, Feedback, Question } from '../shared/types';

const isDev = process.env.NODE_ENV === 'development';
const rendererDevUrl = 'http://localhost:5173';
const proxyBase = (process.env.AI_PROXY_URL || process.env.PROXY_BASE_URL || '').replace(/\/$/, '');

const domainGuides: Record<string, string> = {
  'software engineering':
    'Prioritize algorithms, systems thinking, code quality, debugging approach, trade-offs, and clear communication of complexity.',
  'data science': 'Emphasize statistical rigor, experiment design, data storytelling, and model evaluation clarity.',
  aerospace: 'Highlight safety, reliability, systems integration, verification/validation, and adherence to standards.',
  finance: 'Stress risk controls, quantitative rigor, regulatory awareness, and precision with data/figures.'
};

function getProxyBase(): string {
  if (!proxyBase) {
    throw new Error('AI proxy URL missing. Set AI_PROXY_URL or PROXY_BASE_URL (e.g., https://your-proxy.example.com).');
  }
  return proxyBase;
}

async function callChatCompletion(messages: Array<{ role: 'system' | 'user'; content: string }>, temperature = 0.4): Promise<string> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch(`${getProxyBase()}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
      response_format: { type: 'text' }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content: string | undefined = data.content || data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Proxy response missing content');
  }
  return content.trim();
}

async function transcribeAudio(audioBase64: string, mimeType?: string): Promise<string> {
  const response = await fetch(`${getProxyBase()}/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ audioBase64, mimeType })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transcription failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const text = data?.text;
  if (!text || typeof text !== 'string') {
    throw new Error('Transcription response missing text');
  }
  return text;
}

function parseFeedbackResponse(raw: string): Feedback {
  const cleaned = raw
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim();
  const match = cleaned.match(/\{[\\s\\S]*\}/);
  const target = match ? match[0] : cleaned;

  const parsed = JSON.parse(target) as Feedback;
  if (
    typeof parsed.score !== 'number' ||
    !Array.isArray(parsed.strengths) ||
    !Array.isArray(parsed.improvements) ||
    typeof parsed.modelAnswer !== 'string'
  ) {
    throw new Error('Invalid feedback structure');
  }
  return parsed;
}

function buildQuestionPrompt(params: GenerateQuestionParams): Array<{ role: 'system' | 'user'; content: string }> {
  const previousList = params.previousQuestions.map((q, idx) => `${idx + 1}. ${q.text}`).join('\n');
  const historyBlock = previousList ? `Avoid repeating these asked questions:\n${previousList}\n` : '';
  const tone = params.sessionType === 'behavioral' ? 'behavioral interview' : 'technical interview';
  const domainHint = domainGuides[params.domain.toLowerCase()] || '';

  const user = `You are an expert interviewer crafting a single ${tone} question.\nDomain: ${params.domain}.\nSeniority: ${params.experienceLevel}.\nSession type: ${params.sessionType}.\n${historyBlock}${domainHint ? `Domain guidance: ${domainHint}\n` : ''}Respond with one clear question sentence only.`;

  return [
    {
      role: 'system',
      content:
        'You generate realistic interview questions. Keep them concise, professional, and tuned to the seniority and domain. Do not include explanations, numbering, or follow-ups.'
    },
    { role: 'user', content: user }
  ];
}

function buildEvaluationPrompt({ question, answerText, userProfile }: EvaluateAnswerParams): Array<{ role: 'system' | 'user'; content: string }> {
  const rubric = `Score from 1-10 weighting: structure/clarity, correctness for technical domains, specificity and impact, domain-appropriate expectations for ${userProfile.experienceLevel}, conciseness without missing key info.`;
  const domainHint = domainGuides[question.domain.toLowerCase()] || '';

  const system = `You are a meticulous interviewer evaluating answers. Always respond ONLY with strict JSON: {"score":number,"strengths":[string],"improvements":[string],"modelAnswer":string}. No markdown.`;

  const user = `Question: ${question.text}\nDomain: ${question.domain}\nSeniority: ${question.experienceLevel}\nSession type: ${question.sessionType}\nTarget company: ${userProfile.targetCompany || 'N/A'}\n${domainHint ? `Domain guidance: ${domainHint}\n` : ''}Answer: ${answerText}\n${rubric}\nReturn JSON only.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

async function generateQuestion(params: GenerateQuestionParams): Promise<Question> {
  const prompt = buildQuestionPrompt(params);
  const text = await callChatCompletion(prompt, 0.7);
  return {
    id: randomUUID(),
    text,
    domain: params.domain,
    experienceLevel: params.experienceLevel,
    sessionType: params.sessionType,
    askedAt: Date.now()
  };
}

async function evaluateAnswer(params: EvaluateAnswerParams): Promise<Feedback> {
  const prompt = buildEvaluationPrompt(params);
  const response = await callChatCompletion(prompt, 0.2);

  try {
    return parseFeedbackResponse(response);
  } catch (err) {
    throw new Error(`Failed to parse evaluation JSON: ${(err as Error).message}`);
  }
}

async function createWindow(): Promise<BrowserWindow> {
  const preloadPath = isDev
    ? path.join(__dirname, 'preload-dev.js')
    : path.join(__dirname, 'preload.js');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    },
    title: 'Interview Prep Buddy',
    show: false
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    await win.loadURL(rendererDevUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    await win.loadFile(indexPath);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('ai:generateQuestion', async (_event, params: GenerateQuestionParams) => {
  return generateQuestion(params);
});

ipcMain.handle('ai:evaluateAnswer', async (_event, params: EvaluateAnswerParams) => {
  return evaluateAnswer(params);
});

ipcMain.handle('ai:transcribeAudio', async (_event, payload: { audioBase64: string; mimeType?: string }) => {
  return transcribeAudio(payload.audioBase64, payload.mimeType);
});
