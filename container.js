/* =========================================================
   営業日報アプリ 追加モジュール（container.js）
   ① 「容器」タブ（出庫・回収ログ専用ページ）
   ② オフライン起動（Service Worker）の登録と状態表示
   ③ バックアップの書き出し／読み込み（日報・車両・TODO・容器ログ）
   ※ index.html の </body> の直前で読み込みます。
========================================================= */
(function(){
"use strict";

/* ---------- 設定（ボタンの内容を変えたいときはここだけ書き換えます） ---------- */
/* 区分（画面には文字だけ表示。保存・送信するのは数値コード。1つの記録に区分は1つだけ） */
const STATUS_TABLE = [
  [1,"仕入"],[2,"出庫"],[3,"空受"],[4,"返却"],[5,"検査"],[6,"充填"],[7,"営業充出"],[8,"仮出庫"],[9,"営業充入"],
  [10,"空瓶在庫"],[11,"返品"],[12,"充瓶在庫"],[13,"ラベル再発行"],
  [64,"車載充出"],[65,"車載空出"],[67,"車載充戻"],[68,"車載空戻"],[90,"検査済出し"],[99,"棚卸"]
];
const STATUS_BUTTONS = [2, 3];   // 画面に並べるボタン（出庫・空受）。それ以外は右端の選択欄から選ぶ

/* ガス種（保存・送信するのは数値コードと名前。ボタンには label を表示する）
   label＝ボタンに表示する略称、cap＝選んだときに自動で入る容量（空文字なら空欄）、unit＝単位、adj＝容量の増減ボタンを出す */
const GAS_TABLE = [
  { code:1001, label:"Ace", name:"ｱｾﾁﾚﾝ",       cap:7,  unit:"kg", adj:true },
  { code:1002, label:"O2", name:"酸素",         cap:7,  unit:"㎥" },
  { code:1003, label:"N2", name:"窒素",         cap:7,  unit:"㎥" },
  { code:1004, label:"Ar", name:"アルゴン",     cap:7,  unit:"㎥" },
  { code:1006, label:"CO2", name:"炭酸",         cap:30, unit:"kg" },
  { code:1007, label:"ArCo", name:"アルコミック", cap:7,  unit:"㎥" },
  { code:1008, label:"FRN", name:"フロン",       cap:"", unit:"kg" },
  { code:2001, label:"LP", name:"プロパン",     cap:"", unit:"kg" },
  { code:5001, label:"Me-O2", name:"医療用酸素",   cap:"", unit:"㎥" }
];
const ADJ_STEPS = [-2, -1, 0, 1, 2];
const UNITS = ["㎥","kg"];

const CT_KEY = "containerLogs";
const BACKUP_KEYS = ["meetingLogs","dailyVehicleInfo","todoItems","containerLogs"];
const MAILTO_LIMIT = 50000;

/* ---------- データ ---------- */
let ctLogs = [];
try{ ctLogs = JSON.parse(localStorage.getItem(CT_KEY) || "[]"); }catch(e){ ctLogs = []; }
if(!Array.isArray(ctLogs)) ctLogs = [];

function ctSave(){ localStorage.setItem(CT_KEY, JSON.stringify(ctLogs)); }

function statusName(code){
  const hit = STATUS_TABLE.find(r => r[0] === Number(code));
  return hit ? hit[1] : String(code == null ? "" : code);
}
function curGas(){
  return typeof ctGasSel === "number" ? (GAS_TABLE.find(g => g.code === ctGasSel) || null) : null;
}
function nfkc(s){ return String(s || "").normalize("NFKC"); }

/* 旧版（区分＝出庫/回収の文字、ガス種＝文字だけ）のデータを、コード形式に自動変換する */
(function migrate(){
  let changed = false;
  ctLogs.forEach(l => {
    if(l.status == null){ l.status = (l.type === "回収") ? 3 : 2; changed = true; }
    if("type" in l){ delete l.type; changed = true; }
    if(l.gasCode == null){
      const g = GAS_TABLE.find(x => nfkc(x.name) === nfkc(l.gas));
      l.gasCode = g ? g.code : "";
      if(g) l.gas = g.name;
      changed = true;
    }
  });
  if(changed){ try{ localStorage.setItem(CT_KEY, JSON.stringify(ctLogs)); }catch(e){} }
})();

let ctStatus = 2;           // 区分コード
let ctGasSel = null;        // ガス種：コード(数字)／"other"(その他)／null(未選択)
let ctUnit = UNITS[0];
let ctFilter = "all";
let ctEditId = null;
let ctKana = null;
let ctPicked = null;        // 一覧から選んだ客先 { code, name }
let ctDateTouched = false;  // 日付を手で変えたか（変えていなければ開くたびに今日にする）

const $ = id => document.getElementById(id);

function nowHM(){
  const d = new Date();
  return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}
function newId(){ return Date.now() + "-" + Math.random().toString(36).slice(2,8); }

/* 入力の正規化（全角で入っても半角に直す） */
function normSym(s){ return String(s || "").normalize("NFKC").toUpperCase().replace(/\s+/g,""); }
function normNum(s){ return String(s || "").normalize("NFKC").replace(/\s+/g,""); }

function ctSorted(logs){
  return [...logs].sort((a,b) =>
    (a.date || "").localeCompare(b.date || "") ||
    (a.time || "").localeCompare(b.time || "") ||
    (a.createdAt || "").localeCompare(b.createdAt || ""));
}

/* =========================================================
   見た目（既存アプリのパステル配色に合わせる）
========================================================= */
const style = document.createElement("style");
style.textContent = `
  header .nav-btn{ padding:9px 12px; }
  .nav-btn.active-sky{ background:var(--sky); color:var(--sky-ink); border-color:var(--sky-dark); }

  #containerScreen input[type=date]{
    width:100%; border:1.5px solid var(--line); border-radius:10px;
    padding:11px 12px; font-size:15px; font-family:inherit;
    background:#FFFDF9; color:var(--ink);
  }
  #containerScreen input[type=date]:focus{ outline:none; border-color:var(--lavender-dark); background:#fff; }

  .ct-seg{ display:flex; background:#F2EEE4; border-radius:999px; padding:4px; gap:4px; }
  .ct-seg button{
    flex:1; border:none; background:transparent; padding:10px; border-radius:999px;
    font-family:inherit; font-size:14px; font-weight:700; color:var(--ink-soft); cursor:pointer;
  }
  .ct-seg button.on{ background:#fff; color:var(--ink); box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  .ct-seg button.on.out{ background:var(--sky); color:var(--sky-ink); }
  .ct-seg button.on.in{ background:var(--peach); color:var(--peach-ink); }

  .ct-chip-row{ display:flex; flex-wrap:wrap; gap:8px; }
  .ct-chip-row .chip{ padding:9px 14px; }
  .ct-chip-row .chip.on{ background:var(--butter); border-color:var(--butter-dark); color:var(--butter-ink); font-weight:700; }

  .ct-badge{ display:inline-block; font-size:12px; font-weight:700; padding:2px 10px; border-radius:999px; margin-right:8px; }
  .ct-badge.out{ background:var(--sky); color:var(--sky-ink); }
  .ct-badge.in{ background:var(--peach); color:var(--peach-ink); }
  .ct-badge.oth{ background:var(--lavender); color:var(--lavender-ink); }
  .visit-card.ct-out{ border-left-color:var(--sky); }
  .visit-card.ct-in{ border-left-color:var(--peach); }
  .visit-card.ct-oth{ border-left-color:var(--lavender); }
  #ctStatusSel.sel-on{ border-color:var(--lavender-dark); background:var(--butter); font-weight:700; }

  .ct-status{ font-size:12px; color:var(--ink-soft); text-align:center; margin:10px 4px; line-height:1.6; }
  .ct-status:empty{ display:none; }
  .ct-bcp{ text-align:center; font-size:11px; color:var(--ink-soft); padding:6px 14px 0; letter-spacing:.02em; }
`;
document.head.appendChild(style);

/* =========================================================
   「容器」画面の組み立て
========================================================= */
const section = document.createElement("section");
section.id = "containerScreen";
section.className = "screen";
section.innerHTML = `
  <h2 id="ctTitle">容器ログ</h2>

  <div class="card">
    <div style="display:flex;gap:8px;align-items:stretch;">
      <div class="ct-seg" id="ctStatusSeg" style="flex:2;"></div>
      <select id="ctStatusSel" style="flex:1.2;min-width:0;padding:8px 6px;" aria-label="その他の区分"></select>
    </div>
    <div style="height:14px;"></div>

    <div class="field">
      <label for="ctDate">日付</label>
      <input type="date" id="ctDate">
    </div>
    <div class="field" id="ctTimeField" style="display:none;">
      <label for="ctTime">時刻（編集時のみ）</label>
      <input type="time" id="ctTime">
    </div>

    <div class="field" style="margin-bottom:8px;">
      <label for="ctCustomer">顧客名</label>
      <input type="text" id="ctCustomer" placeholder="例：〇〇商店" autocomplete="off">
    </div>
    <div id="ctKanaArea" style="display:none;">
      <div class="kana-grid" id="ctKanaGrid"></div>
    </div>
    <div class="customer-list" id="ctCustomerList" style="display:none;"></div>

    <div class="row-gap" style="margin-top:6px;">
      <div class="field" style="flex:1;">
        <label for="ctSymbol">記号（英数字）</label>
        <input type="text" id="ctSymbol" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="例：AB1">
      </div>
      <div class="field" style="flex:2;">
        <label for="ctNumber">番号（数字）</label>
        <input type="text" id="ctNumber" inputmode="numeric" autocomplete="off" placeholder="例：12345">
      </div>
    </div>

    <div class="field">
      <label>ガス種</label>
      <div class="ct-chip-row" id="ctGasChips"></div>
      <input type="text" id="ctGasOther" placeholder="ガス種を入力" style="margin-top:8px;display:none;" autocomplete="off">
    </div>

    <div class="field">
      <label for="ctCapacity">容量</label>
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="text" id="ctCapacity" inputmode="decimal" placeholder="例：7" autocomplete="off" style="flex:2;">
        <div class="ct-seg" id="ctUnitSeg" style="flex:1;"></div>
      </div>
    </div>

    <div class="field" id="ctAdjField" style="display:none;">
      <label id="ctAdjLabel">容量の増減</label>
      <div class="ct-chip-row" id="ctAdjRow"></div>
    </div>

    <button class="btn btn-lavender" id="ctSaveButton">記録する</button>
    <div style="text-align:center;"><button class="btn-text" id="ctCancelEdit" style="display:none;">編集をやめる</button></div>
  </div>

  <h2 class="h2-flex"><span>容器ログ（<span id="ctCount">0</span>本）</span></h2>
  <div class="ct-seg" id="ctFilterSeg" style="margin-bottom:10px;"></div>
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
    <input type="text" id="ctSearch" placeholder="記号・番号・顧客名で検索" autocomplete="off" style="flex:2;min-width:0;">
    <input type="date" id="ctFilterDate" aria-label="日付で絞る" style="flex:1.3;min-width:0;">
    <button type="button" class="btn-mini" id="ctFilterClear">解除</button>
  </div>
  <div id="ctList"></div>

  <div class="footer-actions">
    <button class="btn btn-outline-mint" id="ctCsvButton">CSVで書き出す</button>
    <button class="btn btn-outline-mint" id="ctMailButton">容器ログだけメール送信</button>
    <button class="btn btn-outline-pink" id="ctClearButton">容器ログをすべて削除</button>
  </div>
  <div class="ct-status ct-offline-status"></div>
`;
document.querySelector("main").appendChild(section);

/* ---------- 部品の描画 ---------- */
function renderStatus(){
  const seg = $("ctStatusSeg");
  seg.innerHTML = "";
  STATUS_BUTTONS.forEach((code, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-status", String(code));
    b.className = (i === 0 ? "out" : "in") + (ctStatus === code ? " on" : "");
    b.textContent = statusName(code);
    seg.appendChild(b);
  });

  const sel = $("ctStatusSel");
  if(!sel.options.length){
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "その他の区分";
    sel.appendChild(first);
    STATUS_TABLE.filter(r => !STATUS_BUTTONS.includes(r[0])).forEach(r => {
      const o = document.createElement("option");
      o.value = String(r[0]);
      o.textContent = r[1];
      sel.appendChild(o);
    });
  }
  const inSelect = !STATUS_BUTTONS.includes(ctStatus);
  sel.value = inSelect ? String(ctStatus) : "";
  sel.classList.toggle("sel-on", inSelect);
}

function renderModeAndUnit(){
  renderStatus();

  const seg = $("ctUnitSeg");
  seg.innerHTML = "";
  UNITS.forEach(u => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = u;
    b.className = u === ctUnit ? "on" : "";
    b.addEventListener("click", () => { ctUnit = u; renderModeAndUnit(); });
    seg.appendChild(b);
  });
}

function renderGasChips(){
  const box = $("ctGasChips");
  box.innerHTML = "";
  GAS_TABLE.forEach(g => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (ctGasSel === g.code ? " on" : "");
    b.textContent = g.label || g.name;
    b.addEventListener("click", () => pickGas(g.code));
    box.appendChild(b);
  });
  const other = document.createElement("button");
  other.type = "button";
  other.className = "chip" + (ctGasSel === "other" ? " on" : "");
  other.textContent = "その他";
  other.addEventListener("click", () => pickGas("other"));
  box.appendChild(other);

  $("ctGasOther").style.display = (ctGasSel === "other") ? "block" : "none";
  renderAdj();
}

