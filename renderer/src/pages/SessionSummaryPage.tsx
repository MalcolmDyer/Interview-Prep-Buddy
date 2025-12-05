import React, { useMemo, useState } from 'react';
import { QAResult, SessionRecord } from '../../../shared/types';

interface Props {
  session: SessionRecord;
  onRestart: () => void;
}

function QAItem({ item }: { item: QAResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="surface stack" style={{ gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <strong>{item.question.text}</strong>
          <div className="muted-text">Score: {item.feedback.score} / 10</div>
        </div>
        <button className="subtle-button" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Review'}
        </button>
      </div>
      {open && (
        <div className="model-answer stack" style={{ gap: 10, marginTop: 4 }}>
          <div>
            <strong>Your answer</strong>
            <p className="muted-text">{item.answerText}</p>
          </div>
          <div>
            <strong>Strengths</strong>
            <ul className="feedback-list">
              {item.feedback.strengths.map((s: string, idx: number) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Improvements</strong>
            <ul className="feedback-list">
              {item.feedback.improvements.map((s: string, idx: number) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Model answer</strong>
            <p>{item.feedback.modelAnswer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionSummaryPage({ session, onRestart }: Props) {
  const average = useMemo(() => {
    if (!session.results.length) return 'N/A';
    const total = session.results.reduce((acc: number, r: QAResult) => acc + r.feedback.score, 0);
    return (total / session.results.length).toFixed(1);
  }, [session.results]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="section-title">
          <div className="stack" style={{ gap: 6 }}>
            <div className="badge">Session summary</div>
            <h2>
              {session.userProfile.domain} · {session.userProfile.experienceLevel} · {session.userProfile.sessionType}
            </h2>
            <div className="muted-text">{session.results.length} questions answered</div>
          </div>
          <button onClick={onRestart}>Start new</button>
        </div>
      </div>

      <div className="split">
        <div className="card stack" style={{ gap: 12 }}>
          <div className="section-title">
            <h3>Scores</h3>
            <div className="badge">Avg / timeline</div>
          </div>
          <div className="score-card">
            <div className="score-label">Average score</div>
            <div className="score-value">{average}</div>
            <div className="score-out-of">/ 10</div>
          </div>

          <div className="grid-metrics" style={{ marginTop: 10 }}>
            <div className="metric">
              <strong>Started</strong>
              <span className="muted-text">{new Date(session.startedAt).toLocaleString()}</span>
            </div>
            <div className="metric">
              <strong>Last activity</strong>
              <span className="muted-text">{new Date(session.updatedAt).toLocaleString()}</span>
            </div>
            <div className="metric">
              <strong>Target</strong>
              <span className="muted-text">{session.userProfile.targetCompany || 'Not specified'}</span>
            </div>
          </div>
        </div>

        <div className="card stack" style={{ gap: 12 }}>
          <div className="section-title">
            <h3>Review</h3>
            <div className="badge">Q/A</div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {session.results.length === 0 && <div className="muted-text">No answered questions yet.</div>}
            {session.results.map((result: QAResult) => (
              <QAItem key={result.question.id} item={result} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
