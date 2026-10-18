// Tute pickup checker — Apps Script bound to the Google Sheet.
// It is only the database + rules: the staff app lives on Vercel, which calls doPost with a shared secret.
// Sheets: Students (master list; after the 9 fixed columns, one tick-box column per tute),
// Staff (Name, PIN, Center — one row per coordinator), Log (one row per tute handed out),
// Settings (centers, time slots, app link).
// Student rows turn light green once every ticked tute is collected, and red once the pickup date has passed with tutes still owed.

const ALL = 'All centers'; // Staff → Center value for coordinators who serve every center
const FIXED = 9; // Students columns A–I; every column after that is a tute (header = tute name)

function setup() {
  const ss = SpreadsheetApp.getActive();
  const st = sheet_(ss, 'Students',
    ['Index', 'Name', 'Mobile', 'NIC', 'Delivery', 'Center', 'Paid', 'Pickup Date', 'Pickup Time']);
  sheet_(ss, 'Log', ['Time', 'Index', 'Name', 'Tute', 'Center', 'Staff']);
  const staff = sheet_(ss, 'Staff', ['Name', 'PIN', 'Center']);
  const set = sheet_(ss, 'Settings', ['Key', 'Value']);
  const have = set.getRange('A:A').getValues().flat().map(String);
  [
    ['Centers', 'Center A,Center B,Center C'],
    ['Slot Times', defaultTimes_()],
    ['App URL', ''],
  ].filter(([k]) => !have.includes(k)).forEach(r => set.appendRow(r));
  const cfg = settings_();
  apiSecret_(); // creates the secret on first run; Tute Pickup → Show API secret displays it

  const list = (values, invalidOk) => SpreadsheetApp.newDataValidation().requireValueInList(values).setAllowInvalid(invalidOk).build();
  const dup = (sh, cols) => cols.map(c => SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(`=AND($${c}2<>"",COUNTIF($${c}:$${c},$${c}2)>1)`)
    .setBackground('#f4c7c3')
    .setRanges([sh.getRange(`${c}2:${c}`)])
    .build());

  // Staff: PIN is text so leading zeros stay; a PIN must be unique and at least 6 characters
  staff.getRange('A:B').setNumberFormat('@');
  staff.getRange('C2:C').setDataValidation(list([ALL, ...split_(cfg.Centers)], false));
  staff.setConditionalFormatRules(dup(staff, ['A', 'B']));

  // Tute columns: headers are only seeded once, so tutes you add or rename are kept.
  // Add a tute = type its name in the next empty header cell of Students, then run setup again for its tick boxes.
  if (!st.getRange(1, FIXED + 1).getValue()) {
    st.getRange(1, FIXED + 1, 1, 20).setValues([Array.from({ length: 20 }, (_, i) => 'Tute ' + String(i + 1).padStart(2, '0'))]).setFontWeight('bold');
  }
  st.getRange(2, FIXED + 1, st.getMaxRows() - 1, st.getLastColumn() - FIXED).insertCheckboxes();

  // Keep leading zeros in mobile numbers, dropdowns for Delivery/Center/Time, checkbox for Paid, date picker for date
  st.getRange('A:D').setNumberFormat('@');
  st.getRange('E2:E').setDataValidation(list(['Physical', 'Pickup', 'Courier'], false));
  st.getRange('F2:F').setDataValidation(list(split_(cfg.Centers), false));
  st.getRange('G2:G').insertCheckboxes();
  st.getRange('H2:H').setNumberFormat('ddd d mmm yyyy')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());
  st.getRange('I2:I').setNumberFormat('@').setDataValidation(list(split_(cfg['Slot Times']), true));

  // Red highlight on duplicate Index / Mobile / NIC = same student registered twice
  st.setConditionalFormatRules(dup(st, ['A', 'C', 'D']));

  // Row colours refresh on every edit (onEdit), after each handout, and daily so "overdue" shows the morning after the date
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'refreshStatus')) {
    ScriptApp.newTrigger('refreshStatus').timeBased().everyDays(1).atHour(1).create();
  }
  paint_();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Tute Pickup')
    .addItem('QR cards (download / WhatsApp / print)', 'printCards')
    .addItem('Refresh row colors', 'refreshStatus')
    .addItem('Show API secret (for Vercel)', 'showApiSecret')
    .addToUi();
}

