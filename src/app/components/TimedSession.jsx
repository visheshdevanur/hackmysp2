'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Clock3, Mic, Pause, Play, ScreenShare, ShieldCheck, Square, Video } from 'lucide-react';

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function timeLabel(total) {
  const n = Math.max(0, Math.floor(total));
  return `${String(Math.floor(n / 3600)).padStart(2, '0')}:${String(Math.floor((n % 3600) / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

export default function TimedSession({ challenge, onClose, onComplete }) {
  const [session, setSession] = useState(null);
  const [consent, setConsent] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [savedBytes, setSavedBytes] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const screenVideo = useRef(null);
  const cameraVideo = useRef(null);
  const recorderRef = useRef(null);
  const tracksRef = useRef([]);
  const uploadTail = useRef(Promise.resolve());
  const chunkIndex = useRef(0);
  const segmentIndex = useRef(0);
  const startedAt = useRef(0);
  const elapsedStart = useRef(0);
  const audioContextRef = useRef(null);
  const animationRef = useRef(0);
  const canvasRef = useRef(null);
  const pauseRef = useRef(null);
  const pauseBusy = useRef(false);
  const sessionIdRef = useRef(null);
  const unloadingRef = useRef(false);

  const currentElapsed = recording ? Math.min(session?.durationSeconds || Infinity, elapsedStart.current + Math.floor((tick - startedAt.current) / 1000)) : elapsed;
  const remaining = Math.max(0, (session?.durationSeconds || (challenge.sessionDurationMinutes || 60) * 60) - currentElapsed);

  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(interval);
  }, [recording]);

  async function getSession() {
    if (session) return session;
    const created = await api('/api/work-sessions', { method: 'POST', body: JSON.stringify({ challengeId: challenge.id, privacyAccepted: true }) });
    sessionIdRef.current = created.id;
    setSession(created);
    setElapsed(created.elapsedSeconds || 0);
    setSavedBytes((created.recordings || []).reduce((sum, chunk) => sum + chunk.byteSize, 0));
    return created;
  }

  async function uploadChunk(blob, chunk, segment) {
    if (!blob?.size || !sessionIdRef.current) return;
    const response = await fetch(`/api/work-sessions/${encodeURIComponent(sessionIdRef.current)}/recordings?segment=${segment}&chunk=${chunk}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'video/webm' },
      body: blob,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not save a recording segment.');
    setSavedBytes(value => value + blob.size);
  }

  async function startCapture() {
    setError('');
    setBusy(true);
    let screen;
    let camera;
    let context;
    let current;
    try {
      current = await getSession();
      sessionIdRef.current = current.id;
      screen = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', frameRate: { ideal: 12, max: 15 } },
        audio: true,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'exclude',
        monitorTypeSurfaces: 'include',
      });
      const sharedSurface = screen.getVideoTracks()[0]?.getSettings().displaySurface;
      if (sharedSurface !== 'monitor') throw new Error('Choose “Entire screen” or “Monitor” in the browser sharing picker. Window and tab sharing are not accepted for this challenge.');
      camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, aspectRatio: { ideal: 4 / 3 }, facingMode: 'user' }, audio: true });
      if (!screen.getVideoTracks().length || !camera.getVideoTracks().length || !camera.getAudioTracks().length) throw new Error('Screen, camera, and microphone permissions are all required for this recorded challenge.');
      if (!screenVideo.current || !cameraVideo.current) throw new Error('The recording preview could not be initialized.');
      screenVideo.current.srcObject = screen;
      cameraVideo.current.srcObject = camera;
      await Promise.all([screenVideo.current.play(), cameraVideo.current.play()]);

      const displaySettings = screen.getVideoTracks()[0].getSettings();
      const width = Math.min(1600, displaySettings.width || 1280);
      const height = Math.min(1000, displaySettings.height || 720);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');
      const render = () => {
        if (!ctx || !screenVideo.current || !cameraVideo.current) return;
        ctx.fillStyle = '#07090d';
        ctx.fillRect(0, 0, width, height);
        const ratio = Math.min(width / (screenVideo.current.videoWidth || width), height / (screenVideo.current.videoHeight || height));
        const sw = (screenVideo.current.videoWidth || width) * ratio;
        const sh = (screenVideo.current.videoHeight || height) * ratio;
        ctx.drawImage(screenVideo.current, (width - sw) / 2, (height - sh) / 2, sw, sh);
        const camW = Math.round(width * 0.28);
        const cameraRatio = (cameraVideo.current.videoHeight || 3) / (cameraVideo.current.videoWidth || 4);
        const camH = Math.round(camW * cameraRatio);
        const pad = Math.round(width * 0.018);
        ctx.fillStyle = '#07090d';
        ctx.fillRect(width - camW - pad - 3, height - camH - pad - 3, camW + 6, camH + 6);
        ctx.drawImage(cameraVideo.current, width - camW - pad, height - camH - pad, camW, camH);
        animationRef.current = requestAnimationFrame(render);
      };
      render();

      context = new AudioContext();
      const mix = context.createMediaStreamDestination();
      const audioTracks = [...camera.getAudioTracks(), ...screen.getAudioTracks()];
      for (const track of audioTracks) context.createMediaStreamSource(new MediaStream([track])).connect(mix);
      const videoTrack = canvas.captureStream(12).getVideoTracks()[0];
      const stream = new MediaStream([videoTrack, ...mix.stream.getAudioTracks()]);
      const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('This browser cannot record WebM video. Use the latest Chrome or Edge.');
      const serverState = await api(`/api/work-sessions/${encodeURIComponent(current.id)}/events`, { method: 'POST', body: JSON.stringify({ action: 'resume' }) });
      setElapsed(serverState.elapsedSeconds);
      elapsedStart.current = serverState.elapsedSeconds;
      startedAt.current = Date.now();
      segmentIndex.current = serverState.segmentIndex;
      chunkIndex.current = 0;
      unloadingRef.current = false;
      const recordingSegment = serverState.segmentIndex;
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_100_000, audioBitsPerSecond: 96_000 });
      recorder.ondataavailable = event => {
        if (event.data?.size) {
          const chunk = chunkIndex.current++;
          if (unloadingRef.current) {
            const url = `/api/work-sessions/${encodeURIComponent(current.id)}/recordings?segment=${recordingSegment}&chunk=${chunk}`;
            if (!navigator.sendBeacon(url, event.data)) setError('The browser could not queue the final recording chunk. Previously uploaded chunks are saved.');
          } else {
            uploadTail.current = uploadTail.current.then(() => uploadChunk(event.data, chunk, recordingSegment)).catch(err => { setError(err.message); });
          }
        }
      };
      recorder.onerror = () => setError('The browser recording stopped unexpectedly. Pause and restart screen sharing to continue.');
      recorder.start(1000);
      recorderRef.current = recorder;
      tracksRef.current = [screen, camera, stream];
      audioContextRef.current = context;
      screen.getVideoTracks()[0].addEventListener('ended', () => pauseCapture());
      setSession(previous => ({ ...current, ...serverState, id: current.id, durationSeconds: current.durationSeconds, status: 'active' }));
      setRecording(true);
      pauseBusy.current = false;
    } catch (err) {
      screen?.getTracks().forEach(track => track.stop());
      camera?.getTracks().forEach(track => track.stop());
      await context?.close().catch(() => {});
      cancelAnimationFrame(animationRef.current);
      if (current?.id) await api(`/api/work-sessions/${encodeURIComponent(current.id)}/events`, { method: 'POST', body: JSON.stringify({ action: 'pause' }) }).catch(() => {});
      setError(err.message || 'Could not start screen, camera, and microphone capture.');
    } finally {
      setBusy(false);
    }
  }

  async function pauseCapture() {
    if (pauseBusy.current) return;
    pauseBusy.current = true;
    try {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        const stopped = new Promise(resolvePromise => recorder.addEventListener('stop', resolvePromise, { once: true }));
        recorder.stop();
        await stopped;
      }
      recorderRef.current = null;
      await uploadTail.current;
      tracksRef.current.flatMap(stream => stream.getTracks()).forEach(track => track.stop());
      tracksRef.current = [];
      await audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      cancelAnimationFrame(animationRef.current);
      if (sessionIdRef.current) {
        const paused = await api(`/api/work-sessions/${encodeURIComponent(sessionIdRef.current)}/events`, { method: 'POST', body: JSON.stringify({ action: 'pause' }) });
        setElapsed(paused.elapsedSeconds);
        setSession(previous => previous ? { ...previous, ...paused } : previous);
      }
    } catch (err) {
      setError(err.message || 'Could not pause the recording cleanly. The previously uploaded chunks are saved.');
    } finally {
      setRecording(false);
      pauseBusy.current = false;
    }
  }

  pauseRef.current = pauseCapture;

  useEffect(() => {
    if (!session?.id) return undefined;
    const heartbeat = setInterval(async () => {
      if (!recording || pauseBusy.current) return;
      try {
        const current = await api(`/api/work-sessions/${encodeURIComponent(session.id)}/events`, { method: 'POST', body: JSON.stringify({ action: 'heartbeat' }) });
        setElapsed(current.elapsedSeconds);
        if (current.status !== 'active') await pauseRef.current?.();
      } catch (err) { setError(err.message); }
    }, 5000);
    return () => clearInterval(heartbeat);
  }, [session?.id, recording]);

  useEffect(() => {
    if (!session?.id) return undefined;
    window.__cvStopCurrentSession = () => pauseRef.current?.();
    const pauseOnPageHide = () => {
      if (!recording) return;
      unloadingRef.current = true;
      try {
        if (recorderRef.current?.state === 'recording') recorderRef.current.requestData();
        navigator.sendBeacon(`/api/work-sessions/${encodeURIComponent(session.id)}/events`, new Blob([JSON.stringify({ action: 'pause' })], { type: 'application/json' }));
      } catch {}
    };
    window.addEventListener('pagehide', pauseOnPageHide);
    return () => {
      window.removeEventListener('pagehide', pauseOnPageHide);
      if (window.__cvStopCurrentSession) delete window.__cvStopCurrentSession;
    };
  }, [session?.id, recording]);

  async function finish() {
    setBusy(true);
    setError('');
    try {
      if (recording) await pauseCapture();
      if (!session?.id) throw new Error('Start the session and save a recording before submitting.');
      const result = await api(`/api/work-sessions/${encodeURIComponent(session.id)}/complete`, { method: 'POST', body: JSON.stringify({ githubRepoUrl: repoUrl }) });
      setAnalysis(result.analysis);
      setNotice(`Recording analyzed with ${result.model}. Complete the combined video and repository PRI quiz.`);
      if (result.credential?.id) onComplete(result.credential.id);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function closeSession() {
    if (recording) await pauseCapture();
    onClose();
  }

  const dimensions = analysis?.dimensions || [];
  const resumed = Boolean(session?.resumed || session?.elapsedSeconds > 0);

  return <div className="real-modal-backdrop timed-session-backdrop"><section className="real-modal timed-session-modal" role="dialog" aria-modal="true" aria-labelledby="timed-title">
    <button type="button" className="modal-close" onClick={closeSession} aria-label="Close">×</button>
    <div className="real-eyebrow">RECORDED CHALLENGE · {challenge.sessionDurationMinutes || 60} MINUTES</div>
    <h2 id="timed-title">{challenge.title}</h2>
    <p className="timed-brief">{challenge.description}</p>
    {analysis ? <>
      <div className="session-report"><div className="session-report-head"><ShieldCheck size={18}/><b>Evidence-based session feedback</b><span>Human review remains required</span></div><p>{analysis.summary}</p>
        <div className="session-dimensions">{dimensions.map((item,index)=><article key={`${item.name}-${index}`}><b>{item.name}</b><strong>{item.score}<small>/100</small></strong><span>Confidence: {item.confidence}</span>{(item.evidence||[]).map((e,n)=><small key={n}>Video {timeLabel(e.timestampSeconds)} · {e.observation}</small>)}</article>)}</div>
        <h3>Strengths</h3><ul>{(analysis.strengths||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><h3>Ideas to improve</h3><ul>{(analysis.improvements||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
      </div><button className="button" onClick={()=>onClose()}><Check size={14}/> PRI quiz opened in the challenge card</button>
    </> : <>
      <div className="timed-session-info"><span><Clock3 size={15}/> {timeLabel(remaining)} remaining</span><span><Video size={15}/> {savedBytes ? `${(savedBytes / 1024 / 1024).toFixed(1)} MB safely uploaded` : 'Recording saved continuously'}</span></div>
      <div className={`recording-preview ${recording ? 'visible' : 'capture-idle'}`}><div><video ref={screenVideo} muted playsInline/><video className="camera-preview" ref={cameraVideo} muted playsInline/></div>{recording&&<span><i/> Recording screen, webcam, and microphone</span>}</div>
      {!recording && <><p className="real-muted screen-share-instruction">The browser will ask what to share. Choose <b>Entire screen</b> or <b>Monitor</b>; sharing a single window or browser tab will be rejected. Position your camera at eye level and keep your full face centered in the frame.</p><div className="recording-consent"><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I understand my shared screen, camera, and microphone will be recorded in saved segments. The recording and public repository will be sent to Google Gemini for analysis; Google may use free-tier content to improve its products. The challenge recruiter and reviewers can view the recording and report. I will not share secrets or sensitive personal data. AI tools are allowed; AI authorship detection is not performed.</span></label>
        <button type="button" className="button" onClick={startCapture} disabled={!consent||busy||remaining<=0}>{busy?'Preparing capture…':remaining<=0?'Time expired — submit your recording':resumed?<><Play size={14}/> Resume screen share & timer</>:<><ScreenShare size={14}/> Share screen & start timer</>}</button>
      </div></>}
      {recording&&<button type="button" className="button secondary" onClick={pauseCapture}><Pause size={14}/> Pause and save session</button>}
      <label className="real-label timed-repo">Public GitHub repository<input type="url" value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repository"/></label>
      <button type="button" className="button" onClick={finish} disabled={busy||!repoUrl}>{busy?'Analyzing recording and repository…':<><Square size={14}/> {recording?'Stop, submit repository & analyze':'Submit saved recording & analyze'}</>}</button>
      <small className="timed-session-foot"><Camera size={13}/><Mic size={13}/> Camera and microphone permissions are required. Closing this tab pauses the timer; previously uploaded recording parts are retained for resume.</small>
    </>}
    {(error||notice)&&<div className={error?'auth-error':'real-notice'} role="status">{error||notice}</div>}
  </section></div>;
}
