import { phrases, repeatTargets, guidedStages, dialogues, assessAnswer, normalize, getTutorInstructions, getTutorOpening } from './lesson.js';

const STORE = 'mivo-progress-v1';
const STAGES = guidedStages.map(s => s.id);
const app = document.getElementById('app');
const initial = { stage: 'welcome', step: 0, done: false, passed: false, message: '', errors: [], unlocked: 0, completed: false, muted: false, checkpoint: null };
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem('zeg-mvp-progress-v1') || '{}') || {}; } catch {}
let state = { ...initial, ...saved, errors: Array.isArray(saved.errors) ? saved.errors : [] };
if (!['welcome', ...STAGES, 'complete'].includes(state.stage)) state = { ...initial };
if (!Number.isInteger(state.step) || state.step < 0 || state.step >= (state.stage === 'learn' ? phrases.length : state.stage === 'repeat' ? repeatTargets.length : (dialogues[state.stage]?.length || 1))) state.step = 0;
if (state.checkpoint && (!STAGES.includes(state.checkpoint.stage) || !Number.isInteger(state.checkpoint.step))) state.checkpoint = null;
const recognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recognizing = false;
let live = { status: 'off', pc: null, dc: null, stream: null, audio: null, captions: [], muted: false };
let tutorMessage = '';