// ガス種を選ぶと、決めておいた容量と単位が自動で入る
function pickGas(sel){
  ctGasSel = sel;
  if(sel === "other"){
    $("ctCapacity").value = "";
    renderGasChips();
    $("ctGasOther").focus();
    return;
  }
  const g = curGas();
  if(g){
    $("ctCapacity").value = (g.cap === "" ? "" : String(g.cap));
    ctUnit = g.unit;
  }
  renderModeAndUnit();
  renderGasChips();
}

// ｱｾﾁﾚﾝなど：基準の容量に -2〜+2 を足し引きするボタン
function renderAdj(){
  const g = curGas();
  const field = $("ctAdjField");
  if(!g || !g.adj){ field.style.display = "none"; return; }
  field.style.display = "block";
  $("ctAdjLabel").textContent = `${g.name}の容量の増減（基準 ${g.cap}${g.unit}）`;

  const row = $("ctAdjRow");
  row.innerHTML = "";
  const cur = Number(normNum($("ctCapacity").value));
  ADJ_STEPS.forEach(k => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (cur === g.cap + k ? " on" : "");
    b.textContent = k === 0 ? "±0" : (k > 0 ? "+" + k : "−" + Math.abs(k));
    b.addEventListener("click", () => {
      $("ctCapacity").value = String(g.cap + k);
      renderAdj();
    });
    row.appendChild(b);
  });
}

