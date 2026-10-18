// Run: node test.cjs — checks the pickup rules in Code.gs
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), ctx);
const { decide, waNumber_, defaultTimes_, split_ } = ctx;
const plain = v => JSON.parse(JSON.stringify(v)); // vm arrays aren't deepStrictEqual to local ones

const s = { index: '260001', name: 'Kasun', delivery: 'Pickup', center: 'Center B', paid: true, tutes: ['Tute 05', 'Tute 06'] };

assert.strictEqual(decide(null).ok, false);
assert.match(decide({ ...s, delivery: 'Courier' }, 'Center B', {}).msg, /Courier/);
assert.match(decide(s, 'Center A', {}).msg, /Registered for Center B/);
assert.match(decide({ ...s, paid: false }, 'Center B', {}).msg, /not paid/);
assert.match(decide({ ...s, tutes: [] }, 'Center B', {}).msg, /No tutes ticked/);

// All ticked tutes owed
let r = decide(s, 'Center B', {});
assert.strictEqual(r.ok, true);
assert.strictEqual(r.msg, 'Give 2 tutes');
assert.deepStrictEqual(plain(r.tutes), ['Tute 05', 'Tute 06']);

// One already collected, the other still owed
r = decide(s, 'Center B', { 'Tute 05': { center: 'Center B', when: '14 Sep' } });
assert.deepStrictEqual(plain(r.tutes), ['Tute 06']);
assert.strictEqual(r.msg, 'Give 1 tute');
assert.deepStrictEqual(plain(r.done), ['Has Tute 05 (Center B, 14 Sep)']);

// Everything collected
r = decide(s, 'Center B', { 'Tute 05': { center: 'Center B', when: '1 Sep' }, 'Tute 06': { center: 'Center A', when: '2 Sep' } });
assert.strictEqual(r.ok, false);
assert.match(r.msg, /All tutes already collected/);

assert.strictEqual(waNumber_('0771234567'), '94771234567');
assert.strictEqual(waNumber_('771234567'), '94771234567');
assert.strictEqual(waNumber_('+94 77 123 4567'), '94771234567');
assert.strictEqual(waNumber_(''), '');

const times = split_(defaultTimes_());
assert.strictEqual(times[0], '8:00 AM');
assert.strictEqual(times[9], '12:30 PM');
assert.strictEqual(times[times.length - 1], '6:00 PM');
assert.deepStrictEqual(plain(split_('Tute 01, Tute 03,,')), ['Tute 01', 'Tute 03']);

console.log('all rules ok');
