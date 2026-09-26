'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, LoaderCircle, Mic, ShieldAlert, Video } from 'lucide-react';
import FaceMonitor from './FaceMonitor';
import ScoreRing from './ScoreRing';

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export default function SpeakingRound({ credentialId, onDone }) {
  const [attempt, setAttempt] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const media = useRef({ active: false, failed: false, streams: [], canvasStream: null, audio: null, raf: 0, recorder: null, uploadChain: Promise.resolve(), segment: 1 });
  const base = `/api/credentials/${encodeURIComponent(credentialId)}/speaking`;

  const releaseTracks = useCallback(() => {
    const state = media.current;
    cancelAnimationFrame(state.raf);
    for (const stream of state.streams) stream.getTracks().forEach(track => track.stop());
    state.canvasStream?.getTracks().forEach(track => track.stop());
    try { state.audio?.close(); } catch {}
    state.active = false;
    setRecording(false);
  }, []);

  const fail = useCallback(async reason => {
    const state = media.current;
    if (!state.active || state.failed) return;
    state.failed = true; state.active = false;
    try { await api(`${base}/integrity`, { ...post({ reason }), keepalive: true }); } catch {}
    try { if (state.recorder?.state === 'recording') state.recorder.stop(); } catch {}
    releaseTracks();
    setAttempt(previous => ({ ...previous, status: 'failed', error: reason === 'tab_hidden' ? 'The speaking round failed because the quiz tab was left.' : 'The speaking round failed because required recording stopped.' }));
  }, [base, releaseTracks]);

  useEffect(() => {
    let live = true;
    api(`/api/credentials/${encodeURIComponent(credentialId)}/speaking`).then(data => { if (live) setAttempt(data); }).catch(err => { if (live) setError(err.message); });
    return () => {
      live = false;
      if (media.current.active && !media.current.failed) fetch(`${base}/integrity`, { ...post({ reason: 'capture_interrupted' }), keepalive: true }).catch(() => {});
      try { if (media.current.recorder?.state === 'recording') media.current.recorder.stop(); } catch {}
      releaseTracks();
    };
  }, [credentialId, base, releaseTracks]);

  useEffect(() => {
    if (attempt?.status !== 'analyzing') return;
    const poll = setInterval(async () => {
      try { const status = await api(`/api/credentials/${encodeURIComponent(credentialId)}/speaking`); if (['completed', 'timed_out', 'failed'].includes(status.status)) setAttempt(status); } catch {}
    }, 3000);
    return () => clearInterval(poll);
  }, [attempt?.status, credentialId]);

  const uploadRecorderSegment = useCallback((stream, segmentIndex) => {
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 900_000 });
    media.current.recorder = recorder;
    let chunkIndex = 0;
    recorder.ondataavailable = event => {
      if (!event.data?.size) return;
      const task = media.current.uploadChain.then(async () => {
        const response = await fetch(`/api/credentials/${encodeURIComponent(credentialId)}/quiz/recordings?segment=${segmentIndex}&chunk=${chunkIndex++}`, { method: 'POST', headers: { 'Content-Type': 'video/webm' }, body: event.data });
        if (!response.ok) throw new Error('A speaking-round video segment could not be saved.');
      });
      task.catch(err => { setError(err.message); fail('capture_interrupted'); });
      media.current.uploadChain = task;
    };
    recorder.onerror = () => { setError('The browser recording failed.'); fail('capture_interrupted'); };
    recorder.start(1000);
    media.current.segment = segmentIndex;
    setRecording(true);
  }, [credentialId, fail]);

  async function stopRecorder() {
    const recorder = media.current.recorder;
    if (recorder?.state === 'recording') await new Promise(resolve => { recorder.addEventListener('stop', resolve, { once: true }); recorder.stop(); });
    await media.current.uploadChain;
  }

  async function begin() {
    setBusy(true); setError('');
    let display, camera, started = false;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor', frameRate: { ideal: 10, max: 15 } }, audio: true, preferCurrentTab: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'include' });
      if (display.getVideoTracks()[0]?.getSettings().displaySurface !== 'monitor') throw new Error('Choose Entire screen or Monitor to begin the speaking round.');
      camera = await navigator.mediaDevices.getUserMedia({ video: { aspectRatio: { ideal: 4 / 3 }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: true });
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext('2d');
      const screen = document.createElement('video'); screen.srcObject = display; screen.muted = true; screen.playsInline = true; await screen.play();
      const face = document.createElement('video'); face.srcObject = camera; face.muted = true; face.playsInline = true; await face.play();
      const canvasStream = canvas.captureStream(10), audio = new AudioContext(), mix = audio.createMediaStreamDestination();
      for (const stream of [display, camera]) if (stream.getAudioTracks().length) audio.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(mix);
      mix.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
      media.current = { ...media.current, active: true, failed: false, streams: [display, camera], canvasStream, audio, uploadChain: Promise.resolve(), segment: 1, video: face };
      const paint = () => {
        ctx.fillStyle = '#080b11'; ctx.fillRect(0, 0, 1280, 720);
        if (screen.videoWidth) ctx.drawImage(screen, 0, 0, 1280, 720);
        if (face.videoWidth) { const scale = Math.min(340 / face.videoWidth, 255 / face.videoHeight); const w = face.videoWidth * scale, h = face.videoHeight * scale, x = 1260 - w, y = 700 - h; ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); ctx.drawImage(face, x, y, w, h); }
        if (media.current.active) media.current.raf = requestAnimationFrame(paint);
      };
      paint();
      const data = await api(`${base}/start`, post({ consent: true })); started = true;
      setAttempt(data); setActiveQuestion(0);
      uploadRecorderSegment(canvasStream, 1);
      for (const stream of [display, camera]) for (const track of stream.getTracks()) track.addEventListener('ended', () => fail('capture_interrupted'), { once: true });
    } catch (err) {
      if (started) { try { await api(`${base}/integrity`, post({ reason: 'capture_interrupted' })); } catch {} }
      if (display) display.getTracks().forEach(track => track.stop());
      if (camera) camera.getTracks().forEach(track => track.stop());
      releaseTracks(); setError(err.message || 'Could not start the speaking round.');
    } finally { setBusy(false); }
  }

  async function moveToQuestionTwo() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await stopRecorder();
      const result = await api(`${base}/next`, post({}));
      setAttempt(previous => ({ ...previous, ...result, question2: result.question2 })); setActiveQuestion(1);
      uploadRecorderSegment(media.current.canvasStream, 2);
    } catch (err) { setError(err.message); if (err.message.includes('saved')) fail('capture_interrupted'); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await stopRecorder();
      setAttempt(previous => ({ ...previous, status: 'analyzing' }));
      media.current.active = false; releaseTracks();
      const result = await api(`${base}/complete`, post({})); setAttempt(previous => ({ ...previous, status: result.status, result }));
    } catch (err) { setAttempt(previous => ({ ...previous, status: 'analysis_failed' })); setError(err.message); }
    finally { setBusy(false); }
  }

  async function retryAnalysis() {
    setBusy(true); setError(''); setAttempt(previous => ({ ...previous, status: 'analyzing' }));
    try { const result = await api(`${base}/complete`, post({})); setAttempt(previous => ({ ...previous, status: result.status, result })); }
    catch (err) { setAttempt(previous => ({ ...previous, status: 'analysis_failed' })); setError(err.message); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (attempt?.status !== 'in_progress') return;
    const check = () => {
      const startedAt = new Date(attempt.startedAt).getTime();
      const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setElapsed(seconds);
      if (seconds >= 420 && !busy) submit();
    };
    check(); const timer = setInterval(check, 1000); return () => clearInterval(timer);
  }, [attempt?.status, attempt?.startedAt, busy]);

  useEffect(() => {
    if (attempt?.status !== 'in_progress') return;
    if (document.visibilityState === 'hidden') { fail('tab_hidden'); return; }
    const onVisibility = () => { if (document.visibilityState === 'hidden') fail('tab_hidden'); };
    document.addEventListener('visibilitychange', onVisibility); return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [attempt?.status, fail]);

  if (!attempt) return <section className="real-panel speaking-round"><h3>Speaking round</h3><p>{error || 'Preparing the interview round…'}</p></section>;
  if (attempt.status === 'failed') return <section className="real-panel speaking-round"><h3><ShieldAlert size={17}/> Speaking round failed · locked</h3><p>{attempt.error || 'This attempt was locked after leaving the monitored page or interrupting required recording.'}</p><button className="button secondary" onClick={onDone}>Close</button></section>;
  if (attempt.status === 'analyzing') return <section className="real-panel speaking-round"><h3><LoaderCircle className="spin" size={17}/> Transcribing and assessing your answers…</h3><p>Your recording has been submitted. Keep this page open while Gemini prepares the transcript and report.</p></section>;
  if (attempt.status === 'analysis_failed') return <section className="real-panel speaking-round"><h3>AI assessment did not finish</h3><p>{error || 'Your recorded answers are saved. Retry when the AI service is available.'}</p><button className="button" disabled={busy} onClick={retryAnalysis}>{busy ? <LoaderCircle className="spin" size={15}/> : null}Retry transcript and assessment <ArrowRight size={14}/></button><button className="button secondary" onClick={onDone}>Close</button></section>;
  if (attempt.status === 'completed' || attempt.status === 'timed_out') {
    const result = attempt.result;
    return <section className="real-panel speaking-round"><h3>Speaking round {attempt.status === 'timed_out' ? '· time expired' : '· assessment'}</h3>{result ? <><p>{result.overallSummary}</p><ScoreRing value={result.overallScore} label="Speaking score" size={88}/>{(result.answers || []).map((answer, i) => <article className="speaking-answer-report" key={i}><b>Answer {i + 1} transcript</b><blockquote>{answer.transcript || 'No clear spoken answer was detected.'}</blockquote><p>Role knowledge {answer.roleKnowledge} · Relevance {answer.relevance} · Communication {answer.communicationClarity} · Organization {answer.organization}</p><div><b>Strengths</b><ul>{answer.strengths.map((item, j) => <li key={j}>{item}</li>)}</ul><b>Suggestions</b><ul>{answer.improvements.map((item, j) => <li key={j}>{item}</li>)}</ul></div></article>)}</> : <p>Assessment submitted.</p>}<button className="button secondary" onClick={onDone}>Done</button></section>;
  }

  const question = activeQuestion === 0 ? attempt.question1 : attempt.question2;
  const remaining = Math.max(0, 420 - elapsed);
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  return <section className="real-panel speaking-round">
    <header className="repo-quiz-head"><div><div className="real-eyebrow">SPEAKING ROUND · 7 MINUTES MAX</div><h2>Interview responses</h2><p>Question {activeQuestion + 1} of 2 · {clock} remaining</p></div><span className="speaking-recording-state"><Video size={14}/><Mic size={14}/>{recording ? 'Recording' : 'Preparing'}</span></header>
    {attempt.status === 'ready' ? <div className="repo-quiz-start"><p>We’ll record your full monitor, camera, and microphone for up to seven minutes. The recording and spoken answers will be sent to Google Gemini for transcription and assessment, and saved for your reviewer and the challenge recruiter. Leaving this tab or stopping capture fails and locks the speaking attempt. AI tools are prohibited during this round.</p><label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/> I understand and consent to the recorded speaking round and AI analysis.</label><button className="button" disabled={!consent || busy} onClick={begin}>{busy ? <LoaderCircle className="spin" size={15}/> : null}Start 7-minute speaking round <ArrowRight size={14}/></button></div> : <div className="speaking-live"><FaceMonitor video={media.current.video} active={recording && attempt.status === 'in_progress'} endpoint={`${base}/integrity`}/><p className="speaking-question">{question || 'Loading your question…'}</p><p className="quiz-no-ai">Speak your answer aloud. AI tools are prohibited. Leaving this tab automatically fails the attempt.</p><div className="speaking-live-controls">{activeQuestion === 0 ? <button className="button" disabled={busy || !recording} onClick={moveToQuestionTwo}>{busy ? <LoaderCircle className="spin" size={15}/> : null}Ask next question <ArrowRight size={14}/></button> : <button className="button" disabled={busy || !recording} onClick={submit}>{busy ? <LoaderCircle className="spin" size={15}/> : null}Submit answers <ArrowRight size={14}/></button>}</div></div>}
    {error && <p className="auth-error" role="alert">{error}</p>}
  </section>;
}