const FILTERS = [["all","全て"],["2","出庫"],["3","空受"],["oth","その他"]];

function renderFilter(){
  const seg = $("ctFilterSeg");
  seg.innerHTML = "";
  FILTERS.forEach(([key, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-filter", key);
    b.textContent = label;
    b.className = (key === ctFilter) ? ("on " + (key === "2" ? "out" : key === "3" ? "in" : "")) : "";
    seg.appendChild(b);
  });
}

function passFilter(l){
  if(ctFilter === "oth" && (l.status === 2 || l.status === 3)) return false;
  if(ctFilter !== "all" && ctFilter !== "oth" && String(l.status) !== ctFilter) return false;

  const d = $("ctFilterDate").value;
  if(d && l.date !== d) return false;

  const q = nfkc($("ctSearch").value).toUpperCase().replace(/\s+/g, "");
  if(q){
    const g = GAS_TABLE.find(x => x.code === l.gasCode);
    const hay = nfkc([
      `${l.symbol}-${l.number}`, `${l.symbol}${l.number}`, l.customer, l.gas,
      g ? g.label : "", statusName(l.status)
    ].join(" ")).toUpperCase().replace(/\s+/g, "");
    if(!hay.includes(q)) return false;
  }
  return true;
}

/* ---------- 顧客名の選択（日報アプリの客先名リストを共用） ---------- */
function hasMaster(){
  return !!(typeof customerMaster !== "undefined" && customerMaster && Array.isArray(customerMaster.items));
}

function showCustomerList(items){
  const box = $("ctCustomerList");
  box.innerHTML = "";
  if(items === null){ box.style.display = "none"; return; }

  if(items.length === 0){
    const empty = document.createElement("div");
    empty.className = "customer-empty";
    empty.textContent = "該当する客先はありません";
    box.appendChild(empty);
  }else{
    items.forEach(item => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "customer-item";
      b.textContent = item.n;
      b.addEventListener("click", () => {
        $("ctCustomer").value = item.n;
        ctPicked = { code: item.c || "", name: item.n };
        ctKana = null;
        renderKana();
        showCustomerList(null);
        $("ctSymbol").focus();
      });
      box.appendChild(b);
    });
  }
  box.style.display = "block";
  box.scrollTop = 0;
}

