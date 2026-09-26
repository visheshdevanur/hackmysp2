'use client';

const dimensions = [['Share/session', 'share'], ['GitHub/review', 'github'], ['PRI quiz', 'pri'], ['Speaking', 'speaking'], ['Overall', 'overall']];
const center = { x: 180, y: 135 };
const angles = dimensions.map((_, index) => -Math.PI / 2 + index * (Math.PI * 2 / dimensions.length));
function point(value, angle, radius = 82) {
  const distance = radius * Math.max(0, Math.min(100, value || 0)) / 100;
  return `${center.x + Math.cos(angle) * distance},${center.y + Math.sin(angle) * distance}`;
}

export default function CandidateRadar({ scores }) {
  const polygon = dimensions.map(([, key], index) => point(scores?.[key], angles[index])).join(' ');
  return <div className="candidate-radar-wrap"><svg className="candidate-radar" viewBox="0 0 360 270" role="img" aria-label="Candidate assessment score radar chart">
    {[20, 40, 60, 80, 100].map(value => <polygon key={value} points={angles.map(angle => point(value, angle)).join(' ')} className="radar-grid"/>)}
    {angles.map((angle, index) => <line key={index} x1={center.x} y1={center.y} x2={center.x + Math.cos(angle) * 82} y2={center.y + Math.sin(angle) * 82} className="radar-axis"/>)}
    <polygon points={polygon} className="radar-value"/>
    {dimensions.map(([label, key], index) => {
      const x = center.x + Math.cos(angles[index]) * 112;
      const y = center.y + Math.sin(angles[index]) * 112;
      return <text key={key} x={x} y={y} textAnchor="middle" className="radar-label">{label}{scores?.[key] == null ? ' ·' : ` ${scores[key]}`}</text>;
    })}
  </svg><p>Scale 0–100. Missing assessments sit at the chart center and are marked pending; they are not failing scores. “Overall” is provisional until all four assessments are complete.</p></div>;
}
