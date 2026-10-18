// Structured curriculum for the first guided lesson. New lessons can reuse the engine.
export const phrases = [
  { dutch: 'Hallo', english: 'Hello', tip: 'A friendly greeting, any time of day.', example: 'Hallo!' },
  { dutch: 'Hoi', english: 'Hi', tip: 'More casual than hallo. Great with friends.', example: 'Hoi!' },
  { dutch: 'Goedemorgen', english: 'Good morning', tip: 'Use this in the morning. The final “n” is often subtle.', example: 'Goedemorgen!' },
  { dutch: 'Goedenavond', english: 'Good evening', tip: 'Use this when greeting someone in the evening.', example: 'Goedenavond!' },
  { dutch: 'Hoe gaat het?', english: 'How are you?', tip: 'This is a QUESTION. Think: how is it going?', example: 'Hoi! Hoe gaat het?' },
  { dutch: 'Het gaat goed', english: 'I’m doing well', tip: 'This is an ANSWER. Literally: it is going well.', example: 'Het gaat goed, dank je.' },
  { dutch: 'Dank je', english: 'Thank you', tip: 'A friendly, informal way to say thank you.', example: 'Goed, dank je!' },
  { dutch: 'En met jou?', english: 'And you?', tip: 'Ask the other person the same question.', example: 'Het gaat goed. En met jou?' }
];
export const repeatTargets = [0, 2, 4, 5, 7];
export const guidedStages = [
  { id: 'learn', label: 'Learn the words', subtitle: 'Listen & discover', number: '01' },
  { id: 'repeat', label: 'Speak it out loud', subtitle: 'Your first words', number: '02' },
  { id: 'conversation', label: 'Have a conversation', subtitle: 'Take your turn', number: '03' },
  { id: 'reverse', label: 'Switch roles', subtitle: 'You lead', number: '04' },
  { id: 'check', label: 'Your final challenge', subtitle: 'No hints, you’ve got this', number: '05' }
];
export const dialogues = {
  conversation: [
    { prompt: 'Hallo!', expected: ['Hallo','Hoi'], sample: 'Hallo!', reply: 'Hoe gaat het?', hint: 'Say “Hallo!” or “Hoi!” back.', meaning: 'Hello!' },
    { prompt: 'Hoe gaat het?', expected: ['Het gaat goed, dank je. En met jou?', 'Het gaat goed, dank je', 'Goed, dank je', 'Het gaat goed'], sample: 'Het gaat goed, dank je. En met jou?', reply: 'Het gaat goed!', hint: 'Try: “Het gaat goed, dank je. En met jou?”', meaning: 'How are you?' }
  ],
  reverse: [
    { prompt: 'Start by saying hello.', expected: ['Hallo', 'Hoi'], sample: 'Hallo!', reply: 'Hoi!', hint: 'You could say “Hallo!”', meaning: 'Start the greeting yourself.' },
    { prompt: 'Ask how I am.', expected: ['Hoe gaat het?', 'Hoe gaat het met jou?'], sample: 'Hoe gaat het?', reply: 'Het gaat goed, dank je. En met jou?', hint: 'Ask “Hoe gaat het?”', meaning: 'Ask: How are you?' },
    { prompt: 'Tell me you’re doing well.', expected: ['Het gaat goed','Het gaat goed, dank je','Goed, dank je','Goed'], sample: 'Het gaat goed, dank je!', reply: 'Great work!', hint: 'Say “Het gaat goed, dank je.”', meaning: 'Say: I am doing well.' }
  ],
  check: [
    { prompt: 'Goedenavond!', expected: ['Goedenavond'], sample: 'Goedenavond!', reply: 'Hoe gaat het?', hint: 'Say good evening back.', meaning: 'Good evening!' },
    { prompt: 'Hoe gaat het?', expected: ['Het gaat goed, dank je. En met jou?', 'Het gaat goed. En met jou?', 'Goed, dank je. En met jou?', 'Het gaat goed, en met jou?'], sample: 'Het gaat goed, dank je. En met jou?', reply: 'Het gaat goed, dank je!', hint: 'Say you are doing well, and ask back.', meaning: 'How are you?' }
  ]
};
export function normalize(input) {
  return String(input || '').toLocaleLowerCase('nl-NL').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N} ]/gu,' ').replace(/\s+/g,' ').trim();
}
export function editDistance(a,b) {
  const x = normalize(a), y = normalize(b);
  let row = [...Array(y.length + 1)].map((_,i) => i);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++) next[j] = Math.min(next[j-1]+1, row[j]+1, row[j-1]+(x[i-1] === y[j-1] ? 0 : 1));
    row = next;
  }
  return row[y.length];
}
export function assessAnswer(value, accepted, { strict = false } = {}) {
  const actual = normalize(value);
  if (!actual) return { ok: false, message: 'I didn’t catch that. Try again, or type your answer.' };
  const candidates = accepted.map(normalize);
  // Important teaching distinction: a scrambled question isn't the correct question.
  if (actual.startsWith('goed gaat het') && candidates.some(s => s.startsWith('hoe gaat het'))) {
    return { ok: false, message: 'The question is “Hoe gaat het?”; the answer is “Het gaat goed”. Let’s try the question again.' };
  }
  if (candidates.some(s => actual === s)) return { ok: true, message: 'That’s it! Nicely said.' };
  if (!strict && candidates.some(s => s.length >= 9 && actual.length > s.length && actual.includes(s))) {
    return { ok: true, message: 'Great! You’ve got the key phrase.' };
  }
  const close = !strict && candidates.some(s => s.length > 3 && editDistance(actual,s) <= Math.max(1,Math.floor(s.length * 0.17)));
  return close
    ? { ok: true, message: 'Close enough for this practice! Speech recognition can make little mistakes.' }
    : { ok: false, message: 'Not quite the phrase we’re practising. Give it another go, or tap “Help me”.' };
}
// Live voice always uses the learner's explanation language. Dutch is only for
// the single taught expression at the current lesson step, never for feedback.
export function getActiveTutorItem(stage, step = 0) {
  const index = Number.isInteger(step) && step >= 0 ? step : 0;
  if (stage === 'learn') return phrases[index] || phrases[0];
  if (stage === 'repeat') return phrases[repeatTargets[index] ?? repeatTargets[0]];
  if (stage === 'reverse') {
    const turn = dialogues.reverse[index] || dialogues.reverse[0];
    return { dutch: turn.sample, english: turn.meaning };
  }
  if (stage === 'conversation' || stage === 'check') {
    const turn = dialogues[stage][index] || dialogues[stage][0];
    return { dutch: turn.prompt, english: turn.meaning };
  }
  return phrases[0];
}