function renderKana(){
  const area = $("ctKanaArea");
  if(!hasMaster()){ area.style.display = "none"; return; }
  area.style.display = "block";

  const grid = $("ctKanaGrid");
  grid.innerHTML = "";
  [...KANA_ROWS.map(r => r[0]), "他"].forEach(row => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kana-btn" + (row === ctKana ? " active" : "");
    b.textContent = row;
    b.addEventListener("click", () => {
      ctKana = (ctKana === row) ? null : row;
      renderKana();
      if(!ctKana){ showCustomerList(null); return; }
      const items = customerMaster.items
        .filter(i => kanaRowOf(i.k) === ctKana)
        .sort((a, b2) => toHiragana(a.k).localeCompare(toHiragana(b2.k), "ja"));
      showCustomerList(items);
    });
    grid.appendChild(b);
  });
}

// 文字を打つと候補が出る（客先名リストがあるときだけ）
$("ctCustomer").addEventListener("input", () => {
  const v = $("ctCustomer").value.trim();
  if(ctPicked && ctPicked.name !== v) ctPicked = null;
  if(!hasMaster()) return;
  if(!v){ showCustomerList(null); return; }
  const hv = toHiragana(v);
  const hits = customerMaster.items
    .filter(i => String(i.n || "").includes(v) || toHiragana(i.k).startsWith(hv))
    .slice(0, 30);
  showCustomerList(hits.length ? hits : null);
});

