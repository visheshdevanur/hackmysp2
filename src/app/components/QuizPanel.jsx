'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, ShieldAlert, X } from 'lucide-react';
import SpeakingRound from './SpeakingRound';
import FaceMonitor from './FaceMonitor';
import ScoreRing from './ScoreRing';

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export default function QuizPanel({ credentialId, onClose }) {
  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef({ streams: [], recorder: null, canvasStream: null, audio: null, chunks: [], raf: 0, active: false, failed: false, segment: 0, canvas: null, video: null, uploadChain: Promise.resolve() });
  const base = `/api/credentials/${encodeURIComponent(credentialId)}/quiz`;

  const cleanup = useCallback(() => {
    const media = mediaRef.current;
    if (media.active && !media.failed) {
      fetch(`${base}/integrity`, { ...json({ reason: 'capture_interrupted' }), keepalive: true }).catch(() => {});
    }
    media.active = false;
    cancelAnimationFrame(media.raf);
    for (const stream of media.streams) stream.getTracks().forEach(track => track.stop());
    media.canvasStream?.getTracks().forEach(track => track.stop());
    try { media.audio?.close(); } catch {}
    mediaRef.current = { ...mediaRef.current, active: false };
    setRecording(false);
  }, [base]);

  const fail = useCallback(async reason => {
    const media = mediaRef.current;
    if (!media.active || media.failed) return;
    media.failed = true;
    media.active = false;
    setQuiz(previous => previous ? { ...previous, status: 'failed', failedReason: reason, integrityEvents: [...(previous.integrityEvents || []), { type: reason, occurredAt: new Date().toISOString(), questionIndex: index }] } : previous);
    try { await api(`${base}/integrity`, { ...json({ reason }), keepalive: true }); } catch {}
    try { if (media.recorder?.state === 'recording') media.recorder.stop(); } catch {}
    for (const stream of media.streams) stream.getTracks().forEach(track => track.stop());
    media.canvasStream?.getTracks().forEach(track => track.stop());
    try { await media.audio?.close(); } catch {}
    setRecording(false);
    setError(reason === 'tab_hidden' ? 'The quiz was automatically failed because the quiz tab was left.' : 'The quiz was automatically failed because recording stopped.');
  }, [base, index]);

  useEffect(() => {
    let active = true;
    api(base).then(async data => {
      if (!active) return;
      setQuiz(data);
      setIndex(data.currentQuestionIndex || 0);
      if (data.status === 'in_progress') {
        try { await api(`${base}/integrity`, json({ reason: 'attempt_reloaded' })); } catch {}
        if (active) setQuiz({ ...data, status: 'failed', failedReason: 'attempt_reloaded', integrityEvents: [...(data.integrityEvents || []), { type: 'attempt_reloaded', occurredAt: new Date().toISOString() }] });
      }
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; cleanup(); };
  }, [base, cleanup]);

  useEffect(() => {
    if (quiz?.status !== 'in_progress') return;
    const tick = () => {
      const started = quiz.currentQuestionStartedAt ? new Date(quiz.currentQuestionStartedAt).getTime() : Date.now();
      setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    };
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [quiz?.status, quiz?.currentQuestionStartedAt, index]);

  async function start() {
    setBusy(true); setError('');
    let display, camera, audio, recorder, attemptStarted = false;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor', frameRate: { ideal: 10, max: 15 } }, audio: true, preferCurrentTab: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'include' });
      if (display.getVideoTracks()[0]?.getSettings().displaySurface !== 'monitor') throw new Error('Choose Entire screen or Monitor to begin the monitored quiz.');
      camera = await navigator.mediaDevices.getUserMedia({ video: { aspectRatio: { ideal: 4 / 3 }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: true });
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext('2d');
      const screenVideo = document.createElement('video'); screenVideo.srcObject = display; screenVideo.muted = true; screenVideo.playsInline = true; await screenVideo.play();
      const cameraVideo = document.createElement('video'); cameraVideo.srcObject = camera; cameraVideo.muted = true; cameraVideo.playsInline = true; await cameraVideo.play();
      const paint = () => {
        ctx.fillStyle = '#080b11'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (screenVideo.videoWidth) ctx.drawImage(screenVideo, 0, 0, 1280, 720);
        if (cameraVideo.videoWidth) {
          const boxW = 340, boxH = 255, scale = Math.min(boxW / cameraVideo.videoWidth, boxH / cameraVideo.videoHeight);
          const w = cameraVideo.videoWidth * scale, h = cameraVideo.videoHeight * scale, x = 1260 - w, y = 700 - h;
          ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); ctx.drawImage(cameraVideo, x, y, w, h);
        }
        if (mediaRef.current.active) mediaRef.current.raf = requestAnimationFrame(paint);
      };
      const canvasStream = canvas.captureStream(10); audio = new AudioContext(); const mix = audio.createMediaStreamDestination();
      for (const stream of [display, camera]) { const tracks = stream.getAudioTracks(); if (tracks.length) audio.createMediaStreamSource(new MediaStream(tracks)).connect(mix); }
      mix.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
      mediaRef.current = { streams: [display, camera], recorder: null, canvasStream, audio, chunks: [], raf: 0, active: true, failed: false, segment: 0, canvas, video: [screenVideo, cameraVideo], uploadChain: Promise.resolve() };
      paint();
      const startData = await api(`${base}/start`, json({ consent: true }));
      attemptStarted = true;
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
      recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 900_000 });
      mediaRef.current.recorder = recorder;
      let chunk = 0;
      recorder.ondataavailable = event => {
        if (!event.data?.size) return;
        mediaRef.current.uploadChain = mediaRef.current.uploadChain.then(async () => {
          const response = await fetch(`${base}/recordings?segment=0&chunk=${chunk++}`, { method: 'POST', headers: { 'Content-Type': 'video/webm' }, body: event.data });
          if (!response.ok) throw new Error('A quiz recording segment could not be saved.');
        }).catch(err => { setError(err.message); fail('capture_interrupted'); });
      };
      recorder.start(1000);
      for (const stream of [display, camera]) for (const track of stream.getTracks()) track.addEventListener('ended', () => fail('capture_interrupted'), { once: true });
      setQuiz({ ...quiz, status: 'in_progress', questions: startData.questions, currentQuestionIndex: startData.currentQuestionIndex, currentQuestionStartedAt: startData.startedAt }); setIndex(0); setChoice(null); setRecording(true);
    } catch (err) {
      if (attemptStarted) { try { await api(`${base}/integrity`, json({ reason: 'capture_interrupted' })); } catch {} }
      if (display) display.getTracks().forEach(track => track.stop());
      if (camera) camera.getTracks().forEach(track => track.stop());
      try { if (recorder?.state === 'recording') recorder.stop(); } catch {}
      cleanup(); setError(err.message || 'Could not start the monitored quiz.');
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (quiz?.status !== 'in_progress') return;
    const onVisibility = () => { if (document.visibilityState === 'hidden') fail('tab_hidden'); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [quiz?.status, fail]);

  async function answer() {
    if (choice == null || busy) return;
    setBusy(true); setError('');
    try {
      const result = await api(`${base}/answer`, json({ questionIndex: index, answerIndex: choice }));
      if (result.status === 'completed') { setQuiz(result); setRecording(false); const media = mediaRef.current; if (media.recorder?.state === 'recording') { const stopped = new Promise(resolve => media.recorder.addEventListener('stop', resolve, { once: true })); media.recorder.stop(); await stopped; } await media.uploadChain; cleanup(); }
      else { setIndex(result.currentQuestionIndex); setChoice(null); setElapsed(0); setQuiz(previous => ({ ...previous, currentQuestionIndex: result.currentQuestionIndex, currentQuestionStartedAt: new Date().toISOString(), questionTimings: result.questionTimings })); }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const question = quiz?.questions?.[index];
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  return <section className="real-panel repo-quiz">
    <header className="repo-quiz-head"><div><div className="real-eyebrow">PROJECT UNDERSTANDING · PRI</div><h2>Repository quiz</h2><p>One question at a time · monitored attempt</p>{quiz?.status === 'completed'&&<ScoreRing value={quiz.score} label="PRI quiz" size={84}/>}</div>{!['in_progress', 'completed'].includes(quiz?.status)&&<button type="button" className="repo-quiz-close" onClick={onClose} aria-label="Close quiz"><X size={16}/></button>}</header>
    {!quiz ? <p>{error || 'Loading repository quiz…'}</p> : quiz.status === 'failed' ? <div className="repo-quiz-results"><div className="repo-quiz-score"><ShieldAlert size={17}/> Attempt failed · locked</div><p>Leaving this quiz tab or stopping its required recording automatically fails this attempt. It cannot be restarted. Reviewers and the challenge recruiter can see the integrity event.</p><button type="button" className="button secondary" onClick={onClose}>Close</button></div> : quiz.status === 'completed' ? <><div className="repo-quiz-results"><div className="repo-quiz-score"><Check size={17}/> {quiz.correctCount} of {quiz.total} correct · {quiz.score}%</div>{(quiz.questionTimings || []).map(item => <p key={item.questionIndex}>Question {item.questionIndex + 1}: {item.elapsedSeconds}s</p>)}{quiz.questions.map((item, i) => <article className="repo-quiz-result" key={item.id}><b>{i + 1}. {item.question}</b><p>{item.explanation}</p><small>{item.selectedIndex === item.correctIndex ? 'Correct.' : `Correct answer: ${item.options[item.correctIndex]}. `}Evidence: {item.evidence?.path}:{item.evidence?.lineStart}</small></article>)}</div><SpeakingRound credentialId={credentialId} onDone={onClose}/></> : quiz.status !== 'in_progress' ? <div className="repo-quiz-start"><p>This PRI quiz records your entire monitor, camera, and microphone. AI tools are not allowed. Leaving this tab automatically fails and locks the attempt. Recruiter and reviewer accounts can see the recording and integrity result.</p><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/> I understand and consent to the monitored PRI quiz.</label>{error && <p className="auth-error">{error}</p>}<button type="button" className="button" disabled={!consent || busy} onClick={start}>{busy ? <LoaderCircle className="spin" size={15}/> : null} Start recorded PRI quiz <ArrowRight size={14}/></button></div> : <div className="repo-quiz-live"><div className="quiz-live-meta"><span>Question {index + 1} of {quiz.questions.length}</span><span>{clock} on this question</span><span>{recording ? 'Recording saved in segments' : 'Starting recording…'}</span></div><p className="quiz-no-ai">AI tools are prohibited. Leaving this tab automatically fails and locks the attempt.</p><FaceMonitor video={mediaRef.current.video?.[1]} active={recording} endpoint={`${base}/integrity`}/>{question && <fieldset className="repo-quiz-question"><legend>{question.question}</legend>{question.options.map((option, i) => <label className={choice === i ? 'selected' : ''} key={i}><input type="radio" name={question.id} checked={choice === i} onChange={() => setChoice(i)}/><span>{option}</span></label>)}</fieldset>}{error && <p className="auth-error" role="alert">{error}</p>}<button type="button" className="button" disabled={busy || choice == null || !recording} onClick={answer}>{busy ? <LoaderCircle className="spin" size={15}/> : null}{index === quiz.questions.length - 1 ? 'Submit quiz' : 'Next question'} <ArrowRight size={14}/></button></div>}
  </section>;
}
