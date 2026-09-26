'use client';

function parse(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; }
}

export default function SessionEvidence({ session }) {
  const report = parse(session?.analysisJson);
  if (!session) return <p className="real-muted">This submission has no recorded challenge session.</p>;
  return <section className="session-evidence">
    <div className="session-report-head"><b>Recorded challenge assessment</b><span>AI feedback supports human review; it does not make the hiring decision.</span></div>
    {report ? <>
      <p>{report.summary}</p>
      <div className="session-dimensions">{(report.dimensions || []).map((item,index)=><article key={`${item.name}-${index}`}><b>{item.name}</b><strong>{item.score}<small>/100</small></strong><span>Confidence: {item.confidence}</span>{(item.evidence||[]).map((e,i)=><small key={i}>Segment {e.segmentIndex+1} · {Math.floor(e.timestampSeconds/60)}:{String(e.timestampSeconds%60).padStart(2,'0')} · {e.observation}</small>)}</article>)}</div>
      <h4>Strengths</h4><ul>{(report.strengths||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><h4>Development areas</h4><ul>{(report.improvements||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
    </> : <p className="real-muted">{session.analysisError || 'AI analysis is being prepared.'}</p>}
    <div className="session-recordings">{[...new Set((session.recordings||[]).map(item=>item.segmentIndex))].sort((a,b)=>a-b).map(index=><video key={index} controls preload="metadata" src={`/api/work-sessions/${encodeURIComponent(session.id)}/recordings/${index}`} aria-label={`Challenge recording segment ${index+1}`}/>)}</div>
  </section>;
}