/* =========================================================
   記録（新規／編集）
========================================================= */
function setFormEditing(editing){
  $("ctSaveButton").textContent = editing ? "更新する" : "記録する";
  $("ctCancelEdit").style.display = editing ? "inline-block" : "none";
  $("ctTitle").textContent = editing ? "容器ログ（編集中）" : "容器ログ";
  $("ctTimeField").style.display = editing ? "block" : "none";
}

function readForm(){
  const g = curGas();
  return {
    status: ctStatus,
    date: $("ctDate").value,
    customer: $("ctCustomer").value.trim(),
    symbol: normSym($("ctSymbol").value),
    number: normNum($("ctNumber").value),
    gasCode: g ? g.code : "",
    gas: ctGasSel === "other" ? $("ctGasOther").value.trim() : (g ? g.name : ""),
    capacity: normNum($("ctCapacity").value),
    unit: ctUnit
  };
}

function saveFromForm(){
  const f = readForm();

  if(!f.date){ showToast("日付を入力してください"); return; }
  if(!f.customer){ showToast("顧客名を入力してください"); $("ctCustomer").focus(); return; }
  if(!/^[A-Z0-9]+$/.test(f.symbol)){ showToast("記号は半角の英数字で入力してください"); $("ctSymbol").focus(); return; }
  if(!/^[0-9]+$/.test(f.number)){ showToast("番号は半角の数字で入力してください"); $("ctNumber").focus(); return; }
  if(ctGasSel === null){ showToast("ガス種を選んでください"); return; }
  if(!f.gas){ showToast("ガス種を入力してください"); $("ctGasOther").focus(); return; }
  if(f.capacity !== "" && !/^\d+(\.\d+)?$/.test(f.capacity)){ showToast("容量は数字で入力してください"); $("ctCapacity").focus(); return; }

  const dup = ctLogs.find(l => l.id !== ctEditId && l.date === f.date && l.status === f.status &&
                               l.symbol === f.symbol && l.number === f.number);
  if(dup && !window.confirm(`${f.symbol}-${f.number} は同じ日に「${statusName(f.status)}」で記録済みです。\nもう一度記録しますか？`)) return;

  let code = "";
  if(ctPicked && ctPicked.name === f.customer) code = ctPicked.code || "";
  else if(typeof resolveCustomerCode === "function") code = resolveCustomerCode(f.customer) || "";

  if(ctEditId){
    const log = ctLogs.find(x => x.id === ctEditId);
    if(log){
      Object.assign(log, f, { customerCode: code });
      const t = $("ctTime").value;
      if(t) log.time = t;
    }
    ctEditId = null;
    showToast("更新しました");
  }else{
    ctLogs.push(Object.assign({ id:newId(), time:nowHM() }, f, { customerCode: code, createdAt:new Date().toISOString() }));
    showToast(`${statusName(f.status)}を記録しました`);
  }
  ctSave();

  // 続けて入力しやすいよう、番号だけ消す（区分・顧客・ガス種・容量・記号は残す）
  $("ctNumber").value = "";
  setFormEditing(false);
  renderList();
  $("ctNumber").focus();
}

function startEdit(id){
  const l = ctLogs.find(x => x.id === id);
  if(!l) return;
  ctEditId = id;
  ctStatus = Number(l.status);
  ctUnit = l.unit || UNITS[0];
  ctDateTouched = true;
  $("ctDate").value = l.date;
  $("ctTime").value = l.time || "";
  $("ctCustomer").value = l.customer || "";
  ctPicked = l.customerCode ? { code:l.customerCode, name:l.customer } : null;
  $("ctSymbol").value = l.symbol || "";
  $("ctNumber").value = l.number || "";
  if(typeof l.gasCode === "number" && GAS_TABLE.some(g => g.code === l.gasCode)){
    ctGasSel = l.gasCode;
    $("ctGasOther").value = "";
  }else if(l.gas){
    ctGasSel = "other";
    $("ctGasOther").value = l.gas;
  }else{
    ctGasSel = null;
    $("ctGasOther").value = "";
  }
  $("ctCapacity").value = l.capacity || "";
  showCustomerList(null);
  renderModeAndUnit();
  renderGasChips();
  setFormEditing(true);
  window.scrollTo({ top:0, behavior:"auto" });
}

