// ─── ייבוא קבצי בנק וכרטיס אשראי ─────────────────────────────────────────────
// קורא קובץ אקסל של בנק הפועלים (תנועות בחשבון) או של ישראכרט (פירוט עסקאות)
// ומחזיר רשימת תנועות אחידה. הכול רץ בדפדפן — הקובץ לא נשלח לשום מקום.
// אין כאן שמות בתי עסק ספציפיים: הקוד הזה גלוי לכל.

(function (root) {
  const CATEGORIES = [
    'מזון וסופר', 'אוכל בחוץ', 'רכב ותחבורה', 'ביטוחים', 'בריאות',
    'הלוואות ומימון', 'עמלות וריבית', 'מנויים ודיגיטל', 'ביגוד וקניות',
    'פנאי וספורט', 'בית וחשבונות', 'אחר',
    'הכנסה', 'לא להכליל',
  ];

  // מילות מפתח כלליות לסיווג ראשוני. סיווג שהמשתמש בוחר גובר עליהן.
  const KEYWORDS = [
    ['עמלות וריבית',   ['רבית', 'ריבית', 'עמלה', 'עמלת', 'ע.מפעולות', 'דמי כרטיס', "עמ' "]],
    ['הלוואות ומימון', ['מימון', 'הלוואה', 'הלואה']],
    ['ביטוחים',        ['ביטוח', 'בטוח', 'הראל', 'מנורה', 'מגדל', 'הפניקס', 'כלל ', 'איילון']],
    ['בריאות',         ['קופ"ח', 'קופח', 'מכבי', 'כללית', 'מאוחדת', 'לאומית', 'סופר-פארם', 'סופר פארם', 'מרקחת', 'רופא', 'מרפאה']],
    ['רכב ותחבורה',    ['סונול', 'פז ', 'דלק', 'דור אלון', 'yellow', 'חניון', 'חניה', 'פנגו', 'סלופארק', 'דרך ארץ', 'כביש 6', 'איתוראן', 'מוסך', 'רב-קו', 'רב קו', 'gett', 'uber']],
    ['מזון וסופר',     ['סופר', 'מאפי', 'מינימרקט', 'שופרסל', 'רמי לוי', 'ויקטורי', 'יוחננוף', 'ספאר', 'אושר עד', 'טיב טעם', 'מגה ', 'ירקות', 'פירות', 'אטליז', 'קצביה', 'מכולת']],
    ['אוכל בחוץ',      ['פיצה', 'קפה', 'cafe', 'coffee', 'מסעדה', 'מסעדת', 'בורגר', 'burger', 'סושי', 'שווארמה', 'פלאפל', 'גלידה', 'wolt', 'וולט', 'תן ביס', '10bis']],
    ['מנויים ודיגיטל', ['google', 'openai', 'netflix', 'spotify', 'apple', 'microsoft', 'anthropic', 'claude', 'youtube', 'דיסני', 'disney', 'סלקום', 'פרטנר', 'הוט ', 'בזק', 'גולן', 'yes ']],
    ['ביגוד וקניות',   ['aliexpress', 'amazon', 'shein', 'temu', 'ikea', 'איקאה', 'קסטרו', 'זארה', 'zara', 'h&m', 'פוקס', 'שילב', 'ace', 'הום סנטר']],
    ['פנאי וספורט',    ['כושר', 'gym', 'סינמה', 'קולנוע', 'cinema', 'הופעה', 'כרטיסים', 'מפעל הפיס', 'לוטו']],
    ['בית וחשבונות',   ['חשמל', 'מים ', 'תאגיד', 'ארנונה', 'עירית', 'עיריית', 'מועצה', 'גז ', 'ועד בית', 'שכירות']],
  ];

  // חיובי כרטיס אשראי בדוח הבנק — מדלגים, כי הפירוט מגיע מקובץ הכרטיס
  const CARD_CHARGE = /מסטרקר|ישראכרט|ויזה|visa|כאל|לאומי קארד|מקס איט|אמריקן אקספרס|דיינרס/i;

  const norm = s => String(s == null ? '' : s).replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
  // מסיר מספרי זהות/חשבון מתיאורים לפני שמירה
  const scrub = s => norm(s).replace(/מזהה\s*\d+/g, '').replace(/\d[\d-]{6,}\d/g, '').replace(/\s+/g, ' ').trim();

  // מפתח לבית עסק — ללמידת הסיווג. בכרטיס: שתי המילים הראשונות (שמות נחתכים/משתנים בסוף).
  const merchantKey = (desc, source) => {
    const words = norm(desc).toLowerCase().replace(/[."'׳״]/g, '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    return words.slice(0, source === 'card' ? 2 : 5).join(' ') || 'ללא שם';
  };
  // מפתח בטוח ל-Firebase (אסור . # $ [ ] /)
  const fbKey = s => String(s).replace(/[.#$\[\]\/]/g, '_');

  const guessCategory = (desc, isIncome) => {
    if (isIncome) return 'הכנסה';
    const d = ' ' + norm(desc).toLowerCase() + ' ';
    for (const [cat, words] of KEYWORDS) if (words.some(w => d.includes(w.toLowerCase()))) return cat;
    return 'אחר';
  };

  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = v => {
    // תאריכי אקסל עלולים לזוז בכמה שעות בגלל אזור זמן — מעגלים לצהריים
    if (v instanceof Date && !isNaN(v)) return toISO(new Date(v.getTime() + 12 * 3600e3));
    const m = norm(v).match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (!m) return null;
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  };
  const addMonths = (iso, n) => {
    const [y, m] = iso.split('-').map(Number);
    const t = (y * 12 + (m - 1)) + n;
    return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}-01`;
  };
  const money = v => {
    if (typeof v === 'number') return v;
    const n = parseFloat(norm(v).replace(/[₪,\s]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  // ── בנק הפועלים: שורת כותרת עם "חובה" ו"זכות" ──
  function parseBank(rows) {
    const h = rows.findIndex(r => r.some(c => norm(c) === 'חובה') && r.some(c => norm(c) === 'זכות'));
    if (h < 0) return null;
    const col = name => rows[h].findIndex(c => norm(c) === name);
    const c = { date: col('תאריך'), action: col('הפעולה'), details: col('פרטים'), ref: col('אסמכתא'),
                debit: col('חובה'), credit: col('זכות'), forWhom: col('עבור') };
    const out = [];
    let skippedCard = 0, skippedCardSum = 0;
    for (const r of rows.slice(h + 1)) {
      const date = parseDate(r[c.date]);
      if (!date) continue;
      const action = norm(r[c.action]);
      const debit = money(r[c.debit]), credit = money(r[c.credit]);
      if (!debit && !credit) continue;
      if (CARD_CHARGE.test(action)) { skippedCard++; skippedCardSum += debit - credit; continue; }
      const forWhom = c.forWhom >= 0 ? scrub(r[c.forWhom]) : '';
      const desc = (/העברה|הפקדה|זיכוי|משיכה|העב'/.test(action) && forWhom) ? `${action} – ${forWhom}` : action;
      const isIncome = credit > 0 && !debit;
      out.push({
        id: fbKey(`b_${date}_${norm(r[c.ref])}_${debit || -credit}`),
        date, month: date.slice(0, 7), source: 'bank', desc,
        amount: isIncome ? credit : debit,   // חיובי תמיד; הסוג קובע אם הכנסה
        type: isIncome ? 'income' : 'expense',
        note: '',
      });
    }
    return { kind: 'bank', tx: out, skippedCard, skippedCardSum };
  }

  // ── ישראכרט: מקטעים עם כותרת "שם בית עסק". נקלט רק מקטע שיש בו "סכום חיוב" ──
  function parseCard(rows) {
    if (!rows.some(r => r.some(c => norm(c) === 'שם בית עסק'))) return null;
    const out = [];
    let c = null;
    for (const r of rows) {
      const cells = r.map(norm);
      if (cells.includes('שם בית עסק')) {
        const ix = n => cells.indexOf(n);
        c = ix('סכום חיוב') < 0 ? null   // "עסקאות שטרם נקלטו" — יגיעו בקובץ הבא
          : { date: ix('תאריך רכישה'), name: ix('שם בית עסק'), charge: ix('סכום חיוב'), voucher: ix("מס' שובר"), note: ix('פירוט נוסף') };
        continue;
      }
      if (!c) continue;
      const date = parseDate(r[c.date]);
      if (!date) continue;
      const amount = money(r[c.charge]);
      if (!amount) continue;
      const note = c.note >= 0 ? norm(r[c.note]) : '';
      const voucher = c.voucher >= 0 ? norm(r[c.voucher]) : '';
      // תשלומים: כל תשלום משויך לחודש שלו (חודש הרכישה + מספר התשלום − 1)
      const inst = note.match(/תשלום\s+(\d+)\s+מתוך\s+(\d+)/);
      const month = (inst ? addMonths(date, +inst[1] - 1) : date).slice(0, 7);
      const desc = norm(r[c.name]);
      out.push({
        id: fbKey(`c_${voucher || date + '_' + desc}_${inst ? inst[1] : 0}`),
        date, month, source: 'card', desc,
        amount, type: 'expense',   // זיכוי בכרטיס = סכום שלילי
        note: inst ? `תשלום ${inst[1]}/${inst[2]}` : (/הוראת קבע/.test(note) ? 'הוראת קבע' : ''),
      });
    }
    return { kind: 'card', tx: out };
  }

  function parseWorkbook(XLSX, data) {
    const wb = XLSX.read(data, { type: 'array', cellDates: true });
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
      const res = parseBank(rows) || parseCard(rows);
      if (res) return res;
    }
    return null;
  }

  root.PersonalImport = { CATEGORIES, parseWorkbook, guessCategory, merchantKey, fbKey };
})(typeof window !== 'undefined' ? window : globalThis);
