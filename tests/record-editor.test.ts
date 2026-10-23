import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyEditorForm } from '../src/features/record-editor/model/types.ts';
import { gamePayload, sessionPayload } from '../src/features/record-editor/model/values.ts';
void test('game write DTO preserves Steam identity and converts editable hours without form metadata', () => {
  const form = emptyEditorForm();
  form.name = 'Portal 2';
  form.steam_appid = 620;
  form.playtime_hours = '2';
  form.playtime_remainder = '5';
  const payload = gamePayload(form);
  assert.equal(payload.steam_appid, 620);
  assert.equal(payload.playtime_minutes, 125);
  assert.equal(payload.rating, null);
  assert.equal('category_ids' in payload, false);
});
void test('session DTO rejects missing categories, reversed intervals and future active timers', () => {
  const form = emptyEditorForm();
  form.start = '2026-01-01T12:00';
  form.end = '2026-01-01T13:00';
  assert.throws(() => sessionPayload(form), /категорию/);
  form.category_ids = ['work-code'];
  assert.equal(Number(sessionPayload(form).end_at) - Number(sessionPayload(form).start_at), 3600000);
  form.end = '2026-01-01T11:00';
  assert.throws(() => sessionPayload(form), /позже начала/);
  form.start = '2999-01-01T12:00';
  form.end = '';
  assert.throws(() => sessionPayload(form), /будущем/);
});