export function getTutorInstructions(stage, { step = 0, explanationLanguage = 'English' } = {}) {
  const active = getActiveTutorItem(stage, step);
  const safeLanguage = explanationLanguage === 'English' ? 'English' : 'the learner’s chosen explanation language';
  const stageGuidance = {
    learn: 'Teach the CURRENT expression. If the learner explicitly says next, introduce only the next expression in the lesson sequence; do not skip or list phrases.',
    repeat: 'Ask the learner to repeat the CURRENT expression once and wait. Correct gently in English.',
    conversation: 'Guide a short greeting exchange using only the eight taught expressions. Do not introduce a new expression without a clear learner request.',
    reverse: 'The learner leads the greeting. Prompt in English, then wait; offer only a small hint if requested.',
    check: 'Let the learner respond independently with the taught expressions; give hints only if asked.',
    complete: 'Congratulate in English, with no new Dutch phrases.'
  };
  return `You are Sofie, a calm, warm, patient, natural-speaking Dutch tutor for ABSOLUTE beginners.

NON-NEGOTIABLE TEACHING RULES:
1. Speak all explanations, encouragement, corrections, questions, and transitions in ${safeLanguage}. This is the default, NOT something the learner must ask for. Dutch is used ONLY when saying the exact Dutch lesson expression being practised. Never explain in Dutch or sprinkle in Dutch praise, directions, or filler. In particular never say "goed zo", "herhaal", "precies", "goed gedaan", "neem je tijd", or any other untaught Dutch words.
2. The entire Lesson 1 Dutch vocabulary is limited to these exact expressions: ${phrases.map(p=>`"${p.dutch}"`).join(', ')}. A natural short greeting exchange may combine expressions already taught, but no other Dutch words or sentences are permitted. If the learner asks about a new word, explain in ${safeLanguage} that it comes in a later lesson, then return to the current exercise.
3. CURRENT lesson stage is "${stage}"; current exercise is ONLY "${active.dutch}" (meaning: "${active.english}"). Start at this exercise, not automatically at "Hallo". One expression at a time. Do not recite the whole vocabulary list or teach the next expression unless the learner explicitly wants to move on.
4. Say the target Dutch expression at most ONCE in each turn unless the learner explicitly requests repetition. After the learner tries, respond with one short, specific English sentence (for example: "Nice, you said the Dutch word for hello!") and PAUSE. Do not keep asking them to repeat the same word. Do not automatically jump to the next phrase.
5. Speak noticeably slowly, using short sentences and natural pauses. Never rush or lecture. Each turn should normally be one or two short sentences, fewer than 25 spoken words, with at most ONE question, and then STOP to wait for the learner.
6. Distinguish English "hello" from Dutch "Hallo" if it matters, but be gentle about imperfect speech recognition. Do not claim to precisely assess pronunciation from a transcript alone. Give useful and specific corrections without fake praise.
7. If the learner interrupts, says they are confused, or asks for English or slower speech, stop teaching immediately, acknowledge in ${safeLanguage}, explain simply in ${safeLanguage}, and wait. The learner controls the pace.
8. "Hoe gaat het?" is the question "How are you?" and "Het gaat goed" is the answer "I'm doing well". Do not confuse their roles.
9. The live voice tutor is separate from the guided lesson: do not claim its spoken exchanges automatically advance or complete on-screen steps.

Stage behavior: ${stageGuidance[stage] || stageGuidance.learn}`;
}

export function getTutorOpening(stage, { step = 0 } = {}) {
  const active = getActiveTutorItem(stage, step);
  if (stage === 'reverse') return 'In English, say "Your turn to start the greeting. I’m listening." Then wait in silence for the learner to lead. No new Dutch words.';
  if (stage === 'check') return 'In English, say "Let’s try a short greeting. Take your time." Then say the current greeting exactly once and wait for the learner. No other Dutch.';
  if (stage === 'complete') return 'In English, warmly congratulate the learner in one short sentence. No new Dutch words.';
  return `Speak calmly and slowly in English. In a short sentence say the meaning of the current expression: "${active.english}". Then pronounce ONLY "${active.dutch}" once, invite the learner to try it, and wait silently. Do not mention another Dutch expression.`;
}
