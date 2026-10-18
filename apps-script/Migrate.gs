// One-time move from the old Tutes tab to per-student tute columns. Run migrateTutes once, then delete
// the Tutes tab and this file.
// 1) The lesson names in Tutes column A become the tute column headers in Students (J onward).
// 2) Each student gets this month's tutes ticked from the old batch column (first 2 digits of their index).
function migrateTutes() {
  const ss = SpreadsheetApp.getActive();
  const old = ss.getSheetByName('Tutes').getDataRange().getValues();
  const rows = old.slice(1).filter(r => String(r[0]).trim());
  const names = rows.map(r => String(r[0]).trim());

  const st = ss.getSheetByName('Students');
  st.getRange(1, FIXED + 1, 1, names.length).setValues([names]).setFontWeight('bold');
  st.getRange(2, FIXED + 1, st.getMaxRows() - 1, names.length).insertCheckboxes();

  const batch = {}; // '26' -> ['Lesson 02', …]
  old[0].forEach((h, c) => {
    if (c > 0 && String(h).trim()) batch[String(h).trim()] = rows.filter(r => r[c] === true).map(r => String(r[0]).trim());
  });
  const ticks = st.getRange(2, 1, st.getMaxRows() - 1, 1).getValues()
    .map(([i]) => names.map(n => (batch[String(i).trim().slice(0, 2)] || []).includes(n)));
  st.getRange(2, FIXED + 1, ticks.length, names.length).setValues(ticks);
}
