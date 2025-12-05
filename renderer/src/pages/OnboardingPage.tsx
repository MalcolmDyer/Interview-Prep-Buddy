import React, { useState } from 'react';
import { ExperienceLevel, SessionRecord, SessionType, UserProfile } from '../../../shared/types';

interface Props {
  onStart: (profile: UserProfile) => void;
  lastSession: SessionRecord | null;
}

const domains = ['Software Engineering', 'Data Science', 'Product Management', 'Aerospace', 'Finance', 'Consulting'];
const sessionTypes: SessionType[] = ['behavioral', 'technical', 'mixed', 'quick_drill'];
const levels: ExperienceLevel[] = ['entry', 'mid', 'senior'];

export default function OnboardingPage({ onStart, lastSession }: Props) {
  const [domain, setDomain] = useState<string>(lastSession?.userProfile.domain || domains[0]);
  const [sessionType, setSessionType] = useState<SessionType>(lastSession?.userProfile.sessionType || 'technical');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    lastSession?.userProfile.experienceLevel || 'mid'
  );
  const [targetCompany, setTargetCompany] = useState<string>(lastSession?.userProfile.targetCompany || '');
  const lastSessionLabel = lastSession
    ? `${lastSession.userProfile.domain} · ${lastSession.userProfile.experienceLevel} · ${new Date(
        lastSession.updatedAt
      ).toLocaleDateString()}`
    : null;

  const canStart = domain.trim().length > 2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canStart) return;
    onStart({ domain, sessionType, experienceLevel, targetCompany: targetCompany.trim() || undefined });
  };

  return (
    <div className="card" style={{ maxWidth: 880, margin: '32px auto' }}>
      <div className="stack" style={{ gap: 6 }}>
        <div className="badge">Interview Prep Buddy</div>
        <h1>Set up your run</h1>
        <p className="muted-text">Pick the focus, level, and company. We’ll handle the questions and scoring.</p>
        {lastSessionLabel && <div className="badge">Last session: {lastSessionLabel}</div>}
      </div>

      <form onSubmit={handleSubmit} className="stack" style={{ marginTop: 22, gap: 16 }}>
        <div className="surface stack" style={{ gap: 12 }}>
          <label>Domain</label>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="surface">
          <div className="stack" style={{ gap: 10 }}>
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

        <div className="surface">
          <div className="stack" style={{ gap: 10 }}>
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
        </div>

        <div className="surface stack" style={{ gap: 10 }}>
          <label>Target company (optional)</label>
          <input
            type="text"
            placeholder="e.g., Stripe, SpaceX"
            value={targetCompany}
            onChange={(e) => setTargetCompany(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div className="muted-text">Proxy-backed AI. Just start and talk.</div>
          <button type="submit" disabled={!canStart}>
            Start session
          </button>
        </div>
      </form>
    </div>
  );
}
