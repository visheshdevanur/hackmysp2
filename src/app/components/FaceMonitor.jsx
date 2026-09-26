'use client';

import { useEffect, useState } from 'react';
import { ScanFace, ShieldAlert } from 'lucide-react';

const importRemote = url => new Function('url', 'return import(url)')(url);

export default function FaceMonitor({ video, active, endpoint }) {
  const [status, setStatus] = useState('Loading face check…');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!active || !video) return;
    let cancelled = false;
    let detector;
    let timer;
    let lastVideoTime = -1;
    let lastEvent = '';
    let lastSentAt = 0;
    let noFace = 0;
    let manyFaces = 0;
    async function monitor() {
      try {
        setStatus('Starting face check…');
        const vision = await importRemote('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs');
        if (cancelled) return;
        const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
        detector = await vision.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.55 });
        if (cancelled) { detector.close(); return; }
        setStatus('Face check active');
        const tick = () => {
          if (cancelled) return;
          if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            try {
              const count = detector.detectForVideo(video, performance.now()).detections.length;
              noFace = count === 0 ? noFace + 1 : 0;
              manyFaces = count > 1 ? manyFaces + 1 : 0;
              const type = noFace >= 3 ? 'face_missing' : manyFaces >= 3 ? 'multiple_faces' : '';
              if (!type) { lastEvent = ''; setWarning(''); }
              else {
                setWarning(type === 'face_missing' ? 'No face is visible. Center your face in the camera.' : 'More than one face is visible. Please continue alone.');
                if (type !== lastEvent || Date.now() - lastSentAt > 30_000) {
                  lastEvent = type; lastSentAt = Date.now();
                  fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: type }), keepalive: true }).catch(() => {});
                }
              }
            } catch { setStatus('Face check paused'); }
          }
          timer = setTimeout(tick, 900);
        };
        tick();
      } catch (error) {
        console.error('Face check initialization failed', error);
        if (!cancelled) setStatus('Face check unavailable — camera recording continues');
      }
    }
    monitor();
    return () => { cancelled = true; clearTimeout(timer); try { detector?.close(); } catch {} };
  }, [video, active, endpoint]);

  if (!active) return null;
  const needsAttention = Boolean(warning) || /unavailable|paused/i.test(status);
  return <div className={`face-monitor ${needsAttention ? 'has-warning' : ''}`} role={needsAttention ? 'alert' : 'status'}>{needsAttention ? <ShieldAlert size={15}/> : <ScanFace size={15}/>}<span>{warning || status}</span></div>;
}