function cancelEdit(){
  ctEditId = null;
  $("ctNumber").value = "";
  setFormEditing(false);
}

/* =========================================================
   一覧
========================================================= */
function renderList(){
  const list = $("ctList");
  list.innerHTML = "";

  const logs = ctLogs
    .filter(passFilter)
    .sort((a,b) =>
      (b.date || "").localeCompare(a.date || "") ||
      (b.time || "").localeCompare(a.time || "") ||
      (b.createdAt || "").localeCompare(a.createdAt || ""));

  $("ctCount").textContent = logs.length;

  if(logs.length === 0){
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "容器ログはまだありません";
    list.appendChild(empty);
    return;
  }

  const todayStr = getToday();
  const outByDate = {}, inByDate = {}, othByDate = {};
  logs.forEach(l => {
    const m = l.status === 2 ? outByDate : (l.status === 3 ? inByDate : othByDate);
    m[l.date] = (m[l.date] || 0) + 1;
  });

  const MAX_SHOW = 200;
  const shown = logs.slice(0, MAX_SHOW);

  let lastDate = null;
  shown.forEach(l => {
    if(l.date !== lastDate){
      lastDate = l.date;
      const head = document.createElement("div");
      head.className = "day-header";
      head.innerHTML = `<span>${escapeHtml(formatDayLabel(l.date, todayStr))}</span>` +
                       `<span>出庫${outByDate[l.date] || 0}・空受${inByDate[l.date] || 0}・他${othByDate[l.date] || 0}</span>`;
      list.appendChild(head);
    }

    const cls = l.status === 2 ? "out" : (l.status === 3 ? "in" : "oth");
    const card = document.createElement("div");
    card.className = "visit-card ct-" + cls;
    const capText = (l.capacity !== "" && l.capacity != null) ? `　${escapeHtml(l.capacity)}${escapeHtml(l.unit || "")}` : "";
    card.innerHTML = `
      <div class="top">
        <span class="target"><span class="ct-badge ${cls}">${escapeHtml(statusName(l.status))}</span>${escapeHtml(l.symbol)}-${escapeHtml(l.number)}</span>
        <span class="time">${escapeHtml(l.time || "")}</span>
      </div>
      <div class="meta">${escapeHtml(l.customer || "")}</div>
      <div class="meta">${escapeHtml(l.gas || "")}${capText}</div>
      <div class="row-gap">
        <button class="card-action edit ct-edit" data-id="${escapeHtml(l.id)}">編集</button>
        <button class="card-action delete ct-del" data-id="${escapeHtml(l.id)}">削除</button>
      </div>
    `;
    list.appendChild(card);
  });
}

$("ctList").addEventListener("click", e => {
  const edit = e.target.closest(".ct-edit");
  const del = e.target.closest(".ct-del");
  if(edit){ startEdit(edit.getAttribute("data-id")); return; }
  if(del){
    const id = del.getAttribute("data-id");
    const l = ctLogs.find(x => x.id === id);
    if(!l) return;
    if(!window.confirm(`${l.symbol}-${l.number}（${statusName(l.status)}）を削除しますか？`)) return;
    ctLogs = ctLogs.filter(x => x.id !== id);
    if(ctEditId === id) cancelEdit();
    ctSave();
    renderList();
    showToast("削除しました");
  }
});

/* =========================================================
   書き出し・メール
========================================================= */
const CSV_HEAD = ["日付","時刻","区分コード","区分","記号","番号","顧客コード","顧客名","ガス種コード","ガス種","容量","単位"];

