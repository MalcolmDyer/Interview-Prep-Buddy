import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feedback, QAResult, Question, SessionRecord } from '../../../shared/types';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

interface Props {
  session: SessionRecord;
  onSaveResult: (result: QAResult) => void;
  onEndSession: () => void;
}

export default function InterviewSessionPage({ session, onSaveResult, onEndSession }: Props) {
  const MIN_CHUNK_BYTES = 16000;
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [viewMode, setViewMode] = useState<'question' | 'feedback'>('question');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const pendingChunksRef = useRef<Array<{ blob: Blob; attempts: number }>>([]);
  const transcribingRef = useRef(false);

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const canRecord = typeof window !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  const previousQuestions = useMemo(() => session.results.map((r: QAResult) => r.question), [session.results]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop());
      activeStreamRef.current = null;
    }
    setRecording(false);
    transcribingRef.current = false;
  }, []);

  const speakQuestion = useCallback(() => {
    if (!canSpeak || !currentQuestion) return;
    setSpeechError(null);
    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(currentQuestion.text);
    utterance.lang = 'en-US';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechError('Unable to read question aloud.');
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [canSpeak, currentQuestion]);

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const drainTranscriptionQueue = useCallback(async () => {
    if (transcribingRef.current) return;
    if (!pendingChunksRef.current.length) return;

    let chunks: Blob[] = [];
    let size = 0;
    let attempt = 0;
    while (pendingChunksRef.current.length && size < MIN_CHUNK_BYTES) {
      const { blob, attempts } = pendingChunksRef.current.shift()!;
      attempt = Math.max(attempt, attempts);
      chunks.push(blob);
      size += blob.size;
    }
    if (!chunks.length) return;

    const blobType = chunks[0].type || 'audio/webm';
    const blob = new Blob(chunks, { type: blobType });
    transcribingRef.current = true;
    try {
      const buffer = await blob.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const transcript = await window.ipcApi.transcribeAudio({ audioBase64: base64, mimeType: blob.type });
      if (transcript) {
        setAnswerText((prev) => {
          if (!prev) return transcript.trim();
          return `${prev.trim()} ${transcript.trim()}`.trim();
        });
      }
    } catch (err) {
      console.error('Transcription error', err);
      const msg = err instanceof Error ? err.message : 'transcription failed';
      setSpeechError(`Voice input error: ${msg}`);
      // retry the same blob a couple times before giving up
      const nextAttempt = attempt + 1;
      if (nextAttempt <= 3) {
        pendingChunksRef.current.unshift({ blob, attempts: nextAttempt });
        setTimeout(() => drainTranscriptionQueue(), 800);
      }
    } finally {
      transcribingRef.current = false;
      if (pendingChunksRef.current.length) {
        drainTranscriptionQueue();
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!canRecord || recording) return;
    setSpeechError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      activeStreamRef.current = stream;
      pendingChunksRef.current = [];
      transcribingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          pendingChunksRef.current.push({ blob: event.data, attempts: 0 });
          drainTranscriptionQueue();
        }
      };

      recorder.onerror = (event) => {
        console.error('Recorder error', event);
        setSpeechError('Voice input error');
        stopRecording();
      };

      recorder.onstop = async () => {
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach((t) => t.stop());
          activeStreamRef.current = null;
        }
        drainTranscriptionQueue();
      };

      recorder.start(1500);
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error('Recording error', err);
      setSpeechError('Microphone unavailable');
      setRecording(false);
    }
  }, [canRecord, drainTranscriptionQueue, recording]);

  const loadQuestion = async () => {
    setLoadingQuestion(true);
    setError(null);
    setSpeechError(null);
    setModelOpen(false);
    setTextMode(false);
    setViewMode('question');
    if (canSpeak) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    stopRecording();
    try {
      const question = await window.ipcApi.generateQuestion({
        domain: session.userProfile.domain,
        experienceLevel: session.userProfile.experienceLevel,
        sessionType: session.userProfile.sessionType,
        previousQuestions
      });
      setCurrentQuestion(question);
      setAnswerText('');
      setFeedback(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const handleEvaluate = async () => {
    if (!currentQuestion || !answerText.trim()) return;
    stopRecording();
    setEvaluating(true);
    setError(null);
    try {
      const fb = await window.ipcApi.evaluateAnswer({
        question: currentQuestion,
        answerText,
        userProfile: session.userProfile
      });
      setFeedback(fb);
      onSaveResult({ question: currentQuestion, answerText, feedback: fb });
      setViewMode('feedback');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    setCurrentQuestion(null);
    setFeedback(null);
    setAnswerText('');
    setViewMode('question');
    loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    return () => {
      if (canSpeak) window.speechSynthesis.cancel();
      stopRecording();
    };
  }, [canSpeak, stopRecording]);

  const avgScore = useMemo(() => {
    if (!session.results.length) return null;
    const total = session.results.reduce((acc: number, r: QAResult) => acc + r.feedback.score, 0);
    return (total / session.results.length).toFixed(1);
  }, [session.results]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="section-title">
          <div className="stack" style={{ gap: 6 }}>
            <div className="badge">Live session</div>
            <h2>
              {session.userProfile.domain} · {session.userProfile.experienceLevel} · {session.userProfile.sessionType}
            </h2>
          </div>
          <div className="chip-row">
            {avgScore && <div className="badge">Avg: {avgScore}</div>}
            <button className="subtle-button" onClick={onEndSession}>End Session</button>
          </div>
        </div>
      </div>

      {viewMode === 'question' && (
        <div className="card stack fade-in-card" style={{ gap: 12 }}>
          <div className="section-title">
            <h3>Question</h3>
            <div className="chip-row">
              <button className="subtle-button" type="button" onClick={loadQuestion} disabled={loadingQuestion}>
                {loadingQuestion ? 'Next up…' : 'Next question'}
              </button>
            </div>
          </div>
          <div className="surface" style={{ position: 'relative', paddingBottom: 64 }}>
            {loadingQuestion && <div className="muted-text">Generating question…</div>}
            {!loadingQuestion && currentQuestion && <p style={{ fontSize: '1.08rem', lineHeight: 1.55 }}>{currentQuestion.text}</p>}
            <button
              className="subtle-button"
              type="button"
              onClick={speakQuestion}
              disabled={!canSpeak || loadingQuestion || !currentQuestion || speaking}
              style={{ position: 'absolute', right: 12, bottom: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
            >
              {speaking ? 'Reading…' : 'Read aloud'}
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>{textMode ? 'Type your answer' : 'Voice answer'}</label>
            {!textMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="surface" style={{ minHeight: 80 }}>
                  {answerText ? (
                    <p style={{ margin: 0 }}>{answerText}</p>
                  ) : (
                    <div className="muted-text">Speak to capture your answer. Transcription will appear here.</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    disabled={!canRecord || evaluating || loadingQuestion}
                  >
                    {recording ? 'Recording…' : 'Start microphone'}
                  </button>
                  <button
                    type="button"
                    className="subtle-button"
                    onClick={() => {
                      stopRecording();
                      setTextMode(true);
                    }}
                    disabled={evaluating}
                  >
                    Type answer instead
                  </button>
                </div>
              </div>
            )}
            {textMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  className="answer-box"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Draft your response here"
                  disabled={loadingQuestion || evaluating}
                />
                <button
                  type="button"
                  className="subtle-button"
                  onClick={() => {
                    stopRecording();
                    setTextMode(false);
                  }}
                  disabled={evaluating}
                >
                  Use microphone
                </button>
              </div>
            )}
          </div>

          <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleEvaluate} disabled={!answerText.trim() || evaluating || loadingQuestion}>
              {evaluating ? 'Scoring…' : 'Submit answer'}
            </button>
            <button type="button" className="subtle-button" onClick={() => setAnswerText('')} disabled={evaluating}>
              Clear
            </button>
          </div>
          {speechError && (
            <div className="badge" style={{ background: 'rgba(248,113,113,0.12)', color: '#fecdd3' }}>
              {speechError}
            </div>
          )}
          {error && <div className="badge" style={{ background: 'rgba(248,113,113,0.12)', color: '#fecdd3' }}>{error}</div>}
        </div>
      )}

      {viewMode === 'feedback' && feedback && (
        <div className="card stack fade-in-card" style={{ gap: 12 }}>
          <div className="section-title">
            <h3>Feedback</h3>
            <div className="badge">Live scoring</div>
          </div>

          <div className="score-card">
            <div className="score-label">Score</div>
            <div className="score-value">{feedback.score}</div>
            <div className="score-out-of">/ 10</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4>Strengths</h4>
            <ul className="feedback-list">
              {feedback.strengths.map((s: string, idx: number) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 12 }}>
            <h4>Improvements</h4>
            <ul className="feedback-list">
              {feedback.improvements.map((s: string, idx: number) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 14 }}>
            <button className="subtle-button" type="button" onClick={() => setModelOpen((v) => !v)}>
              {modelOpen ? 'Hide model answer' : 'Show model answer'}
            </button>
            {modelOpen && <div className="model-answer">{feedback.modelAnswer}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={loadQuestion}
              disabled={loadingQuestion}
              style={{ alignSelf: 'flex-end' }}
            >
              {loadingQuestion ? 'Loading…' : 'Next question'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
