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
const AZURE_GRAY = "#6F8CA3";
const GAS_TABLE = [
  { code:1001, label:"Ace",      name:"ｱｾﾁﾚﾝ",       cap:7,  unit:"kg", adj:true, bg:"#C2694B", fg:"#fff" },   // 明るめの赤褐色
  { code:1002, label:"O2",       name:"酸素",         cap:7,  unit:"㎥", bg:"#222222", fg:"#fff" },              // 黒
  { code:1003, label:"N2",       name:"窒素",         cap:7,  unit:"㎥", bg:AZURE_GRAY, fg:"#fff" },            // アズールグレー
  { code:1004, label:"Ar",       name:"アルゴン",     cap:7,  unit:"㎥", bg:AZURE_GRAY, fg:"#fff" },
  { code:1006, label:"CO2",      name:"炭酸",         cap:30, unit:"kg", bg:"#3F9A5E", fg:"#fff" },              // 緑
  { code:1007, label:"ArCo",     name:"アルコミック", cap:7,  unit:"㎥", fg:"#fff", shadow:true,                 // アズールグレーに緑縞
    bg:"linear-gradient(to bottom, " + AZURE_GRAY + " 0 38%, #3F9A5E 38% 62%, " + AZURE_GRAY + " 62% 100%)" },   // 横縞：グレー・緑(細め)・グレー
  { code:1008, label:"フロン",   name:"フロン",       cap:"", unit:"kg", bg:"#A3A9AF", fg:"#1f1f1f" },           // グレー
  { code:2001, label:"LP",       name:"プロパン",     cap:"", unit:"kg", bg:"#A3A9AF", fg:"#1f1f1f" },
  { code:5001, label:"医O2",    name:"医療用酸素",   cap:"", unit:"㎥", bg:"#222222", fg:"#fff" }               // 黒
];
const OTHER_GAS_STYLE = { bg:"#2D87E3", fg:"#fff" };                  // 「その他」ボタン：アズールブルー
const OTHER_GAS_UNIT = "㎥";                                           // 「その他」を選んだときの初期の単位
const ADJ_STEPS = [-0.2, -0.1, 0, 0.1, 0.2];   // ｱｾﾁﾚﾝの容量の増減ボタン（0.0＝基準に戻す）
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
let ctAdding = false;       // 「この顧客に追加」「新しい記録として追加」で、続けて追加入力している状態
let ctKana = null;
let ctPicked = null;        // 一覧から選んだ客先 { code, name }
const ctOpen = new Set();   // 「編集」で開いている顧客カード（日付|顧客名）
let ctDateTouched = false;  // 日付を手で変えたか（変えていなければ開くたびに今日にする）

const $ = id => document.getElementById(id);

function nowHM(){
  const d = new Date();
  return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}
function newId(){ return Date.now() + "-" + Math.random().toString(36).slice(2,8); }

