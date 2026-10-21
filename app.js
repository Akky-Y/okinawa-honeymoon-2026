(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const STORE_KEY = "okinawa.pass";
  const TZ = "Asia/Tokyo";
  const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  const STATUS = { confirmed: "確定", tentative: "案", check: "要確認", info: "" };

  // ---------- crypto（tools/crypt.mjs と同じパラメータ） ----------
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function decrypt(enc, pass) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: unb64(enc.salt), iterations: enc.iter, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(enc.iv) }, key, unb64(enc.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // ---------- date helpers ----------
  function todayISO() {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
  }
  function parts(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return { m, d, w };
  }
  const mapUrl = (q) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

  // ---------- render ----------
  function render(data, updated) {
    $("#couple").textContent = data.couple || "";
    $("#title").textContent = data.title;
    $("#subtitle").textContent = data.subtitle || "";
    const today = todayISO();
    const tpl = $("#day-tpl");
    const daysEl = $("#days");
    const nav = $("#daynav");
    daysEl.replaceChildren();
    nav.replaceChildren();
    let todayDay = null;

    for (const day of data.days) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const { m, d, w } = parts(day.date);
      const rel = day.date < today ? "past" : day.date === today ? "today" : "future";
      node.id = "d" + day.date;
      node.classList.add(rel);
      node.style.setProperty("--day-color", day.color || "");
      $(".day-emoji", node).textContent = day.emoji || "📍";
      if (day.image) { const img = $(".day-img", node); img.src = day.image; img.hidden = false; }
      $(".day-date .d", node).textContent = `${m}/${d}`;
      $(".day-date .w", node).textContent = `（${w}）`;
      $(".day-theme", node).textContent = day.theme || "";
      if (rel === "today") todayDay = day;

      const ul = $(".items", node);
      for (const it of day.items || []) {
        const li = document.createElement("li");
        li.className = "item" + (it.status === "move" ? " move" : "");
        const t = document.createElement("span"); t.className = "t"; t.textContent = it.time || "";
        const c = document.createElement("span"); c.className = "c";
        const ti = document.createElement("span"); ti.className = "ti"; ti.textContent = it.title;
        c.append(ti);
        if (it.status && STATUS[it.status]) { const b = document.createElement("span"); b.className = "badge " + it.status; b.textContent = STATUS[it.status]; c.append(b); }
        if (it.map) { const a = document.createElement("a"); a.className = "map"; a.href = mapUrl(it.map); a.target = "_blank"; a.rel = "noopener"; a.textContent = "地図 ↗"; c.append(a); }
        if (it.note) { const n = document.createElement("span"); n.className = "no"; n.textContent = it.note; c.append(n); }
        li.append(t, c);
        ul.append(li);
      }

      const stayEl = $(".stay", node);
      if (day.stay) {
        const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = "🛏 宿泊";
        const nm = document.createElement("span"); nm.textContent = day.stay.name;
        stayEl.append(lbl, nm);
        if (day.stay.status && STATUS[day.stay.status]) { const b = document.createElement("span"); b.className = "badge " + day.stay.status; b.textContent = STATUS[day.stay.status]; stayEl.append(b); }
        if (day.stay.map) { const a = document.createElement("a"); a.className = "map"; a.href = mapUrl(day.stay.map); a.target = "_blank"; a.rel = "noopener"; a.textContent = "地図 ↗"; stayEl.append(a); }
        if (day.stay.note) { const n = document.createElement("span"); n.className = "no"; n.textContent = day.stay.note; stayEl.append(n); }
      } else stayEl.remove();

      const notes = $(".notes", node);
      for (const n of day.notes || []) { const li = document.createElement("li"); li.textContent = n; notes.append(li); }

      daysEl.append(node);

      const a = document.createElement("a");
      a.href = "#" + node.id; a.className = rel; a.textContent = `${m}/${d}${w}`;
      a.addEventListener("click", (ev) => { ev.preventDefault(); goTo(node.id); });
      nav.append(a);
    }
    watchActive();

    const tl = $("#today-line");
    if (todayDay) tl.textContent = `今日 ${todayISO().slice(5).replace("-", "/")}：${todayDay.theme}`;
    else if (today < data.days[0].date) tl.textContent = "出発まであと少し";
    else tl.textContent = "旅はおしまい。おつかれさまでした";

    const ol = $("#open-list");
    ol.replaceChildren();
    for (const o of data.open || []) { const li = document.createElement("li"); li.textContent = o; ol.append(li); }
    $("#open-section").hidden = !(data.open && data.open.length);

    if (updated) $("#updated").textContent = "更新: " + new Date(updated).toLocaleString("ja-JP", { timeZone: TZ, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

    $("#gate").hidden = true;
    $("#app").hidden = false;
    const target = location.hash ? location.hash.slice(1) : todayDay ? "d" + todayDay.date : null;
    if (target) requestAnimationFrame(() => goTo(target));
  }

  // ---------- 日付タブの選択表示 ----------
  let lockUntil = 0;
  function setActive(id) {
    const nav = $("#daynav");
    for (const a of nav.children) {
      const on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("active", on);
      if (on) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: "smooth" }); // 横方向だけ動かす
    }
  }
  function goTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    lockUntil = Date.now() + 900; // スクロール中に別の日へ乗り換えないように
    setActive(id);
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    history.replaceState(null, "", "#" + id);
  }
  function watchActive() {
    const days = [...document.querySelectorAll(".day")];
    const pick = () => {
      if (Date.now() < lockUntil) return;
      const line = 120; // 固定ナビの少し下
      let cur = days[0];
      for (const d of days) if (d.getBoundingClientRect().top <= line) cur = d;
      setActive(cur.id);
    };
    addEventListener("scroll", pick, { passive: true });
    pick();
  }

  // ---------- boot ----------
  let encPromise = fetch("data/itinerary.enc.json", { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

  function storedPass() { try { return localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY); } catch { return null; } }
  function storePass(p, persist) { try { (persist ? localStorage : sessionStorage).setItem(STORE_KEY, p); } catch {} }
  function clearPass() { try { localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY); } catch {} }

  async function tryOpen(pass, persist) {
    const enc = await encPromise;
    const data = await decrypt(enc, pass);
    storePass(pass, persist);
    render(data, enc.updated);
  }

  $("#gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#gate-error"); err.hidden = true;
    const btn = $("#gate-form button"); btn.disabled = true; btn.textContent = "確認中…";
    try { await tryOpen($("#pass").value, $("#remember").checked); }
    catch { err.hidden = false; const card = $(".gate-card"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); }
    finally { btn.disabled = false; btn.textContent = "開く"; }
  });
  $("#lock").addEventListener("click", () => { clearPass(); location.reload(); });

  const saved = storedPass();
  if (saved) tryOpen(saved, !!localStorage.getItem(STORE_KEY)).catch(() => { clearPass(); });
})();
