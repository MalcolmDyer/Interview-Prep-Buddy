import React, { useEffect, useMemo, useState } from 'react';
import { ApiKeyStatus, QAResult, SessionRecord, UserProfile } from '../../shared/types';
import OnboardingPage from './pages/OnboardingPage';
import InterviewSessionPage from './pages/InterviewSessionPage';
import SessionSummaryPage from './pages/SessionSummaryPage';

const STORAGE_KEY = 'ipb_sessions';

type View = 'onboarding' | 'session' | 'summary';

function readSessions(): SessionRecord[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSessions(sessions: SessionRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function createSession(profile: UserProfile): SessionRecord {
  const now = Date.now();
  return {
    id: makeId(),
    userProfile: profile,
    results: [],
    startedAt: now,
    updatedAt: now
  };
}

export default function App() {
  const [sessions, setSessions] = useState<SessionRecord[]>(() => readSessions());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => sessions[0]?.id ?? null);
  const [view, setView] = useState<View>(() => (sessions[0] ? 'session' : 'onboarding'));
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({ hasKey: false });
  const [loadingKeyStatus, setLoadingKeyStatus] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    persistSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await window.ipcApi.getApiKeyStatus();
        setApiKeyStatus(status);
      } catch (err) {
        setKeyError((err as Error).message);
      } finally {
        setLoadingKeyStatus(false);
      }
    };
    fetchStatus();
  }, []);

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === currentSessionId) || null,
    [sessions, currentSessionId]
  );

  const handleStart = (profile: UserProfile) => {
    const newSession = createSession(profile);
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setView('session');
  };

  const handleSaveResult = (sessionId: string, result: QAResult) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, results: [...session.results, result], updatedAt: Date.now() }
          : session
      )
    );
  };

  const handleEndSession = () => {
    setView('summary');
  };

  const handleRestart = () => {
    setCurrentSessionId(null);
    setView('onboarding');
  };

  const handleApiKeySave = async (apiKey: string) => {
    await window.ipcApi.saveApiKey(apiKey);
    setApiKeyStatus({ hasKey: true });
  };

  return (
    <div className="layout">
      {view === 'onboarding' && (
        <OnboardingPage
          onStart={handleStart}
          lastSession={sessions[0] ?? null}
          apiKeyStatus={apiKeyStatus}
          onSaveApiKey={handleApiKeySave}
          loadingKeyStatus={loadingKeyStatus}
          keyError={keyError}
        />
      )}

      {view === 'session' && currentSession && (
        <InterviewSessionPage
          session={currentSession}
          onSaveResult={(result) => handleSaveResult(currentSession.id, result)}
          onEndSession={handleEndSession}
        />
      )}

      {view === 'summary' && currentSession && (
        <SessionSummaryPage session={currentSession} onRestart={handleRestart} />
      )}
    </div>
  );
}