const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const stageIndex = () => STAGES.indexOf(state.stage);
const totalSteps = () => state.stage === 'learn' ? phrases.length : state.stage === 'repeat' ? repeatTargets.length : (dialogues[state.stage]?.length || 0);
const currentPhrase = () => state.stage === 'learn' ? phrases[state.step] : state.stage === 'repeat' ? phrases[repeatTargets[state.step]] : null;
const currentDialogue = () => dialogues[state.stage]?.[state.step] || null;
const statusLabel = () => state.stage === 'welcome' ? 'Your first lesson' : state.stage === 'complete' ? 'Lesson completed' : guidedStages[stageIndex()].label;
const progressPercent = () => state.stage === 'complete' ? 100 : Math.round(Math.max(0, Math.min(1, (stageIndex() + (state.done ? 1 : state.step / Math.max(1, totalSteps()))) / STAGES.length)) * 100);
function persist() {
  const { stage, step, done, passed, errors, unlocked, completed, muted, checkpoint } = state;
  try { localStorage.setItem(STORE, JSON.stringify({ stage, step, done, passed, errors: errors.slice(-25), unlocked, completed, muted, checkpoint })); } catch {}
}
function speak(text, lang = 'nl-NL') {
  if (state.muted || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = lang === 'nl-NL' ? .83 : .95;
  utterance.pitch = 1.02;
  const choices = speechSynthesis.getVoices();
  const voice = choices.find(v => v.lang.toLowerCase() === lang.toLowerCase()) || choices.find(v => v.lang.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
}
function setStage(stage) {
  if (recognition) { try { recognition.abort(); } catch {} recognizing = false; }
  state.stage = stage; state.step = 0; state.passed = false; state.done = false; state.message = '';
  if (STAGES.includes(stage)) state.unlocked = Math.max(state.unlocked, STAGES.indexOf(stage));
  persist(); render();
}
function nextStep() {
  if (state.step + 1 >= totalSteps()) { state.done = true; state.passed = false; state.message = ''; }
  else { state.step++; state.passed = false; state.message = ''; }
  persist(); render();
}
function nextStage() {
  const i = stageIndex();
  if (i < STAGES.length - 1) setStage(STAGES[i + 1]);
  else { state.completed = true; setStage('complete'); }
}
function processAnswer(answer) {
  const phrase = currentPhrase();
  const expected = phrase ? [phrase.dutch] : currentDialogue()?.expected;
  if (!expected || state.passed || state.done) return;
  const result = assessAnswer(answer, expected, { strict: state.stage === 'check' });
  if (result.ok) {
    state.passed = true; state.message = result.message;
    const reply = currentDialogue()?.reply;
    if (reply) speak(reply, phrases.some(p => normalize(p.dutch) === normalize(reply)) ? 'nl-NL' : 'en-US');
  } else {
    state.message = result.message;
    if (normalize(answer) && !state.errors.includes((phrase?.dutch || currentDialogue()?.sample || '').toLowerCase()))
      state.errors.push((phrase?.dutch || currentDialogue()?.sample || '').toLowerCase());
    if (normalize(answer).includes('goed gaat het')) state.message = '“Hoe gaat het?” is the question. “Het gaat goed” is the answer. Give the right one a try!';
  }
  persist(); render();
}
function listen() {
  if (!recognitionClass) { state.message = 'Speech recognition is unavailable in this browser. You can type your answer below, or try Chrome.'; render(); return; }
  if (recognizing) { recognition?.stop(); return; }
  if (!window.isSecureContext) { state.message = 'Microphone access needs HTTPS or localhost. You can still type below.'; render(); return; }
  if (live.status === 'on') { state.message = 'Please end the live tutor before using the guided speaking button.'; render(); return; }
  recognition = new recognitionClass();
  recognition.lang = 'nl-NL'; recognition.interimResults = false; recognition.maxAlternatives = 2;
  recognition.onresult = e => processAnswer(e.results[0][0].transcript);
  recognition.onerror = e => { recognizing = false; state.message = e.error === 'not-allowed' ? 'Microphone permission was denied. Use the text box, or enable microphone access in your browser.' : `Couldn't hear clearly (${e.error}). Try again or type.`; render(); };
  recognition.onend = () => { recognizing = false; updateListeningButton(); };
  try { recognition.start(); recognizing = true; updateListeningButton(); }
  catch { recognizing = false; state.message = 'Could not start the microphone. Type your answer instead.'; render(); }
}
function updateListeningButton() {
  const btn = document.getElementById('listen');
  if (btn) { btn.textContent = recognizing ? '■ Stop listening' : '🎙 Speak my answer'; btn.classList.toggle('listening', recognizing); }
}
function stageSteps() {
  return `<div class="stepper" aria-label="Lesson steps">${guidedStages.map((s, i) => `<button type="button" class="step-pill ${stageIndex() === i ? 'active' : ''} ${i < state.unlocked ? 'previous' : ''}" data-jump="${s.id}" ${i > state.unlocked ? 'disabled' : ''} title="${esc(s.label)}"><span>${i + 1}</span><span class="pill-title">${esc(s.label)}</span></button>`).join('')}</div>`;
}
function shell(content, welcome = false) {
  app.innerHTML = `<div class="background-orb orb1"></div><div class="background-orb orb2"></div><div class="page"><header class="topbar"><button class="brand" data-action="home" aria-label="Back to start"><span class="brand-mark">m.</span><span>Mivo<span class="brand-dot">.</span></span></button><div class="top-right"><span class="tiny-badge">🇳🇱 DUTCH · A0</span><button class="icon-button" data-action="sound" title="${state.muted ? 'Enable' : 'Mute'} speech" aria-label="${state.muted ? 'Enable' : 'Mute'} speech">${state.muted ? '🔇' : '🔊'}</button></div></header>${welcome ? '' : `<div class="progress-head"><span>${esc(statusLabel())}</span><span>${progressPercent()}% complete</span></div><div class="progress-rail"><div class="progress-fill" style="width:${progressPercent()}%"></div></div>`}<main>${content}</main><footer class="footer"><span>Made for curious beginners · Lesson 01</span><span>No account needed to try</span></footer></div>`;
  bindEvents();
}
function welcomePage() {
  shell(`<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="dot-flash"></span> YOUR DUTCH JOURNEY STARTS HERE</div><h1>Speak Dutch.<br><em>Start simple.</em></h1><p>Real conversations, one friendly phrase at a time. Meet Sofie, your patient Dutch-speaking tutor.</p><div class="hero-actions"><button class="btn primary big" data-action="start">${state.completed ? 'Practice again' : 'Start my first lesson'} <span aria-hidden="true">↗</span></button>${state.checkpoint ? `<button class="btn secondary" data-action="resume">Resume lesson →</button>` : ''}</div><div class="micro-note"><span>✓</span> Free first lesson <span>✓</span> Speak or type <span>✓</span> No pressure</div></div><div class="tutor-illustration"><div class="bubble bubble-top">Hoe gaat het? <span>🇳🇱</span></div><div class="avatar-halo"><div class="avatar"><span class="hair"></span><span class="face"><i class="eye left"></i><i class="eye right"></i><i class="smile"></i></span><div class="shirt"></div></div></div><div class="tutor-label"><span class="online-dot"></span> SOFIE · YOUR AI TUTOR</div><div class="bubble bubble-bottom">Het gaat goed! <span>✨</span></div></div></section><section class="outline"><div class="section-title"><div><span class="eyebrow">YOUR FIRST STEPS</span><h2>What you'll learn today</h2></div><span class="duration">⏱ 5–10 min</span></div><div class="module-cards"><article class="module"><div class="module-icon">👋</div><h3>Say hello</h3><p>Hallo, hoi, and greetings for the time of day.</p></article><article class="module"><div class="module-icon">💬</div><h3>Keep it going</h3><p>Ask “Hoe gaat het?” and know how to reply.</p></article><article class="module"><div class="module-icon">🎭</div><h3>Take the lead</h3><p>Reverse roles and begin your own conversation.</p></article></div></section>`, true);
}
function learnerBox() {
  return `<div class="answer-panel"><div class="answer-heading"><span class="answer-icon">🎤</span><div><strong>Your turn to speak</strong><small>${recognitionClass ? 'Use your mic or type below' : 'Type below; speech recognition is not available here'}</small></div></div><div class="answer-actions"><button id="listen" class="btn microphone" data-action="listen" ${live.status === 'on' ? 'disabled' : ''}>🎙 Speak my answer</button><form class="answer-form" id="answer-form"><label class="sr-only" for="answer-input">Type your Dutch answer</label><input id="answer-input" autocomplete="off" maxlength="180" placeholder="Or type your Dutch answer…" required /><button class="send" type="submit" aria-label="Submit answer">↗</button></form></div><p class="recognition-note">Speech recognition may mishear accents. You can always type to retry.</p></div>`;
}
function feedback() {
  return state.message ? `<div class="feedback ${state.passed ? 'success' : 'caution'}" role="status"><span>${state.passed ? '✓' : '💡'}</span><p>${esc(state.message)}</p></div>` : '';
}
function helperBox() {
  const p = currentPhrase(), d = currentDialogue();
  const text = p ? `“${p.dutch}” means “${p.english}”. ${p.tip}` : d ? `${d.hint} ${d.meaning}` : 'Try the phrase, one word at a time.';
  return `<div class="help-tools"><button class="text-button" data-action="hint">💡 Help me</button><button class="text-button" data-action="slow">🐢 Say it slower</button><button class="text-button" data-action="meaning">🌐 What does it mean?</button></div>${tutorMessage ? `<div class="help-message" role="status">${esc(tutorMessage)}</div>` : ''}`;
}
function lessonFrame(main, secondary = '', eyebrow = '', heading = '') {
  return `<div class="lesson-layout"><section class="lesson-main"><div class="lesson-title"><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(heading)}</h1></div>${stageSteps()}${main}</section><aside class="sidebar"><div class="side-card"><div class="side-title"><span class="online-dot"></span><strong>Meet Sofie</strong></div><p>“We’ll take it one phrase at a time. Ask me anything!”</p><button class="btn soft full" data-action="live">${live.status === 'on' ? 'End live AI voice chat' : live.status === 'connecting' ? 'Connecting…' : '🎧 Talk to Sofie (AI)'}</button><small>Optional · Uses the OpenAI API when configured</small><div id="live-status" class="live-status">${esc(live.status === 'on' ? 'Connected · just speak naturally' : live.status === 'connecting' ? 'Connecting…' : live.status === 'error' ? 'Connection unavailable' : 'Guided lesson works without an API key')}</div><div class="live-captions" id="live-captions">${live.captions.slice(-3).map(line => `<p>${esc(line)}</p>`).join('')}</div></div><div class="side-card language-card"><div class="side-title"><span>📌</span><strong>A little reminder</strong></div><p><strong>Hoe gaat het?</strong><br>How are you? <em>(a question)</em></p><p><strong>Het gaat goed.</strong><br>I'm doing well. <em>(an answer)</em></p></div></aside></div>`;
}
function learnPage() {
  const p = currentPhrase();
  const content = state.done ? donePanel('You know the basics!', 'You’ve seen eight essential phrases. Now let’s try saying them out loud.') : `<div class="phrase-card"><div class="card-number">PHRASE ${String(state.step + 1).padStart(2,'0')} / ${String(phrases.length).padStart(2,'0')}</div><div class="phrase-big">${esc(p.dutch)}</div><div class="translation">${esc(p.english)}</div><button class="listen-pill" data-action="hear">🔊 Listen to pronunciation</button><div class="rule"></div><div class="phrase-tip"><span>✦</span><span>${esc(p.tip)}</span></div></div><div class="main-actions"><button class="btn secondary" data-action="hear">↻ Hear again</button><button class="btn primary" data-action="next">${state.step === phrases.length - 1 ? 'Finish learning' : 'Next phrase'} <span>→</span></button></div>`;
  shell(lessonFrame(content, '', 'STEP 01 · LEARN', 'Let’s say hello'));
}
function practicePage() {
  const isRepeat = state.stage === 'repeat';
  const p = currentPhrase(), d = currentDialogue();
  const heading = isRepeat ? 'Your turn to speak' : state.stage === 'conversation' ? 'Let’s have a chat' : state.stage === 'reverse' ? 'You lead this time' : 'Your final challenge';
  const label = isRepeat ? 'Repeat after Sofie' : state.stage === 'conversation' ? 'SOFIE SAYS' : state.stage === 'reverse' ? 'YOUR MISSION' : 'FINAL CHECK · NO PRESSURE';
  const prompt = isRepeat ? p.dutch : d?.prompt || '';
  const meaning = isRepeat ? p.english : state.stage === 'reverse' ? 'Start in Dutch. You can ask for help at any time.' : d?.meaning || '';
  const card = state.done ? donePanel(state.stage === 'check' ? 'You did it! 🎉' : 'Great work!', state.stage === 'check' ? 'You completed your first Dutch greetings lesson.' : 'Ready for the next little challenge?') : `<div class="practice-card"><div class="card-number">${esc(label)} · ${state.step + 1} OF ${totalSteps()}</div><div class="practice-prompt">${esc(prompt)}</div><p class="translation">${esc(meaning)}</p><button class="listen-pill" data-action="hear">🔊 Hear ${isRepeat ? 'the phrase' : 'Sofie'}</button>${state.passed ? `<div class="tutor-reply"><div class="speech-avatar">S</div><div><small>${isRepeat ? 'YOU GOT IT' : 'SOFIE REPLIES'}</small><strong>${esc(isRepeat ? p.dutch : (d?.reply || 'Nice work!'))}</strong></div></div>` : ''}</div>${state.passed ? `<div class="main-actions"><button class="btn secondary" data-action="hear">🔊 Listen again</button><button class="btn primary" data-action="next">${state.step === totalSteps()-1 ? 'Finish this step' : 'Next turn'} →</button></div>` : learnerBox()}${feedback()}${helperBox()}`;
  shell(lessonFrame(card, '', `STEP 0${stageIndex() + 1} · PRACTICE`, heading));
  updateListeningButton();
}
function donePanel(title, info) {
  return `<div class="done-panel"><div class="completion-star">✦</div><h2>${esc(title)}</h2><p>${esc(info)}</p><button class="btn primary big" data-action="next-stage">${state.stage === 'check' ? 'See my results' : 'Continue lesson'} →</button></div>`;
}
function completePage() {
  const review = [...new Set(state.errors)].slice(-3);
  const items = review.length ? review.map(n => phrases.find(p => normalize(p.dutch) === normalize(n))?.dutch || n) : ['Hoe gaat het?', 'Het gaat goed', 'En met jou?'];
  shell(`<section class="finish"><div class="confetti">✦ ✳ ✦</div><span class="eyebrow">LESSON 01 COMPLETE</span><div class="award">🏆</div><h1>Wonderful work!</h1><h2>You did it. You spoke Dutch!</h2><p>You learned to say hello, respond when someone asks how you are, and start a conversation yourself. That’s something worth celebrating.</p><div class="finish-stats"><div><strong>8</strong><span>Useful phrases</span></div><div><strong>3</strong><span>Practice modes</span></div><div><strong>1</strong><span>New language unlocked</span></div></div><div class="review-card"><span class="eyebrow">PRACTISE ANYTIME</span><h3>Keep these phrases fresh</h3><div class="review-words">${items.map(t => `<button class="word-chip" data-say="${esc(t)}">🔊 ${esc(t)}</button>`).join('')}</div></div><button class="btn primary big" data-action="restart">Practice lesson again ↻</button><button class="btn secondary" data-action="home">Back to home</button></section>`);
}
function render() {
  if (state.stage === 'welcome') return welcomePage();
  if (state.stage === 'learn') return learnPage();
  if (state.stage === 'complete') return completePage();
  practicePage();
}
function bindEvents() {
  app.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', async e => {
    const action = el.dataset.action;
    if (action === 'home') { if (live.status === 'on' || live.status === 'connecting') endLive(); if (STAGES.includes(state.stage)) state.checkpoint = { stage: state.stage, step: state.step, done: state.done, passed: state.passed }; setStage('welcome'); }
    if (action === 'start' || action === 'restart') { state.errors = []; state.completed = false; state.unlocked = 0; state.checkpoint = null; setStage('learn'); }
    if (action === 'resume' && state.checkpoint) { Object.assign(state, state.checkpoint); state.checkpoint = null; state.message = ''; persist(); render(); }
    if (action === 'sound') { state.muted = !state.muted; if (state.muted) window.speechSynthesis?.cancel(); persist(); render(); }
    if (action === 'hear') { const text = currentPhrase()?.dutch || (state.stage === 'reverse' ? (currentDialogue()?.sample || 'Hallo') : (currentDialogue()?.prompt || 'Hallo')); speak(text, 'nl-NL'); }
    if (action === 'next') { tutorMessage = ''; nextStep(); }
    if (action === 'next-stage') { tutorMessage = ''; nextStage(); }
    if (action === 'listen') listen();
    if (action === 'hint') { tutorMessage = currentPhrase() ? `Try saying “${currentPhrase().dutch}”. It means “${currentPhrase().english}”.` : currentDialogue()?.hint || 'You can take it slowly, one word at a time.'; render(); }
    if (action === 'meaning') { tutorMessage = currentPhrase() ? `“${currentPhrase().dutch}” means “${currentPhrase().english}”.` : currentDialogue()?.meaning || 'This is a greeting.'; render(); }
    if (action === 'slow') { const text = currentPhrase()?.dutch || currentDialogue()?.sample || 'Hoe gaat het?'; if (!state.muted && 'speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'nl-NL'; u.rate = .65; speechSynthesis.speak(u); } tutorMessage = `Slowly: ${text}`; render(); }
    if (action === 'live') { if (live.status === 'on' || live.status === 'connecting') endLive(); else startLive(); }
  }));
  app.querySelectorAll('[data-jump]').forEach(el => el.addEventListener('click', () => { if (!el.disabled) { tutorMessage = ''; setStage(el.dataset.jump); } }));
  app.querySelectorAll('[data-say]').forEach(el => el.addEventListener('click', () => speak(el.dataset.say)));
  document.getElementById('answer-form')?.addEventListener('submit', e => { e.preventDefault(); const input = document.getElementById('answer-input'); processAnswer(input?.value || ''); });
}
function liveEvent(ev) {
  let msg; try { msg = JSON.parse(ev.data); } catch { return; }
  if (msg.type === 'response.output_audio_transcript.done' && msg.transcript) addCaption(`Sofie: ${msg.transcript}`);
  if (msg.type === 'conversation.item.input_audio_transcription.completed' && msg.transcript) addCaption(`You: ${msg.transcript}`);
  if (msg.type === 'error') { addCaption(`Session note: ${msg.error?.message || 'An error occurred.'}`); }
}
function addCaption(line) { live.captions.push(line); live.captions = live.captions.slice(-8); const box = document.getElementById('live-captions'); if (box) { box.innerHTML = live.captions.slice(-3).map(text => `<p>${esc(text)}</p>`).join(''); box.scrollTop = box.scrollHeight; } }
async function startLive() {
  live.status = 'connecting'; render();
  try {
    const r = await fetch('/api/realtime-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anonymousId: (localStorage.getItem('mivo-anon-id') || makeAnonId()) }) });
    const keyData = await r.json();
    if (!r.ok) throw new Error(keyData.error || 'Could not create a voice session');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    live.stream = stream;
    const pc = new RTCPeerConnection(); live.pc = pc;
    const audio = new Audio(); audio.autoplay = true; live.audio = audio;
    pc.ontrack = e => { audio.srcObject = e.streams[0]; audio.play().catch(() => addCaption('Tap once to enable speaker audio.')); };
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    const dc = pc.createDataChannel('oai-events'); live.dc = dc;
    dc.onmessage = liveEvent;
    dc.onopen = () => {
      dc.send(JSON.stringify({ type: 'session.update', session: { type: 'realtime', instructions: getTutorInstructions(state.stage, { step: state.step }) } }));
      dc.send(JSON.stringify({ type: 'response.create', response: { instructions: getTutorOpening(state.stage, { step: state.step }), output_modalities: ['audio'] } }));
    };
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { Authorization: `Bearer ${keyData.value}`, 'Content-Type': 'application/sdp' }, body: offer.sdp });
    if (!sdpRes.ok) throw new Error('Could not connect to OpenAI voice. Check your API model access and billing.');
    await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() });
    live.status = 'on'; addCaption('Connected: ask Sofie anything, or practise in Dutch.'); render();
  } catch (error) { endLive(); live.status = 'error'; addCaption(error.message || 'Connection failed'); render(); }
}
function makeAnonId() {
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  try { localStorage.setItem('mivo-anon-id', id); } catch {}
  return id;
}
function endLive() {
  try { live.dc?.close(); live.pc?.close(); live.stream?.getTracks().forEach(t => t.stop()); if (live.audio) { live.audio.srcObject = null; } } catch {}
  live.status = 'off'; live.pc = null; live.dc = null; live.stream = null; live.audio = null;
  render();
}
window.addEventListener('pagehide', () => { try { live.pc?.close(); live.stream?.getTracks().forEach(t => t.stop()); } catch {} });
render();
