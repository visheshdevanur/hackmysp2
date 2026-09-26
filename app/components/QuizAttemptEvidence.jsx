'use client';

export default function QuizAttemptEvidence({ credential }) {
  if (!credential) return null;
  const events = credential.quizIntegrityEvents || [];
  const timings = credential.quizQuestionTimings || [];
  const status = credential.quizAttemptStatus || (credential.quizSubmittedAt ? 'completed' : 'not started');
  return <section className="review-evidence quiz-attempt-evidence">
    <b>PRI quiz monitoring · <span className={status === 'failed' ? 'quiz-failed' : ''}>{status.replace('_', ' ')}</span></b>
    {events.length > 0 && <div role="alert"><strong>Integrity flag:</strong> {events.map((event, i) => <span key={i}> {event.type.replaceAll('_', ' ')} · {new Date(event.occurredAt).toLocaleString()}{event.questionIndex != null ? ` · question ${event.questionIndex + 1}` : ''}</span>)}</div>}
    {timings.length > 0 && <p>Time per question: {timings.map(item => `Q${item.questionIndex + 1} ${item.elapsedSeconds}s`).join(' · ')}</p>}
    {credential.quizRecordings?.length > 0 && <video controls preload="metadata" src={`/api/credentials/${encodeURIComponent(credential.id)}/quiz/recordings/0`} />}
    {credential.quizScore != null && <p>Quiz score: {credential.quizScore}%</p>}
    {credential.speakingStatus && credential.speakingStatus !== 'ready' && <div className="speaking-dashboard-evidence"><b>Speaking round · {credential.speakingStatus.replace('_', ' ')}</b>{credential.speakingData?.integrityEvents?.length>0&&<div role="alert">Integrity alert: {credential.speakingData.integrityEvents.map(event=>`${event.type.replaceAll('_',' ')} · ${new Date(event.occurredAt).toLocaleString()}`).join(' · ')}</div>}{credential.speakingData?.question1&&<p>Q1: {credential.speakingData.question1}</p>}{credential.speakingData?.question2&&<p>Q2: {credential.speakingData.question2}</p>}{credential.speakingData?.questionTimings?.length > 0 && <p>Answer times: {credential.speakingData.questionTimings.map(item => `Q${item.questionIndex + 1} ${item.elapsedSeconds}s`).join(' · ')}</p>}{[1, 2].filter(segment => credential.quizRecordings?.some(item => item.segmentIndex === segment)).map(segment => <video key={segment} controls preload="metadata" src={`/api/credentials/${encodeURIComponent(credential.id)}/quiz/recordings/${segment}`} />)}{credential.speakingResult && <><p>AI assessment: {credential.speakingResult.overallScore}/100 · {credential.speakingResult.overallSummary}</p>{credential.speakingResult.answers?.map((answer, i) => <article className="speaking-answer-report" key={i}><b>Answer {i + 1} transcript</b><blockquote>{answer.transcript || 'No clear spoken answer was detected.'}</blockquote><small>Knowledge {answer.roleKnowledge} · Relevance {answer.relevance} · Communication {answer.communicationClarity} · Organization {answer.organization}</small></article>)}</>}</div>}
  </section>;
}