// Shared secret between this script and the Vercel app. Stored in Script Properties, never in the sheet.
function apiSecret_() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('API_SECRET')) p.setProperty('API_SECRET', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  return p.getProperty('API_SECRET');
}

function showApiSecret() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('API secret', 'Paste this into Vercel as API_SECRET. Keep it private:\n\n' + apiSecret_(), ui.ButtonSet.OK);
}

// One QR per student. Scanning it opens the Vercel app with that index prefilled (?i=), which asks for a staff PIN.
// The QR holds only the link + index, never personal details.
function printCards() {
  const url = settings_()['App URL'].replace(/\/+$/, '');
  if (!/^https:\/\//.test(url)) throw new Error('Deploy the Vercel app first, then paste its link (https://…) into Settings → App URL');
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const students = ss.getSheetByName('Students').getDataRange().getValues().slice(1)
    .filter(r => r[0])
    .map(r => {
      const s = { index: String(r[0]).trim(), name: String(r[1]).trim(), center: String(r[5]).trim(), slot: slot_(r[7], r[8], tz) };
      s.qr = url + '/?i=' + s.index;
      const text = `Hi ${s.name}, this is your tute pickup QR code (index ${s.index}). ` +
        `Show it at ${s.center || 'the center'}${s.slot ? ' on ' + s.slot : ''}. Please keep it private.`;
      const num = waNumber_(r[2]);
      s.wa = num ? 'https://wa.me/' + num + '?text=' + encodeURIComponent(text) : '';
      return s;
    })
    .sort((a, b) => a.center.localeCompare(b.center) || a.index.localeCompare(b.index));
  const logo = HtmlService.createHtmlOutputFromFile('Logo').getContent().trim();
  ss.toast('Building QR cards…');
  SpreadsheetApp.getUi().showModalDialog(cardsPage_({ students, logo }).setWidth(1000).setHeight(720), 'QR Cards');
}

// Cards.html (built from the React app) reads window.CFG; the script goes after it so its doctype stays first.
// Only sheet editors can open this dialog, so student details never leave the Sheet.
function cardsPage_(cfg) {
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    HtmlService.createHtmlOutputFromFile('Cards').getContent() + '<script>window.CFG=' + json + '</script>');
}

// The web app link does nothing for browsers: all data goes through doPost, which needs the secret
function doGet() {
  return ContentService.createTextOutput('Tute Pickup API');
}