/* 入力の正規化（全角で入っても半角に直す） */
function normSym(s){ return String(s || "").normalize("NFKC").toUpperCase().replace(/\s+/g,""); }
function normNum(s){ return String(s || "").normalize("NFKC").toUpperCase().replace(/\s+/g,""); }

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
  header{ gap:6px; }
  header .nav-btn{ padding:8px 10px; font-size:13px; white-space:nowrap; flex:0 0 auto; }
  .ct-datebox{ display:flex; flex-direction:column; align-items:flex-start; gap:1px; min-width:0; flex:1 1 auto; }
  .ct-datebox #dateDisplay{ display:block; white-space:nowrap; line-height:1.25; }
  .ct-bcpsub{ font-size:10px; font-weight:400; color:var(--ink-soft); white-space:nowrap; line-height:1.2; }
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
  .ct-gas-area{ display:flex; gap:8px; align-items:stretch; }
  .ct-gas-area .ct-chip-row{ flex:1; min-width:0; }
  .ct-gas-vert{
    flex:none; width:34px; min-height:96px; border-radius:10px; overflow:hidden;
    display:flex; align-items:center; justify-content:center; padding:8px 0;
    font-size:14px; font-weight:700; line-height:1.1; letter-spacing:.05em;
    background:#F2EEE4; color:var(--ink-soft);
  }
  .ct-gas-vert span{ writing-mode:vertical-rl; text-orientation:upright; white-space:nowrap; }
  .ct-chip-row .chip .d2{ font-size:70%; }

  #containerScreen #ctDate, #containerScreen #ctTime{
    width:9.5em; max-width:100%; padding:6px 8px; font-size:14px; border-radius:8px;
  }
  #containerScreen #ctCustomer{ font-size:17px; font-weight:700; }
  .ct-cust-right{ display:flex; align-items:center; gap:8px; flex:none; }
  .ct-add{
    border:1.5px solid var(--mint); background:#fff; color:var(--mint-ink); border-radius:999px;
    padding:4px 11px; font-size:12px; font-weight:700; font-family:inherit; cursor:pointer;
  }
  .ct-chip-row .chip.gas{ border:none; font-weight:700; padding:10px 14px; }
  .ct-chip-row .chip.gas.on{ box-shadow:0 0 0 2px #fff, 0 0 0 4px var(--ink); }

  .ct-cust{ background:var(--card); border:1px solid var(--line); border-left:5px solid var(--mint); border-radius:var(--radius); padding:12px 14px 4px; margin-bottom:10px; }
  .ct-cust-head{ display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:4px; }
  .ct-cust-name{ font-size:18px; font-weight:700; min-width:0; overflow-wrap:anywhere; }
  .ct-cust-sum{ font-size:12px; color:var(--ink-soft); white-space:nowrap; }
  .ct-row{ display:flex; align-items:center; gap:8px; padding:9px 0; border-top:1px solid var(--line); }
  .ct-row-main{ flex:1; min-width:0; }
  .ct-row-line1{ font-size:14px; font-weight:700; }
  .ct-row-line2{ font-size:12.5px; color:var(--ink-soft); margin-top:2px; }
  .ct-row .card-action{ flex:0 0 auto; padding:7px 11px; font-size:12px; }

  .ct-datewrap{ position:relative; }
  .ct-dph{ position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:15px; color:var(--ink-soft); pointer-events:none; }
  #containerScreen input[type=date].empty{ color:transparent; }

  .ct-sum-line{ display:flex; align-items:center; flex-wrap:wrap; gap:2px 12px; font-size:14px; padding:3px 0; }
  .ct-sum-line .ct-badge{ margin-right:0; }
  .ct-sum-gas{ white-space:nowrap; }
  .ct-actions{ display:flex; justify-content:flex-end; gap:8px; padding:8px 0 10px; margin-top:6px; border-top:1px solid var(--line); }
  .ct-tog{
    border:1.5px solid var(--lavender-dark); background:#fff; color:var(--lavender-ink); border-radius:999px;
    padding:4px 14px; font-size:12px; font-weight:700; font-family:inherit; cursor:pointer;
  }
  .ct-tog.open{ background:var(--lavender); }

  .ct-inwrap{ position:relative; }
  .ct-inwrap > label.ct-inlab{ position:absolute; left:12px; top:50%; transform:translateY(-50%); margin:0; font-size:11px; color:var(--ink-soft); white-space:nowrap; pointer-events:none; z-index:1; }
  #vehicleTimeText{ margin-left:auto; }
  .ct-datefield{ position:relative; display:flex; align-items:center; gap:10px; min-width:12.5em; padding:11px 12px; border:1.5px solid var(--line); border-radius:10px; background:#FFFDF9; }
  .ct-datefield .ct-inlab{ font-size:11px; color:var(--ink-soft); flex:none; }
  .ct-datefield .ct-datetext{ font-size:15px; white-space:nowrap; }
  #containerScreen .ct-datefield #ctDate{ position:absolute; inset:0; width:100%; max-width:none; height:100%; opacity:0; border:0; padding:0; margin:0; font-size:16px; }
  .ct-numwrap{ position:relative; }
  .ct-numwrap input{ padding-right:60px; }
  .ct-numwrap .ct-numkb{ position:absolute; right:6px; top:50%; transform:translateY(-50%); padding:3px 10px; }
  .ct-adj-row{ display:flex; flex-wrap:nowrap; gap:6px; }
  .ct-adj-row .chip{ flex:1; min-width:0; padding:9px 0; text-align:center; white-space:nowrap; }

  .ct-swrap{ position:relative; overflow:hidden; border-top:1px solid var(--line); }
  .ct-swrap > .ct-row{ border-top:0; position:relative; background:var(--card); touch-action:pan-y; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
  .ct-swbg{ position:absolute; inset:0; display:flex; font-size:13px; font-weight:700; }
  .ct-sw-edit, .ct-sw-del{ flex:1; display:flex; align-items:center; padding:0 18px; }
  .ct-sw-edit{ background:var(--sky); color:var(--sky-ink); justify-content:flex-start; }
  .ct-sw-del{ background:var(--pink); color:var(--pink-ink); justify-content:flex-end; }
  .ct-swipe-hint{ font-size:11px; color:var(--ink-soft); text-align:center; padding:4px 0 6px; }
  .ct-sw-edit{ background:var(--mint); color:var(--mint-ink); }

  .ct-swrap > .ct-row.ct-drow{ display:grid; column-gap:10px; align-items:center; font-size:13px; padding:9px 0 9px 1em; }
  .ct-d1 .ct-badge{ margin-right:0; }
  .ct-d2{ font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight:700; white-space:nowrap; }
  .ct-d3{ min-width:0; overflow-wrap:anywhere; }
  .ct-d4{ text-align:right; white-space:nowrap; }

  .ct-gas-area{ align-items:center; }
  .ct-gasbar-wrap{ position:relative; flex:1; min-width:0; }
  .ct-gasbar{ position:relative; flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; padding:4px 2px; align-items:center; }
  .ct-gasbar::-webkit-scrollbar{ display:none; }
  .ct-gasbar .chip{ flex:none; white-space:nowrap; }
  .ct-gasbar-wrap::before, .ct-gasbar-wrap::after{ content:""; position:absolute; top:0; bottom:0; width:20px; pointer-events:none; z-index:2; opacity:0; transition:opacity .15s; }
  .ct-gasbar-wrap::before{ left:0; background:linear-gradient(to right, rgba(0,0,0,0.22), rgba(0,0,0,0)); }
  .ct-gasbar-wrap::after{ right:0; background:linear-gradient(to left, rgba(0,0,0,0.22), rgba(0,0,0,0)); }
  .ct-gasbar-wrap.has-left::before, .ct-gasbar-wrap.has-right::after{ opacity:1; }
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

    <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
      <div class="ct-datefield">
        <span class="ct-inlab">日付</span>
        <span class="ct-datetext" id="ctDateText"></span>
        <input type="date" id="ctDate" aria-label="日付">
      </div>
      <div id="ctTimeField" style="display:none;">
        <div class="ct-inwrap">
          <label class="ct-inlab" for="ctTime">時刻</label>
          <input type="time" id="ctTime" style="padding-left:46px;">
        </div>
      </div>
    </div>

    <div class="field" style="margin-bottom:8px;">
      <input type="text" id="ctCustomer" placeholder="顧客名" aria-label="顧客名" autocomplete="off">
    </div>
    <div id="ctKanaArea" style="display:none;">
      <div class="kana-grid" id="ctKanaGrid"></div>
    </div>
    <div class="customer-list" id="ctCustomerList" style="display:none;"></div>

    <div class="field">
      <label>ガス種</label>
      <div class="ct-gas-area">
        <div class="ct-gasbar-wrap" id="ctGasWrap"><div class="ct-chip-row ct-gasbar" id="ctGasChips"></div></div>
        <div class="ct-gas-vert" id="ctGasVert"><span></span></div>
      </div>
      <input type="text" id="ctGasOther" placeholder="ガス種を入力" style="margin-top:8px;display:none;" autocomplete="off">
    </div>

    <div class="row-gap" style="margin-top:6px;">
      <div class="field" style="flex:1;">
        <label for="ctSymbol">記号（英数字）</label>
        <input type="text" id="ctSymbol" inputmode="email" lang="en" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="例：AB1">
      </div>
      <div class="field" style="flex:2;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <label for="ctNumber">番号（数字）</label>
          <button type="button" class="btn-mini" id="ctNumKb" style="padding:2px 10px;margin-bottom:6px;" aria-label="キーボードの切り替え">ABC</button>
        </div>
        <input type="text" id="ctNumber" inputmode="numeric" autocomplete="off" placeholder="例：12345">
      </div>
    </div>

    <div class="field">
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="text" id="ctCapacity" inputmode="decimal" maxlength="5" placeholder="容量" aria-label="容量（最大5桁）" autocomplete="off" style="width:7em;flex:none;text-align:right;">
        <div class="ct-seg" id="ctUnitSeg" style="flex:none;width:140px;"></div>
      </div>
    </div>

    <div class="field" id="ctAdjField" style="display:none;">
      <label id="ctAdjLabel">容量の増減</label>
      <div class="ct-adj-row" id="ctAdjRow"></div>
    </div>

    <button class="btn btn-lavender" id="ctSaveButton">記録する</button>
    <button class="btn btn-outline-mint" id="ctCancelEdit" style="display:none;margin-top:8px;">更新をやめる</button>
  </div>

  <h2 class="h2-flex"><span>容器ログ（<span id="ctCount">0</span>本）</span></h2>
  <div class="ct-seg" id="ctFilterSeg" style="margin-bottom:10px;"></div>
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
    <input type="text" id="ctSearch" list="ctCustList" placeholder="客名検索" autocomplete="off" style="flex:2;min-width:0;">
    <datalist id="ctCustList"></datalist>
    <div class="ct-datewrap" style="flex:1.3;min-width:0;">
      <input type="date" id="ctFilterDate" class="empty" aria-label="日付検索">
      <span class="ct-dph" id="ctDatePh">日付検索</span>
    </div>
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
  const prevScroll = box.scrollLeft;          // 作り直しても、滑らせた位置を保つ
  box.innerHTML = "";
  const addChip = (text, st, selected, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip gas" + (selected ? " on" : "");
    b.innerHTML = escapeHtml(text).replace(/2/g, '<span class="d2">2</span>');   // 数字の「2」は3割小さく
    b.style.background = st.bg;
    b.style.color = st.fg;
    if(st.shadow) b.style.textShadow = "0 0 3px rgba(0,0,0,0.6)";
    b.addEventListener("click", onClick);
    box.appendChild(b);
  };
  GAS_TABLE.forEach(g => addChip(g.label || g.name, g, ctGasSel === g.code, () => pickGas(g.code)));
  addChip("その他", OTHER_GAS_STYLE, ctGasSel === "other", () => pickGas("other"));

  box.scrollLeft = prevScroll;
  const on = box.querySelector(".chip.on");   // 選んだボタンは、見える位置へ寄せる
  if(on){
    const L = on.offsetLeft, R = L + on.offsetWidth;
    if(L < box.scrollLeft + 8) box.scrollLeft = Math.max(0, L - 8);
    else if(R > box.scrollLeft + box.clientWidth - 8) box.scrollLeft = R - box.clientWidth + 8;
  }
  updateGasShadows();

  $("ctGasOther").style.display = (ctGasSel === "other") ? "block" : "none";
  renderGasSelected();
  renderAdj();
}

// バーの左右に、続きがあることを示す薄い影を出す
function updateGasShadows(){
  const box = $("ctGasChips"), wrap = $("ctGasWrap");
  if(!box || !wrap) return;
  wrap.classList.toggle("has-left", box.scrollLeft > 2);
  wrap.classList.toggle("has-right", box.scrollLeft + box.clientWidth < box.scrollWidth - 2);
}

// 選んだガス種を、ボタン群の右端に縦書きの文字で表示する（背景色はボタンと同じ。誤入力を防ぐ）
function renderGasSelected(){
  const el = $("ctGasVert");
  const g = curGas();
  let text, st = null;
  if(g){
    text = nfkc(g.name);               // ｱｾﾁﾚﾝ → アセチレン（縦書きで正しく読めるよう全角に）
    st = g;
  }else if(ctGasSel === "other"){
    const t = $("ctGasOther").value.trim();
    text = t ? nfkc(t) : "その他";
    st = OTHER_GAS_STYLE;
  }else{
    text = "未選択";
  }
  el.querySelector("span").textContent = text;
  el.style.background = st ? st.bg : "";
  el.style.color = st ? st.fg : "";
  el.style.textShadow = (st && st.shadow) ? "0 0 3px rgba(0,0,0,0.6)" : "";
  el.style.fontSize = text.length > 6 ? "12px" : "";
}

// ガス種を選ぶと、決めておいた容量と単位が自動で入る
function pickGas(sel){
  ctGasSel = sel;
  if(sel === "other"){
    $("ctCapacity").value = "";
    ctUnit = OTHER_GAS_UNIT;
    renderModeAndUnit();
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

// ｱｾﾁﾚﾝ：基準の容量に -0.2/-0.1/0.0/+0.1/+0.2 を足し引きする5つのボタン（0.0 を押すと基準に戻る）
function round1(x){ return Math.round(x * 10) / 10; }

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
    const target = round1(g.cap + k);
    const isOn = $("ctCapacity").value !== "" && Math.abs(cur - target) < 1e-9;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (isOn ? " on" : "");
    b.textContent = k === 0 ? "0.0" : (k > 0 ? "+" + k : "−" + Math.abs(k));
    b.addEventListener("click", () => {
      $("ctCapacity").value = String(target);
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

  // 検索は客名だけ（記号・番号では検索しない）
  const q = nfkc($("ctSearch").value).toUpperCase().replace(/\s+/g, "");
  if(q && !nfkc(l.customer).toUpperCase().replace(/\s+/g, "").includes(q)) return false;
  return true;
}

// 検索欄の候補：いま登録されている客名の一覧（コンボボックス）
let custListSig = "";
function renderCustList(){
  const names = [...new Set(ctLogs.map(l => l.customer).filter(Boolean))].sort((x, y) => x.localeCompare(y, "ja"));
  const sig = names.join("\n");
  if(sig === custListSig) return;
  custListSig = sig;
  const dl = $("ctCustList");
  dl.innerHTML = "";
  names.forEach(n => {
    const o = document.createElement("option");
    o.value = n;
    dl.appendChild(o);
  });
}

// 日付検索欄が空のとき、枠の中に「日付検索」と表示する
function updateDatePh(){
  const v = $("ctFilterDate").value;
  $("ctDatePh").style.display = v ? "none" : "block";
  $("ctFilterDate").classList.toggle("empty", !v);
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
// フォームの状態（通常／編集中／追加中）に合わせて、見出しとボタンを切り替える
function updateFormMode(){
  const editing = !!ctEditId;
  const adding = !editing && ctAdding;
  $("ctSaveButton").textContent = editing ? "更新" : "記録する";
  const cancel = $("ctCancelEdit");
  cancel.style.display = (editing || adding) ? "block" : "none";
  cancel.textContent = editing ? "更新をやめる" : "追加をやめる";
  $("ctTitle").textContent = editing ? "容器ログ（変更中）" : (adding ? "容器ログ（追加中）" : "容器ログ");
  $("ctTimeField").style.display = editing ? "block" : "none";
}
function setFormEditing(){ updateFormMode(); }

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
  const targetId = ctEditId;                      // 変更中ならその記録を更新、そうでなければ新しい記録

  if(!f.date){ showToast("日付を入力してください"); return; }
  if(!f.customer){ showToast("顧客名を入力してください"); $("ctCustomer").focus(); return; }
  if(!/^[A-Z0-9]+$/.test(f.symbol)){ showToast("記号は半角の英数字で入力してください"); $("ctSymbol").focus(); return; }
  if(!/^[0-9]+$/.test(f.number)){
    // 番号は数字のみ。英字が入っているときは、本当に英字かを確認してから入力できる
    const letters = f.number.match(/[A-Z]/g);
    if(letters && /^[A-Z0-9]+$/.test(f.number)){
      const list = [...new Set(letters)].join("");
      if(!window.confirm(`番号に英字入力しますか？\n（入力された英字：${list}）`)){
        $("ctNumber").focus();
        return;
      }
    }else{
      showToast("番号は半角の数字で入力してください（英字は確認のうえ入力できます）");
      $("ctNumber").focus();
      return;
    }
  }
  if(ctGasSel === null){ showToast("ガス種を選んでください"); return; }
  if(!f.gas){ showToast("ガス種を入力してください"); $("ctGasOther").focus(); return; }
  if(f.capacity !== "" && (!/^\d+(\.\d+)?$/.test(f.capacity) || f.capacity.replace(".", "").length > 5)){ showToast("容量は5桁までの数字で入力してください"); $("ctCapacity").focus(); return; }

  const dup = ctLogs.find(l => l.id !== targetId && l.date === f.date && l.status === f.status &&
                               l.symbol === f.symbol && l.number === f.number);
  if(dup && !window.confirm(`${f.symbol}-${f.number} は同じ日に「${statusName(f.status)}」で記録済みです。\nもう一度記録しますか？`)) return;

  let code = "";
  if(ctPicked && ctPicked.name === f.customer) code = ctPicked.code || "";
  else if(typeof resolveCustomerCode === "function") code = resolveCustomerCode(f.customer) || "";

  const wasEditing = !!targetId;
  if(targetId){
    const log = ctLogs.find(x => x.id === targetId);
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

  // 記号・番号は、記録のたびに空白（初期状態）へ戻す。区分・顧客・ガス種・容量は残す
  $("ctSymbol").value = "";
  $("ctNumber").value = "";
  if(wasEditing){                    // 過去の記録を直したあとは、日付を今日に戻し、顧客も空にする
    ctAdding = false;
    resetDateToToday();
    clearRecordFields();
  }
  updateFormMode();
  renderList();
  $("ctSymbol").focus();
}

function startEdit(id){
  const l = ctLogs.find(x => x.id === id);
  if(!l) return;
  ctEditId = id;
  ctAdding = false;
  ctStatus = Number(l.status);
  ctUnit = l.unit || UNITS[0];
  ctDateTouched = true;
  setDate(l.date);
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
  updateFormMode();
  window.scrollTo({ top:0, behavior:"auto" });
}

// 顧客カードの「＋追加」：その顧客・日付で、新しい容器を続けて追加する
function startAddTo(name, date){
  ctEditId = null;
  ctAdding = true;
  ctDateTouched = true;
  setDate(date);
  $("ctCustomer").value = name;
  const hit = ctLogs.find(l => l.customer === name && l.date === date && l.customerCode);
  ctPicked = hit ? { code:hit.customerCode, name } : null;
  $("ctSymbol").value = "";
  $("ctNumber").value = "";
  $("ctTime").value = "";
  showCustomerList(null);
  updateFormMode();
  window.scrollTo({ top:0, behavior:"auto" });
  $("ctSymbol").focus();
  showToast(`「${name}」に追加します`);
}

const WEEK = ["日","月","火","水","木","金","土"];
function fmtDateWeek(iso){
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(iso || "");
  if(!m) return "";
  const y = +m[1], mo = +m[2], d = +m[3];
  return `${y}/${mo}/${d}　(${WEEK[new Date(y, mo - 1, d).getDay()]})`;
}
function syncDateText(){ $("ctDateText").textContent = $("ctDate").value ? fmtDateWeek($("ctDate").value) : "----/--/--"; }
function setDate(v){ $("ctDate").value = v; syncDateText(); }

function resetDateToToday(){
  ctDateTouched = false;
  setDate(getToday());
}

// 過去の記録を直し終えたら、その記録の顧客・記号が次の入力に残らないように空へ戻す
function clearRecordFields(){
  $("ctCustomer").value = "";
  ctPicked = null;
  $("ctSymbol").value = "";
  $("ctNumber").value = "";
  showCustomerList(null);
}

function cancelEdit(){
  if(ctEditId || ctAdding){ resetDateToToday(); clearRecordFields(); }
  ctEditId = null;
  ctAdding = false;
  $("ctSymbol").value = "";
  $("ctNumber").value = "";
  $("ctTime").value = "";
  updateFormMode();
}

/* =========================================================
   一覧
========================================================= */
function renderList(){
  const list = $("ctList");
  list.innerHTML = "";
  renderCustList();
  updateDatePh();

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

  // 日付ごと → 顧客名ごと にまとめる
  const days = [], dayMap = {};
  shown.forEach(l => {
    let day = dayMap[l.date];
    if(!day){ day = { date:l.date, custs:[], cmap:{} }; dayMap[l.date] = day; days.push(day); }
    const key = l.customer || "";
    let c = day.cmap[key];
    if(!c){ c = { name:key, rows:[] }; day.cmap[key] = c; day.custs.push(c); }
    c.rows.push(l);
  });

  days.forEach(day => {
    const head = document.createElement("div");
    head.className = "day-header";
    head.innerHTML = `<span>${escapeHtml(formatDayLabel(day.date, todayStr))}</span>` +
                     `<span>出庫${outByDate[day.date] || 0}・空受${inByDate[day.date] || 0}・他${othByDate[day.date] || 0}</span>`;
    list.appendChild(head);

    day.custs.forEach(c => {
      // 新しい順（上が新しい）
      const rows = [...c.rows].sort((a,b) =>
        (b.time || "").localeCompare(a.time || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));

      const card = document.createElement("div");
      card.className = "ct-cust";
      const ckey = `${day.date}|${c.name}`;
      const open = ctOpen.has(ckey);

      // 区分ごと → ガス種ごと の本数と合計数量（数量は数字のみ・単位なし）
      const noCap = l => (l.capacity === "" || l.capacity == null);
      const gasOrd = l => { const i = GAS_TABLE.findIndex(g => g.code === l.gasCode); return i >= 0 ? i : 100; };
      const byStatus = {};
      rows.forEach(l => {                              // 容量のある行を先に集計
        if(noCap(l)) return;
        const list = byStatus[l.status] || (byStatus[l.status] = []);
        const gname = l.gas || "（ガス種なし）";
        let g = list.find(x => x.name === gname && x.unit === (l.unit || ""));
        if(!g){ g = { name:gname, unit:l.unit || "", ord:gasOrd(l), n:0, sum:0, hasQty:true }; list.push(g); }
        g.n++;
        g.sum += Number(l.capacity) || 0;
      });
      rows.forEach(l => {                              // 容量が空欄の行は、本数だけ数える
        if(!noCap(l)) return;
        const list = byStatus[l.status] || (byStatus[l.status] = []);
        const gname = l.gas || "（ガス種なし）";
        let g = list.find(x => x.name === gname);
        if(!g){ g = { name:gname, unit:"", ord:gasOrd(l), n:0, sum:0, hasQty:false }; list.push(g); }
        g.n++;
      });
      const order = sc => sc === 2 ? 0 : (sc === 3 ? 1 : 2 + sc);

      let html = `<div class="ct-cust-head"><span class="ct-cust-name">${escapeHtml(c.name || "（顧客名なし）")}</span>` +
                 `<span class="ct-cust-sum">合計 ${rows.length}本</span></div>`;
      Object.keys(byStatus).map(Number).sort((x, y) => order(x) - order(y)).forEach(sc => {
        const cls = sc === 2 ? "out" : (sc === 3 ? "in" : "oth");
        const parts = byStatus[sc]
          .sort((p, q) => p.ord - q.ord || p.name.localeCompare(q.name, "ja") || p.unit.localeCompare(q.unit))
          .map(g => `<span class="ct-sum-gas">${escapeHtml(g.name)} ${g.n}本${g.hasQty ? "(" + round1(g.sum) + ")" : ""}</span>`).join("");
        html += `<div class="ct-sum-line"><span class="ct-badge ${cls}">${escapeHtml(statusName(sc))}</span>${parts}</div>`;
      });

      // 「明細」を押したときだけ、1本ずつ表示する（行を右へスワイプ＝変更、左へスワイプ＝削除）
      // 並び順：区分 → ガス種 → 記号・番号。区分は、同じ区分のグループの先頭の行にだけ出す。時刻は出さない
      if(open){
        const numCmp = (p, q) => (/^\d+$/.test(p) && /^\d+$/.test(q))
          ? (Number(p) - Number(q)) || p.localeCompare(q)
          : String(p).localeCompare(String(q));
        const detail = [...rows].sort((p, q) =>
          order(p.status) - order(q.status) || gasOrd(p) - gasOrd(q) ||
          String(p.gas || "").localeCompare(String(q.gas || ""), "ja") ||
          String(p.symbol).localeCompare(String(q.symbol)) || numCmp(p.number, q.number));

        // 列の幅をそろえる（区分・記号番号・容量は固定幅、ガス種は残り）
        const emW = t => [...String(t)].reduce((w, ch) => {
          const cc = ch.codePointAt(0);
          return w + (cc >= 0xFF61 && cc <= 0xFF9F ? 0.55 : (cc <= 0x7F ? 0.62 : 1.05));
        }, 0);
        const capStr = l => noCap(l) ? "" : `${l.capacity}${l.unit || ""}`;
        const c1 = Math.ceil(Math.max(...detail.map(l => emW(statusName(l.status)))) * 12 + 24);
        const c2 = Math.max(...detail.map(l => String(l.symbol).length + 1 + String(l.number).length));
        const c4 = Math.ceil(Math.max(...detail.map(l => emW(capStr(l)))) * 13 + 4);
        const cols = `${c1}px ${c2}ch minmax(0,1fr) ${c4}px`;

        html += `<div class="ct-swipe-hint">← 削除　　変更 →</div>`;
        let prevStatus = null;
        detail.forEach(l => {
          const cls = l.status === 2 ? "out" : (l.status === 3 ? "in" : "oth");
          const first = l.status !== prevStatus;
          prevStatus = l.status;
          html += `
            <div class="ct-swrap" data-id="${escapeHtml(l.id)}">
              <div class="ct-swbg"><span class="ct-sw-edit">変更</span><span class="ct-sw-del">削除</span></div>
              <div class="ct-row ct-drow" style="grid-template-columns:${cols}">
                <span class="ct-d1">${first ? `<span class="ct-badge ${cls}">${escapeHtml(statusName(l.status))}</span>` : ""}</span>
                <span class="ct-d2">${escapeHtml(l.symbol)}-${escapeHtml(l.number)}</span>
                <span class="ct-d3">${escapeHtml(l.gas || "")}</span>
                <span class="ct-d4">${escapeHtml(capStr(l))}</span>
              </div>
            </div>`;
        });
      }
      html += `<div class="ct-actions">` +
              `<button class="ct-add" data-name="${encodeURIComponent(c.name || "")}" data-date="${escapeHtml(day.date || "")}">＋追加</button>` +
              `<button class="ct-tog${open ? " open" : ""}" data-key="${encodeURIComponent(ckey)}">${open ? "閉じる" : "明細"}</button>` +
              `</div>`;
      card.innerHTML = html;
      list.appendChild(card);
    });
  });
}

$("ctList").addEventListener("click", e => {
  const tog = e.target.closest(".ct-tog");
  if(tog){
    const k = decodeURIComponent(tog.getAttribute("data-key"));
    if(ctOpen.has(k)) ctOpen.delete(k); else ctOpen.add(k);
    renderList();
    return;
  }
  const add = e.target.closest(".ct-add");
  if(add){ startAddTo(decodeURIComponent(add.getAttribute("data-name")), add.getAttribute("data-date")); return; }
});

function deleteLog(id){
  const l = ctLogs.find(x => x.id === id);
  if(!l) return;
  if(!window.confirm(`${l.symbol}-${l.number}（${statusName(l.status)}）を削除しますか？`)) return;
  ctLogs = ctLogs.filter(x => x.id !== id);
  if(ctEditId === id) cancelEdit();
  ctSave();
  renderList();
  showToast("削除しました");
}

/* 行のスワイプ：右へ＝変更（上のフォームで変更状態に）、左へ＝削除（確認あり）。縦スクロールは邪魔しない */
(function setupSwipe(){
  const list = $("ctList");
  let sw = null;

  list.addEventListener("pointerdown", e => {
    const row = e.target.closest(".ct-swrap > .ct-row");
    if(!row) return;
    if(e.pointerType === "mouse" && e.button !== 0) return;
    sw = { row, id: row.parentNode.getAttribute("data-id"), x:e.clientX, y:e.clientY, dx:0, active:false, pid:e.pointerId };
  });

  list.addEventListener("pointermove", e => {
    if(!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if(!sw.active){
      if(Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5){
        sw.active = true;
        try{ sw.row.setPointerCapture(sw.pid); }catch(err){ /* 未対応の環境では無視 */ }
        sw.row.style.transition = "none";
      }else if(Math.abs(dy) > 10){
        sw = null;                       // 縦に動かしているので、スクロールに任せる
        return;
      }else{
        return;
      }
    }
    sw.dx = dx;
    sw.row.style.transform = `translateX(${dx}px)`;
  });

  function finish(cancelled){
    if(!sw) return;
    const { row, id, dx, active } = sw;
    sw = null;
    if(!active) return;
    row.style.transition = "transform .18s";
    row.style.transform = "";
    if(cancelled) return;
    const threshold = Math.min(90, (row.offsetWidth || 300) * 0.28);
    if(dx >= threshold) setTimeout(() => startEdit(id), 30);
    else if(dx <= -threshold) setTimeout(() => deleteLog(id), 30);
  }
  list.addEventListener("pointerup", () => finish(false));
  list.addEventListener("pointercancel", () => finish(true));
})();

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
const dateEl = $("dateDisplay");
function fmtToday(){
  const d = new Date();
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}　(${WEEK[d.getDay()]})`;
}
if(dateEl){
  dateEl.textContent = fmtToday();
  window.updateDate = function(){ dateEl.textContent = fmtToday(); };
}
if(dateEl && dateEl.parentNode){
  const box = document.createElement("div");
  box.className = "ct-datebox";
  dateEl.parentNode.insertBefore(box, dateEl);
  box.appendChild(dateEl);
  const sub = document.createElement("div");
  sub.className = "ct-bcpsub";
  sub.textContent = "BCP用オフライン使用可";
  box.appendChild(sub);
}

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
  if(!ctDateTouched && !ctEditId) setDate(getToday());
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

/* 入力欄の上のラベルをなくし、欄の中に表示する
   ・文字入力の欄：薄い文字（入力を始めると消える）
   ・日付・時刻・走行距離・敬称（最初から値が入る欄）：欄の左端に、消えない小さな文字 */
const INLINE_IDS = new Set(["vehicleDistance", "meetingPersonTitle"]);

function makeInline(inp, lb, text){
  const wrap = document.createElement("div");
  wrap.className = "ct-inwrap";
  inp.parentNode.insertBefore(wrap, inp);
  wrap.appendChild(inp);
  lb.className = "ct-inlab";
  lb.removeAttribute("style");
  wrap.insertBefore(lb, inp);
  inp.style.paddingLeft = (text.length * 11 + 24) + "px";
  inp.style.textAlign = "left";
}

function convertHostLabels(){
  document.querySelectorAll("label[for]").forEach(lb => {
    if(lb.closest("#containerScreen")) return;
    const inp = document.getElementById(lb.getAttribute("for"));
    if(!inp) return;
    const text = lb.textContent.trim();
    const type = (inp.type || "").toLowerCase();
    if(INLINE_IDS.has(inp.id) || type === "date" || type === "time"){
      makeInline(inp, lb, text);
    }else if(inp.tagName === "TEXTAREA" || (inp.tagName === "INPUT" && ["text","number","password","search","tel",""].includes(type))){
      inp.placeholder = text;
      inp.setAttribute("aria-label", text);
      lb.style.display = "none";
    }
  });
}
convertHostLabels();

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

$("ctDate").addEventListener("change", () => { ctDateTouched = true; syncDateText(); });
$("ctDate").addEventListener("input", syncDateText);
$("ctGasChips").addEventListener("scroll", updateGasShadows, { passive:true });
window.addEventListener("resize", updateGasShadows);
syncDateText();

/* 検索・日付での絞り込み（過去の記録を後から探す） */
$("ctSearch").addEventListener("input", renderList);
$("ctFilterDate").addEventListener("change", renderList);
$("ctFilterClear").addEventListener("click", () => {
  $("ctSearch").value = "";
  $("ctFilterDate").value = "";
  renderList();
});
$("ctCapacity").addEventListener("input", renderAdj);
$("ctGasOther").addEventListener("input", renderGasSelected);
$("ctSaveButton").addEventListener("click", () => saveFromForm());

/* 記号・番号・容量は、入力しながら（確定時にも）半角に直す：全角→半角、小文字→大文字 */
function liveNormalize(el, fn){
  const apply = () => { const v = el.value; const n = fn(v); if(n !== v) el.value = n; };
  el.addEventListener("input", e => { if(!e.isComposing) apply(); });
  el.addEventListener("compositionend", apply);
  el.addEventListener("blur", apply);
}
liveNormalize($("ctSymbol"), normSym);
liveNormalize($("ctNumber"), normNum);
liveNormalize($("ctCapacity"), normNum);

// 番号は数字キーパッドが初期。英字を入れたいときだけ「ABC」で通常のキーボードに切り替える
$("ctNumKb").addEventListener("click", () => {
  const inp = $("ctNumber");
  const toText = inp.getAttribute("inputmode") === "numeric";
  inp.setAttribute("inputmode", toText ? "text" : "numeric");
  $("ctNumKb").textContent = toText ? "123" : "ABC";
  inp.blur();
  setTimeout(() => inp.focus(), 50);
});
$("ctCancelEdit").addEventListener("click", cancelEdit);

})();
