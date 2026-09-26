import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deleteRemoteFile, uploadVideo } from '@/lib/session-evaluation';

const reportSchema = { type: 'object', properties: {
  overallSummary: { type: 'string' }, overallScore: { type: 'integer' },
  answers: { type: 'array', items: { type: 'object', properties: {
    questionIndex: { type: 'integer' }, transcript: { type: 'string' }, roleKnowledge: { type: 'integer' }, relevance: { type: 'integer' }, communicationClarity: { type: 'integer' }, organization: { type: 'integer' },
    strengths: { type: 'array', items: { type: 'string' } }, improvements: { type: 'array', items: { type: 'string' } },
  }, required: ['questionIndex', 'transcript', 'roleKnowledge', 'relevance', 'communicationClarity', 'organization', 'strengths', 'improvements'] } },
}, required: ['overallSummary', 'overallScore', 'answers'] };

export async function evaluateSpeakingRound({ credential, data, recordings }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Speaking-round AI is not configured on the server.');
  const root = resolve(process.cwd(), 'storage', 'session-recordings', 'pri-quiz', credential.id);
  const remoteFiles = [];
  try {
    for (const segmentIndex of [1, 2]) {
      const rows = recordings.filter(row => row.segmentIndex === segmentIndex).sort((a, b) => a.chunkIndex - b.chunkIndex);
      if (!rows.length) continue;
      const buffers = await Promise.all(rows.map(row => readFile(resolve(root, `segment-${segmentIndex}-chunk-${row.chunkIndex}.webm`))));
      const file = await uploadVideo(Buffer.concat(buffers), 'video/webm', `CodeVeritas-speaking-${credential.id}-answer-${segmentIndex}`, apiKey);
      remoteFiles.push({ ...file, segmentIndex });
    }
    if (!remoteFiles.length) throw new Error('No speaking-round recording was saved.');
    const key = process.env.GEMINI_VIDEO_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const models = [...new Set([key, process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite'])];
    const contents = [{ role: 'user', parts: [
      ...remoteFiles.map(file => ({ fileData: { mimeType: 'video/webm', fileUri: file.uri } })),
      { text: `Transcribe and assess this candidate's two recorded spoken interview answers. Video segment 1 contains only the response to question 1; segment 2 contains only the response to question 2. If a segment is missing or the candidate said nothing intelligible, return an empty transcript and zero scores for that answer.

Question 1: ${data.question1}
Question 2: ${data.question2}
Role: ${credential.challenge.role}
Job description: ${credential.challenge.description}
Requirements: ${credential.challenge.requirements}
Company: ${credential.challenge.companyName || 'the company'}

Return exactly two answer objects, with questionIndex 0 and 1. Transcribe the candidate faithfully without inventing words. Score each dimension from 0 to 100: roleKnowledge measures relevant practical understanding for Q1; relevance measures how directly and specifically the answer addresses its question; communicationClarity measures understandable, coherent expression; organization measures logical structure. For Q2 assess realistic contribution and thoughtful company expectations, not factual company trivia. Assess communication only from the spoken answer. Do not score accent, voice pitch, fluency affected by disability, appearance, protected traits, or infer honesty or personality. Use the transcript as the sole basis for scores. Give concise, evidence-based strengths and improvements. Overall score is a balanced summary, not a hiring decision.` },
    ] }];
    let output = null;
    for (const model of models) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { responseMimeType: 'application/json', responseSchema: reportSchema, maxOutputTokens: 4_000 } }),
        signal: AbortSignal.timeout(120_000),
      });
      if ([429, 503].includes(response.status) && model !== models.at(-1)) continue;
      if (!response.ok) throw new Error(response.status === 429 ? 'Gemini free-tier limit reached for the speaking assessment. Retry later.' : 'Gemini could not transcribe and score the speaking answers.');
      output = (await response.json()).candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
      break;
    }
    let result;
    try { result = JSON.parse(output || ''); } catch { throw new Error('Gemini returned an incomplete speaking assessment. Retry the submission.'); }
    if (!Array.isArray(result.answers)) throw new Error('Gemini returned an incomplete speaking assessment. Retry the submission.');
    const answers = [0, 1].map(questionIndex => {
      const answer = result.answers.find(item => item.questionIndex === questionIndex) || {};
      const integer = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      return { questionIndex, transcript: String(answer.transcript || '').slice(0, 8_000), roleKnowledge: integer(answer.roleKnowledge), relevance: integer(answer.relevance), communicationClarity: integer(answer.communicationClarity), organization: integer(answer.organization), strengths: (Array.isArray(answer.strengths) ? answer.strengths : []).map(String).slice(0, 5), improvements: (Array.isArray(answer.improvements) ? answer.improvements : []).map(String).slice(0, 5) };
    });
    const available = answers.filter(answer => answer.transcript.trim());
    const overallScore = available.length ? Math.round(available.reduce((sum, answer) => sum + (answer.roleKnowledge + answer.relevance + answer.communicationClarity + answer.organization) / 4, 0) / available.length) : 0;
    return { overallSummary: String(result.overallSummary || '').slice(0, 2_000), overallScore, answers, questionTimings: data.questionTimings || [], completedAt: new Date().toISOString() };
  } finally {
    await Promise.all(remoteFiles.map(file => deleteRemoteFile(file.name, apiKey)));
  }
}