// Only the Vercel app calls this. Body: { secret, fn, ... }. Every answer is JSON { ok, msg, ... }.
function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (err) { /* no body → fails the secret check below */ }
  if (!b.secret || b.secret !== apiSecret_()) return json_({ ok: false, msg: 'Forbidden' });
  try {
    if (b.fn === 'login') return json_(login_(b.pin, b.ip));
    // A session cookie outlives a removed staff row only until the next call: every call re-checks the Staff sheet
    const me = staff_().find(s => s.name === String(b.staff));
    if (!me) return json_({ ok: false, auth: false, msg: 'Session expired – log in again' });
    if (b.fn === 'me') return json_({ ok: true, name: me.name, center: me.center });
    if (b.fn === 'check') return json_(lookup_(b.index, me.center));
    if (b.fn === 'collect') return json_(collect_(b.index, me, b.picked));
    if (b.fn === 'recent') return json_(recent_(me));
    return json_({ ok: false, msg: 'Unknown request' });
  } catch (err) {
    return json_({ ok: false, msg: String(err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Staff rows with a usable PIN (6+ characters)
function staff_() {
  return SpreadsheetApp.getActive().getSheetByName('Staff').getDataRange().getValues().slice(1)
    .map(r => ({ name: String(r[0]).trim(), pin: String(r[1]).trim(), center: String(r[2]).trim() }))
    .filter(s => s.name && s.center && s.pin.length >= 6);
}

// Students hold the app link (it's in their QR), so wrong PINs are limited per IP (5) and overall (100)
// per 10 min — a curious student locks only their own network, and brute-forcing a 6-digit PIN is out of reach.
// ponytail: the IP comes from Vercel; a student on shared carrier NAT could lock others on it for 10 min
function login_(pin, ip) {
  const cache = CacheService.getScriptCache();
  const keys = ['pinFails', 'pinFails:' + String(ip).slice(0, 45)];
  const n = keys.map(k => Number(cache.get(k) || 0));
  if (n[0] >= 100 || n[1] >= 5) throw new Error('Too many wrong PINs – try again in 10 minutes');
  pin = String(pin || '').trim();
  const s = staff_().find(s => s.pin === pin);
  if (!s) {
    keys.forEach((k, i) => cache.put(k, String(n[i] + 1), 600));
    throw new Error('Wrong PIN');
  }
  return { ok: true, name: s.name, center: s.center };
}

// Re-check under a lock, then log each ticked tute that is still owed
function collect_(index, me, picked) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // two centers scanning the same index at once can't both pass
  try {
    const r = lookup_(index, me.center);
    if (!r.ok) return r;
    picked = Array.isArray(picked) ? picked.map(String) : [];
    const give = r.tutes.filter(t => picked.includes(t));
    if (!give.length) return { ...r, ok: false, msg: 'Tick at least one tute' };
    const log = SpreadsheetApp.getActive().getSheetByName('Log');
    const now = new Date();
    give.forEach(t => log.appendRow([now, r.index, r.name, t, r.center || me.center, me.name])); // the student's own center, so an all-centers coordinator still logs a real one
    SpreadsheetApp.flush();
    paint_(r.index);
    const left = r.tutes.filter(t => !give.includes(t));
    return { ...r, tutes: [], msg: 'Recorded – given: ' + give.join(', '),
      done: left.length ? ['Still to give later: ' + left.join(', ')] : [] };
  } finally {
    lock.releaseLock();
  }
}

function lookup_(index, center) {
  index = String(index).trim();
  if (!/^\d{6}$/.test(index)) return { ok: false, msg: 'Index must be 6 digits' };

  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const [head, ...rows] = ss.getSheetByName('Students').getDataRange().getValues();
  const row = rows.find(r => String(r[0]).trim() === index);
  if (!row) return decide(null);

  // Every tute this student has ever collected, so each tute is handed out once
  const given = {};
  Object.entries(logged_(ss)[index] || {}).forEach(([t, g]) => {
    given[t] = { center: g.center, when: Utilities.formatDate(new Date(g.when), tz, 'd MMM') };
  });

  const r = decide(student_(head, row, tz), center, given);
  // Last 4 NIC digits so staff can match the student's ID card — a forwarded QR alone isn't enough
  return Object.assign(r, { nic: String(row[3]).trim().slice(-4), slot: slot_(row[7], row[8], tz) });
}

// One Students row as the rules see it. date = pickup date as yyyy-MM-dd, '' if empty or not a date.
function student_(head, row, tz) {
  const d = row[7] instanceof Date ? row[7] : new Date(row[7]);
  return {
    index: String(row[0]).trim(),
    name: String(row[1]),
    delivery: String(row[4]).trim(),
    center: String(row[5]).trim(),
    paid: row[6] === true,
    date: isNaN(d) ? '' : Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
    tutes: head.slice(FIXED).map((h, i) => [String(h).trim(), row[FIXED + i]]).filter(([h, on]) => h && on === true).map(([h]) => h),
  };
}

// { index: { tute: { center, when: Date } } } for everything ever handed out
function logged_(ss) {
  const out = {};
  ss.getSheetByName('Log').getDataRange().getValues().slice(1).forEach(r => {
    const i = String(r[1]).trim();
    (out[i] = out[i] || {})[String(r[3]).trim()] = { center: r[4], when: r[0] };
  });
  return out;
}

// What the Students row colour means — pure, tested in test.cjs.
// 'collected' = has tutes ticked and every one was handed out; 'overdue' = pickup date passed with tutes still owed.
function status_(s, given, today) {
  if (s.delivery === 'Courier' || !s.tutes.length) return '';
  if (s.tutes.every(t => given[t])) return 'collected';
  return s.date && s.date < today ? 'overdue' : '';
}

const COLORS = { collected: '#d9ead3', overdue: '#f4b6b6' }; // light green, red

// Colours Students rows (all of them, or just one index). Anything else keeps no fill.
// ponytail: this resets manual row fills on Students; use the tute tick-boxes and Paid for marking instead
function paint_(only) {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const st = ss.getSheetByName('Students');
  const [head, ...rows] = st.getDataRange().getValues();
  const done = logged_(ss);
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const color = r => {
    if (!String(r[0]).trim()) return null;
    const s = student_(head, r, tz);
    return COLORS[status_(s, done[s.index] || {}, today)] || null;
  };
  if (only) {
    const i = rows.findIndex(r => String(r[0]).trim() === only);
    if (i >= 0) st.getRange(i + 2, 1, 1, head.length).setBackground(color(rows[i]));
  } else if (rows.length) {
    st.getRange(2, 1, rows.length, head.length).setBackgrounds(rows.map(r => Array(head.length).fill(color(r))));
  }
}

function refreshStatus() {
  paint_();
}

// Keeps colours live while you tick tutes or change dates. Simple trigger: runs on every edit, no setup needed.
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() === 'Log') return paint_();
  if (sh.getName() !== 'Students' || e.range.getRow() < 2) return;
  if (e.range.getNumRows() > 1) return paint_();
  const index = String(sh.getRange(e.range.getRow(), 1).getValue()).trim();
  if (index) paint_(index);
}

// Today's handouts at this coordinator's center (every center for All centers), newest first: one entry per student per handout
function recent_(me) {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const log = SpreadsheetApp.getActive().getSheetByName('Log').getDataRange().getValues();
  const items = [];
  let total = 0;
  for (let i = log.length - 1; i > 0; i--) { // the Log is append-only, so stop at the first row from an earlier day
    const [at, index, name, tute, center, staff] = log[i];
    if (Utilities.formatDate(new Date(at), tz, 'yyyy-MM-dd') !== today) break;
    if (me.center !== ALL && String(center).trim() !== me.center) continue;
    const time = Utilities.formatDate(new Date(at), tz, 'h:mm a');
    const last = items[items.length - 1];
    total++;
    if (last && last.index === String(index).trim() && last.time === time) last.tutes.unshift(String(tute));
    else items.push({ time, index: String(index).trim(), name: String(name), tutes: [String(tute)], staff: String(staff) });
  }
  return { ok: true, msg: '', items, total, students: items.length };
}

// Pure rule check — tested in test.js.
// center = the coordinator's center, or ALL. s.tutes = tutes ticked on the student's row, given = { tute: {center, when} } already collected.
function decide(s, center, given) {
  if (!s) return { ok: false, msg: 'Index not found' };
  const who = { name: s.name, index: s.index, center: s.center };
  if (s.delivery === 'Courier') return { ...who, ok: false, msg: 'Courier student – tutes are posted home' };
  if (center !== ALL && s.center !== center) return { ...who, ok: false, msg: `Registered for ${s.center || 'no center'}, not ${center}` };
  if (!s.paid) return { ...who, ok: false, msg: 'Fee not paid' };
  if (!s.tutes.length) return { ...who, ok: false, msg: 'No tutes ticked for this student' };
  const done = s.tutes.filter(t => given[t]).map(t => `Has ${t} (${given[t].center}, ${given[t].when})`);
  const tutes = s.tutes.filter(t => !given[t]);
  if (!tutes.length) return { ...who, done, ok: false, msg: 'All tutes already collected' };
  return { ...who, done, tutes, ok: true, msg: `Give ${tutes.length} tute${tutes.length > 1 ? 's' : ''}` };
}

// Sri Lankan mobile → WhatsApp format: 0771234567 / 771234567 → 94771234567
function waNumber_(m) {
  m = String(m).replace(/\D/g, '');
  if (m.length === 10 && m[0] === '0') return '94' + m.slice(1);
  if (m.length === 9) return '94' + m;
  return m;
}

function slot_(date, time, tz) {
  const d = date instanceof Date ? Utilities.formatDate(date, tz, 'EEE d MMM') : String(date || '').trim();
  return [d, String(time || '').trim()].filter(Boolean).join(', ');
}

// 8:00 AM … 6:00 PM every 30 minutes
function defaultTimes_() {
  return Array.from({ length: 21 }, (_, i) => {
    const m = 480 + i * 30, h = Math.floor(m / 60);
    return `${(h + 11) % 12 + 1}:${m % 60 ? '30' : '00'} ${h < 12 ? 'AM' : 'PM'}`;
  }).join(',');
}

function split_(v) {
  return String(v || '').split(',').map(s => s.trim()).filter(Boolean);
}

function settings_() {
  const rows = SpreadsheetApp.getActive().getSheetByName('Settings').getDataRange().getValues().slice(1);
  return Object.fromEntries(rows.map(r => [String(r[0]).trim(), String(r[1]).trim()]));
}

// Rewrites the header every run, so re-running setup adds new columns to an existing sheet
function sheet_(ss, name, header) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}