function cell(v){ return String(v == null ? "" : v).replace(/[,\r\n\t"]/g, " ").trim(); }

function csvLines(logs){
  return ctSorted(logs).map(l =>
    [l.date, l.time, l.status, statusName(l.status), l.symbol, l.number, l.customerCode, l.customer, l.gasCode, l.gas, l.capacity, l.unit].map(cell).join(","));
}

function csvText(logs){ return [CSV_HEAD.join(","), ...csvLines(logs)].join("\r\n"); }

async function saveFile(name, content, mime, withBom){
  const blob = new Blob([withBom ? "\ufeff" + content : content], { type: mime });
  try{
    const file = new File([blob], name, { type: mime });
    if(navigator.canShare && navigator.canShare({ files:[file] })){
      await navigator.share({ files:[file], title:name });
      return;
    }
  }catch(err){
    if(err && err.name === "AbortError") return;   // 共有画面を閉じただけ
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

$("ctCsvButton").addEventListener("click", () => {
  if(ctLogs.length === 0){ showToast("容器ログがありません"); return; }
  saveFile(`容器ログ_${getToday().replace(/-/g,"")}.csv`, csvText(ctLogs), "text/csv", true);
});

$("ctMailButton").addEventListener("click", () => {
  if(ctLogs.length === 0){ showToast("容器ログがありません"); return; }
  const subject = `容器ログ ${getToday()}`;
  const body = "容器ログ\n\n" + csvText(ctLogs).replace(/\r\n/g, "\n");
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if(mailto.length > MAILTO_LIMIT){
    copyToClipboard(body);
    showToast("本文が長いためコピーしました。メールに貼り付けてください");
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("（本文が長いため、コピーしました。ここに貼り付けてください）")}`;
    return;
  }
  window.location.href = mailto;
});

$("ctClearButton").addEventListener("click", () => {
  if(ctLogs.length === 0){ showToast("容器ログがありません"); return; }
  if(!window.confirm(`容器ログ ${ctLogs.length}件をすべて削除します。\nメール送信・CSV書き出しは済んでいますか？\n\nこの操作は元に戻せません。\n\n削除しますか？`)) return;
  ctLogs = [];
  ctSave();
  cancelEdit();
  renderList();
  showToast("容器ログを削除しました");
});

/* 日報メールの末尾に「容器ログ」を追加する */
const origBuildReportMail = window.buildReportMail;
if(typeof origBuildReportMail === "function"){
  window.buildReportMail = function(){
    const r = origBuildReportMail();
    if(ctLogs.length > 0){
      r.body += "【容器ログ】\n" + CSV_HEAD.join(",") + "\n" + csvLines(ctLogs).join("\n") + "\n";
    }
    return r;
  };
}

/* 「全データを削除」「TODOを残して削除」で容器ログも一緒に消す */
window.deleteData = function(keepTodos){
  const message = keepTodos
    ? "営業日報・車両情報・容器ログを削除します。TODOリストは残します。\n\nこの操作は元に戻せません。\n\n削除しますか？"
    : "保存されている営業日報・車両情報・容器ログ・TODOリストをすべて削除します。\n\nこの操作は元に戻せません。\n\n削除しますか？";
  if(!window.confirm(message)) return;

  localStorage.removeItem("meetingLogs");
  localStorage.removeItem("dailyVehicleInfo");
  localStorage.removeItem(CT_KEY);
  meetingLogs = [];
  dailyVehicleInfo = {};
  ctLogs = [];
  cancelEdit();

  if(!keepTodos){
    localStorage.removeItem("todoItems");
    todoItems = [];
  }
  currentVisit = null;

  goToReport();
  showToast(keepTodos ? "TODO以外を削除しました" : "全データを削除しました");
};

/* =========================================================
   バックアップ（ホーム画面の下部にボタンを追加）
========================================================= */
function backupExport(){
  const data = {};
  BACKUP_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if(v !== null) data[k] = v;
  });
  const obj = { app:"eigyo-nippo", version:1, exportedAt:new Date().toISOString(), data };
  saveFile(`営業日報バックアップ_${getToday().replace(/-/g,"")}.json`, JSON.stringify(obj), "application/json", false);
}

const backupFile = document.createElement("input");
backupFile.type = "file";
backupFile.accept = ".json,application/json";
backupFile.style.display = "none";
document.body.appendChild(backupFile);

backupFile.addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if(!file) return;
  let obj;
  try{
    obj = JSON.parse(await file.text());
  }catch(err){
    showToast("バックアップファイルを読み込めません");
    return;
  }
  if(!obj || obj.app !== "eigyo-nippo" || !obj.data){
    showToast("営業日報のバックアップではありません");
    return;
  }
  const when = obj.exportedAt ? new Date(obj.exportedAt).toLocaleString("ja-JP") : "日時不明";
  if(!window.confirm(`${when} のバックアップで、今のデータを置き換えます。\n\n今のデータは消えます。よろしいですか？`)) return;

  BACKUP_KEYS.forEach(k => {
    if(typeof obj.data[k] === "string") localStorage.setItem(k, obj.data[k]);
    else localStorage.removeItem(k);
  });
  location.reload();
});

const footerActions = document.querySelector("#reportScreen .footer-actions");
if(footerActions){
  const row = document.createElement("div");
  row.className = "row-gap delete-row";
  row.innerHTML =
    '<button class="btn btn-outline-mint" id="backupExportButton">バックアップを保存</button>' +
    '<button class="btn btn-outline-mint" id="backupImportButton">バックアップから戻す</button>';
  footerActions.insertBefore(row, footerActions.querySelector(".delete-row"));

  const status = document.createElement("div");
  status.className = "ct-status ct-offline-status";
  footerActions.appendChild(status);

  $("backupExportButton").addEventListener("click", backupExport);
  $("backupImportButton").addEventListener("click", () => backupFile.click());
}

/* =========================================================
   オフライン保存の状態表示と Service Worker の登録
========================================================= */
// 正常なときは何も表示しない。保存できていないときだけ、小さく注意を出す
async function updateOfflineStatus(){
  const els = document.querySelectorAll(".ct-offline-status");
  if(els.length === 0) return;

  let text = "";
  if(location.protocol !== "file:"){
    if(!("serviceWorker" in navigator) || !window.caches){
      text = "⚠ この環境ではオフライン保存を使えません";
    }else{
      let ok = false;
      try{ ok = !!(await caches.match("index.html")) || !!(await caches.match("./")); }catch(e){ ok = false; }
      if(!ok) text = "⚠ オフライン保存が未完了です。電波のある場所で、このアプリをもう一度開いてください";
    }
  }
  els.forEach(el => { el.textContent = text; });
}

function registerServiceWorker(){
  if(!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)){
    updateOfflineStatus();
    return;
  }
  navigator.serviceWorker.register("sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => setTimeout(updateOfflineStatus, 1500))
    .catch(() => updateOfflineStatus());
}

if(document.readyState === "complete") registerServiceWorker();
else window.addEventListener("load", registerServiceWorker);

/* ホーム画面に追加するための設定（index.html に書いてあれば何もしません） */
if(!document.querySelector('link[rel="manifest"]')){
  const l = document.createElement("link");
  l.rel = "manifest";
  l.href = "manifest.webmanifest";
  document.head.appendChild(l);
}
if(!document.querySelector('link[rel="apple-touch-icon"]')){
  const l = document.createElement("link");
  l.rel = "apple-touch-icon";
  l.href = "icon-180.png";
  document.head.appendChild(l);
}

/* =========================================================
   ナビゲーション（ヘッダーに「容器」ボタンを追加）
========================================================= */
const bcp = document.createElement("div");
bcp.className = "ct-bcp";
bcp.textContent = "BCP対応（オフライン使用可能）";
document.querySelector("header").insertAdjacentElement("afterend", bcp);

const navBtn = document.createElement("button");
navBtn.className = "nav-btn";
navBtn.id = "navContainerButton";
navBtn.textContent = "容器";
$("navVehicleButton").insertAdjacentElement("afterend", navBtn);

const origUpdateNav = window.updateNav;
window.updateNav = function(name){
  origUpdateNav(name);
  const isContainer = (name === "container");
  if(isContainer){
    $("navHomeButton").classList.remove("active-mint");
    $("navVehicleButton").classList.remove("active-peach");
  }
  navBtn.classList.toggle("active-sky", isContainer);
};

function renderContainer(){
  if(!ctDateTouched && !ctEditId) $("ctDate").value = getToday();
  renderModeAndUnit();
  renderGasChips();
  renderKana();
  renderFilter();
  renderList();
}

function goToContainer(){
  vehicleViewMode = null;
  renderContainer();
  showScreen("container");
  updateNav("container");
}

navBtn.addEventListener("click", () => {
  if(!confirmLeaveVisitIfNeeded()) return;
  currentVisit = null;
  goToContainer();
});

/* ---------- 入力部品のイベント ---------- */
$("ctStatusSeg").addEventListener("click", e => {
  const b = e.target.closest("button");
  if(!b) return;
  ctStatus = Number(b.getAttribute("data-status"));
  renderStatus();
});

$("ctStatusSel").addEventListener("change", () => {
  const v = $("ctStatusSel").value;
  if(v === "") return;
  ctStatus = Number(v);
  renderStatus();
});

$("ctFilterSeg").addEventListener("click", e => {
  const b = e.target.closest("button");
  if(!b) return;
  ctFilter = b.getAttribute("data-filter");
  renderFilter();
  renderList();
});

$("ctDate").addEventListener("change", () => { ctDateTouched = true; });

/* 検索・日付での絞り込み（過去の記録を後から探す） */
$("ctSearch").addEventListener("input", renderList);
$("ctFilterDate").addEventListener("change", renderList);
$("ctFilterClear").addEventListener("click", () => {
  $("ctSearch").value = "";
  $("ctFilterDate").value = "";
  renderList();
});
$("ctCapacity").addEventListener("input", renderAdj);
$("ctSaveButton").addEventListener("click", saveFromForm);
$("ctCancelEdit").addEventListener("click", cancelEdit);

})();
