import assert from 'node:assert/strict';
import { __testables, handler } from '../netlify/functions/create-ticket.js';

const valid = { requestType: 'bug', component: 'ordine', summary: 'Errore ordine', description: 'Il salvataggio non riesce.' };
assert.equal(__testables.validatePayload(valid), '');
assert.equal(__testables.validatePayload({ ...valid, requestType: 'unknown' }), 'Tipo richiesta non valido');
assert.equal(__testables.validatePayload({ ...valid, summary: '' }), 'Titolo obbligatorio');
assert.equal(__testables.validatePayload({ ...valid, userEmail: 'not-an-email' }), 'Email non valida');

const logs = __testables.safeLogs([{ level: 'error', message: 'token=super-secret eyJabcdefgh.abcdefgh.abcdefgh' }]);
assert.match(logs[0].message, /\[REDACTED\]/);
assert.doesNotMatch(logs[0].message, /super-secret|eyJabcdefgh/);

const blocked = await handler({ httpMethod: 'POST', headers: { origin: 'https://evil.example' }, body: JSON.stringify(valid) });
assert.equal(blocked.statusCode, 403);
const previewOrigin = await handler({ httpMethod: 'POST', headers: { origin: 'https://abc123--app-dosepranza.netlify.app' }, body: '{' });
assert.equal(previewOrigin.statusCode, 400);
const invalid = await handler({ httpMethod: 'POST', headers: { origin: 'https://marcotranquilli.github.io' }, body: '{' });
assert.equal(invalid.statusCode, 400);
const unconfigured = await handler({ httpMethod: 'POST', headers: { origin: 'https://marcotranquilli.github.io' }, body: JSON.stringify(valid) });
assert.equal(unconfigured.statusCode, 503);
const options = await handler({ httpMethod: 'OPTIONS', headers: { origin: 'https://marcotranquilli.github.io' } });
assert.equal(options.statusCode, 204);
assert.equal(options.body, '');

console.log('feedback service tests: ok');
