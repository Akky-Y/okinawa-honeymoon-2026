// 出発時刻を選ぶと、その日の予定を組み直す。
// 任意の立ち寄り先（optional）の組み合わせを全部試し、締め切り（latest = 遅くともこの時刻に着く）を
// すべて満たすものの中から score 合計が最大、同点なら早く終わるものを選ぶ。
(() => {
  "use strict";
  const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const toStr = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

  function simulate(pl, start, keep) {
    const route = pl.stops.filter((s) => !s.optional || keep.has(s.id));
    let prev = pl.origin, t = start, ok = true;
    const out = [];
    for (const s of route) {
      const leg = pl.legs[`${prev}>${s.id}`];
      if (!leg) return null; // その経路は定義なし
      const arrive = t + leg[0];
      const late = s.latest && arrive > toMin(s.latest);
      if (late) ok = false;
      out.push({ stop: s, leg, arrive, depart: arrive + (s.stay || 0), late });
      t = arrive + (s.stay || 0);
      prev = s.id;
    }
    return { ok, out, end: t };
  }

  function plan(pl, startStr) {
    const start = toMin(startStr);
    const opt = pl.stops.filter((s) => s.optional);
    let best = null;
    for (let mask = 0; mask < 1 << opt.length; mask++) {
      const keep = new Set(opt.filter((_, i) => mask & (1 << i)).map((s) => s.id));
      const r = simulate(pl, start, keep);
      if (!r || !r.ok) continue;
      const score = opt.reduce((a, s) => a + (keep.has(s.id) ? s.score || 1 : 0), 0);
      if (!best || score > best.score || (score === best.score && r.end < best.r.end)) best = { score, keep, r };
    }
    if (!best) { // どの組み合わせでも締め切りに間に合わない → 任意は全部削って遅れを表示
      const keep = new Set();
      best = { score: 0, keep, r: simulate(pl, start, keep) };
    }
    // 表示用 items を組み立て
    const items = [...(pl.head || [])];
    items.push({ time: startStr, title: "ビオスの丘 出発", status: "confirmed", _pick: true });
    for (const x of best.r.out) {
      items.push({ time: "", title: `🚗 約 ${x.leg[0]} 分 / ${x.leg[1]}`, status: "move" });
      const s = x.stop;
      const stayTxt = s.stay ? `${toStr(x.arrive)} 着 → ${toStr(x.depart)} 発` : `${toStr(x.arrive)} 着`;
      items.push({
        time: toStr(x.arrive), title: s.title, status: x.late ? "check" : "confirmed", map: s.map,
        note: [stayTxt, x.late ? `締め切り ${s.latest} に遅れる` : "", s.note || ""].filter(Boolean).join(" / "),
      });
    }
    const cut = opt.filter((s) => !best.keep.has(s.id));
    for (const s of cut) items.push({ time: "削る", title: s.title, status: "cut", note: s.why });
    items.push(...(pl.tail || []));
    return items;
  }

  window.Planner = { plan, toMin, toStr };
})();
