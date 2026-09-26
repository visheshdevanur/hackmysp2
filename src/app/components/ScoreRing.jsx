'use client';

export default function ScoreRing({ value, label, size = 72, showLabel = true }) {
  const numeric = value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : null;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = numeric == null ? circumference : circumference * (1 - numeric / 100);
  return <span className="score-ring-wrap" style={{ width: size }} title={label ? `${label}: ${numeric ?? 'Not scored'}${numeric == null ? '' : '/100'}` : undefined}>
    <svg className="score-ring" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${label || 'Score'}: ${numeric == null ? 'not scored' : `${Math.round(numeric)} out of 100`}`}>
      <circle className="score-ring-track" cx="50" cy="50" r={radius}/>
      <circle className="score-ring-value" cx="50" cy="50" r={radius} strokeDasharray={circumference} strokeDashoffset={offset}/>
      <text className="score-ring-number" x="50" y="54" textAnchor="middle">{numeric == null ? '—' : Math.round(numeric)}</text>
    </svg>
    {showLabel && label && <small className="score-ring-label">{label}</small>}
  </span>;
}
