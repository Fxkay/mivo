import test from 'node:test';
import assert from 'node:assert/strict';
import { phrases, repeatTargets, dialogues, assessAnswer, normalize, getTutorInstructions, getTutorOpening, getActiveTutorItem } from '../lesson.js';

test('curriculum has eight greetings and five repeat targets', () => {
  assert.equal(phrases.length, 8);
  assert.equal(repeatTargets.length, 5);
});
test('natural Dutch punctuation is ignored', () => {
  assert.equal(normalize('Hoe gaat het?'), 'hoe gaat het');
  assert.equal(assessAnswer('Hoe gaat het?', ['Hoe gaat het?']).ok, true);
  assert.equal(assessAnswer('Het gaat goed, dank je.', ['Het gaat goed, dank je']).ok, true);
});
test('mixing up the question and answer does not pass', () => {
  assert.equal(assessAnswer('Goed gaat het', ['Hoe gaat het?']).ok, false);
  assert.equal(assessAnswer('Hoe gaat het', ['Het gaat goed']).ok, false);
});
test('alternate responses are accepted', () => {
  assert.equal(assessAnswer('Hoi', dialogues.conversation[0].expected).ok, true);
  assert.equal(assessAnswer('Goed dank je', dialogues.conversation[1].expected).ok, true);
});
test('empty answer is not treated as correct', () => {
  assert.equal(assessAnswer('', ['Hallo']).ok, false);
});
test('realtime stage instructions retain the correct question-answer pairing', () => {
  const prompt = getTutorInstructions('reverse');
  assert.match(prompt, /Hoe gaat het/);
  assert.match(prompt, /Het gaat goed/);
});

test('final response must ask the question back', () => {
  assert.equal(assessAnswer('Het gaat goed', dialogues.check[1].expected, {strict:true}).ok, false);
  assert.equal(assessAnswer('Het gaat goed, dank je. En met jou?', dialogues.check[1].expected, {strict:true}).ok, true);
});
test('final challenge rejects near-misses and incomplete phrases', () => {
  assert.equal(assessAnswer('Goedenavon', ['Goedenavond'], {strict:true}).ok, false);
  assert.equal(assessAnswer('Hallo', ['Goedenavond'], {strict:true}).ok, false);
});
test('practice accepts the complete Dutch phrase with surrounding words', () => {
  assert.equal(assessAnswer('Hoi Sofie', ['Hoi']).ok, false);
  assert.equal(assessAnswer('Hoe gaat het Sofie', ['Hoe gaat het']).ok, true);
});


test('Sofie defaults to English for all teaching, never Dutch explanation', () => {
  const prompt = getTutorInstructions('learn', { step: 0 });
  assert.match(prompt, /all explanations, encouragement, corrections, questions, and transitions in English/);
  assert.match(prompt, /never say "goed zo"/);
  assert.match(prompt, /at most ONCE in each turn/);
  assert.match(prompt, /do not automatically jump to the next phrase/i);
});

test('Sofie gets the current on-screen phrase, not always Hallo', () => {
  assert.equal(getActiveTutorItem('learn', 2).dutch, 'Goedemorgen');
  assert.equal(getActiveTutorItem('repeat', 2).dutch, 'Hoe gaat het?');
  assert.match(getTutorInstructions('learn', {step: 2}), /current exercise is ONLY "Goedemorgen"/);
  assert.match(getTutorOpening('learn', { step: 2 }), /"Goedemorgen" once/);
  assert.doesNotMatch(getTutorOpening('learn', { step: 2 }), /saying Hallo/);
});

test('reverse role invites learner to lead with English-only guidance', () => {
  const opening = getTutorOpening('reverse', { step: 0 });
  assert.match(opening, /In English/);
  assert.match(opening, /wait in silence/);
});
