import React, { useState } from 'react';
import { ApiKeyStatus, ExperienceLevel, SessionRecord, SessionType, UserProfile } from '../../../shared/types';

interface Props {
  onStart: (profile: UserProfile) => void;
  lastSession: SessionRecord | null;
  apiKeyStatus: ApiKeyStatus;
  onSaveApiKey: (apiKey: string) => Promise<void>;
  loadingKeyStatus: boolean;
  keyError: string | null;
}

const domains = ['Software Engineering', 'Data Science', 'Product Management', 'Aerospace', 'Finance', 'Consulting'];
const sessionTypes: SessionType[] = ['behavioral', 'technical', 'mixed', 'quick_drill'];
const levels: ExperienceLevel[] = ['entry', 'mid', 'senior'];

export default function OnboardingPage({ onStart, lastSession, apiKeyStatus, onSaveApiKey, loadingKeyStatus, keyError }: Props) {
  const [domain, setDomain] = useState<string>(lastSession?.userProfile.domain || domains[0]);
  const [sessionType, setSessionType] = useState<SessionType>(lastSession?.userProfile.sessionType || 'technical');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    lastSession?.userProfile.experienceLevel || 'mid'
  );
  const [targetCompany, setTargetCompany] = useState<string>(lastSession?.userProfile.targetCompany || '');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [localKeyError, setLocalKeyError] = useState<string | null>(null);
  const lastSessionLabel = lastSession
    ? `${lastSession.userProfile.domain} · ${lastSession.userProfile.experienceLevel} · ${new Date(
        lastSession.updatedAt
      ).toLocaleDateString()}`
    : null;

  const canStart = domain.trim().length > 2 && apiKeyStatus.hasKey;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canStart) return;
    onStart({ domain, sessionType, experienceLevel, targetCompany: targetCompany.trim() || undefined });
  };

  const handleKeySave = async () => {
    if (!apiKeyInput.trim() || apiKeyInput.trim().length < 10) {
      setLocalKeyError('Enter a valid API key.');
      return;
    }
    setSavingKey(true);
    setLocalKeyError(null);
    try {
      await onSaveApiKey(apiKeyInput.trim());
      setApiKeyInput('');
    } catch (err) {
      setLocalKeyError((err as Error).message);
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 820, margin: '40px auto' }}>
      <div className="section-title">
        <div>
          <div className="badge">Interview Prep Buddy</div>
          <h1>Design your interview run</h1>
          <p className="muted-text">Tailor the interviewer to your domain, seniority, and company target.</p>
        </div>
        {lastSessionLabel && <div className="badge">Last: {lastSessionLabel}</div>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">
          <h3>API key</h3>
          <div className="badge">{apiKeyStatus.hasKey ? 'Configured' : 'Required'}</div>
        </div>
        {loadingKeyStatus && <div className="muted-text">Checking key...</div>}
        {!loadingKeyStatus && (
          <>
            <p className="muted-text" style={{ marginTop: 0 }}>
              Store your OpenAI-compatible API key locally. It never leaves the main process.
            </p>
            {!apiKeyStatus.hasKey && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={handleKeySave} disabled={savingKey}>
                  {savingKey ? 'Saving…' : 'Save key'}
                </button>
              </div>
            )}
            {(localKeyError || keyError) && <div className="badge" style={{ background: 'rgba(248,113,113,0.12)', color: '#fecdd3' }}>{localKeyError || keyError}</div>}
            {apiKeyStatus.hasKey && <div className="muted-text">Key detected. You can start a session.</div>}
          </>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label>Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Seniority</label>
            <div className="pills">
              {levels.map((lvl) => (
                <div
                  key={lvl}
                  className={`pill ${experienceLevel === lvl ? 'active' : ''}`}
                  onClick={() => setExperienceLevel(lvl)}
                  role="button"
                >
                  {lvl}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <label>Session type</label>
          <div className="pills">
            {sessionTypes.map((type) => (
              <div
                key={type}
                className={`pill ${sessionType === type ? 'active' : ''}`}
                onClick={() => setSessionType(type)}
                role="button"
              >
                {type.replace('_', ' ')}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <label>Target company (optional)</label>
          <input
            type="text"
            placeholder="e.g., Stripe, SpaceX"
            value={targetCompany}
            onChange={(e) => setTargetCompany(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="muted-text">
            Your API key stays local and never leaves the app shell. Set it above if missing.
          </div>
          <button type="submit" disabled={!canStart}>
            {apiKeyStatus.hasKey ? 'Start session' : 'Add API key to start'}
          </button>
        </div>
      </form>
    </div>
  );
}
