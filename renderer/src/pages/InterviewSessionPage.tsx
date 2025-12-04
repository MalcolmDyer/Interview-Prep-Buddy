import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feedback, QAResult, Question, SessionRecord } from '../../../shared/types';

interface Props {
  session: SessionRecord;
  onSaveResult: (result: QAResult) => void;
  onEndSession: () => void;
}

export default function InterviewSessionPage({ session, onSaveResult, onEndSession }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const canListen =
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const previousQuestions = useMemo(() => session.results.map((r: QAResult) => r.question), [session.results]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    }
    recognitionRef.current = null;
    setListening(false);
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

  const startListening = useCallback(() => {
    if (!canListen || listening) return;
    setSpeechError(null);
    const RecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!RecognitionCtor) return;
    stopListening();
    const recognition = new RecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) setAnswerText(transcript);
    };
    recognition.onerror = (event: any) => {
      setSpeechError(event.error ? `Voice input error: ${event.error}` : 'Voice input error');
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }, [canListen, listening, stopListening]);

  const loadQuestion = async () => {
    setLoadingQuestion(true);
    setError(null);
    setSpeechError(null);
    setModelOpen(false);
    if (canSpeak) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    stopListening();
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
    stopListening();
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
    loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    return () => {
      if (canSpeak) window.speechSynthesis.cancel();
      stopListening();
    };
  }, [canSpeak, stopListening]);

  const avgScore = useMemo(() => {
    if (!session.results.length) return null;
    const total = session.results.reduce((acc: number, r: QAResult) => acc + r.feedback.score, 0);
    return (total / session.results.length).toFixed(1);
  }, [session.results]);

  return (
    <div>
      <div className="top-bar">
        <div>
          <div className="badge">Live session</div>
          <h2>
            {session.userProfile.domain} · {session.userProfile.experienceLevel} · {session.userProfile.sessionType}
          </h2>
        </div>
        <div className="chip-row">
          {avgScore && <div className="badge">Avg: {avgScore}</div>}
          <button className="subtle-button" onClick={onEndSession}>End session</button>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <div className="section-title">
            <h3>Question</h3>
            <div className="chip-row">
              <button className="subtle-button" type="button" onClick={loadQuestion} disabled={loadingQuestion}>
                {loadingQuestion ? 'Generating…' : 'Next question'}
              </button>
              <button
                className="subtle-button"
                type="button"
                onClick={speakQuestion}
                disabled={!canSpeak || loadingQuestion || !currentQuestion || speaking}
              >
                {speaking ? 'Playing…' : 'Read aloud'}
              </button>
            </div>
          </div>
          <div className="list-card">
            {loadingQuestion && <div className="muted-text">Generating question…</div>}
            {!loadingQuestion && currentQuestion && <p style={{ fontSize: '1.1rem', lineHeight: 1.5 }}>{currentQuestion.text}</p>}
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Your answer</label>
            <textarea
              className="answer-box"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Draft your response here"
              disabled={loadingQuestion || evaluating}
            />
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleEvaluate} disabled={!answerText.trim() || evaluating || loadingQuestion}>
              {evaluating ? 'Scoring…' : 'Submit answer'}
            </button>
            <button type="button" className="subtle-button" onClick={() => setAnswerText('')} disabled={evaluating}>
              Clear
            </button>
            <button
              type="button"
              className="subtle-button"
              onClick={listening ? stopListening : startListening}
              disabled={!canListen || evaluating || loadingQuestion}
            >
              {listening ? 'Stop voice input' : 'Speak answer'}
            </button>
          </div>
          {speechError && (
            <div className="badge" style={{ background: 'rgba(248,113,113,0.12)', color: '#fecdd3' }}>
              {speechError}
            </div>
          )}
          {error && <div className="badge" style={{ background: 'rgba(248,113,113,0.12)', color: '#fecdd3' }}>{error}</div>}
        </div>

        <div className="card">
          <div className="section-title">
            <h3>Feedback</h3>
            <div className="badge">Live scoring</div>
          </div>

          {feedback ? (
            <div>
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
            </div>
          ) : (
            <div className="muted-text">Submit an answer to see scored feedback.</div>
          )}
        </div>
      </div>
    </div>
  );
}
