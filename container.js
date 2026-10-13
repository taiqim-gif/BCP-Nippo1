/* =========================================================
   営業日報アプリ 追加モジュール(container.js)
   ① 「容器」タブ(出庫・回収ログ専用ページ)
   ② オフライン起動(Service Worker)の登録と状態表示
   ③ バックアップの書き出し／読み込み(日報・車両・TODO・容器ログ)
   ※ index.html の </body> の直前で読み込みます。
========================================================= */
(function(){
"use strict";

/* ---------- 設定(ボタンの内容を変えたいときはここだけ書き換えます) ---------- */
/* 区分(画面には文字だけ表示。保存・送信するのは数値コード。1つの記録に区分は1つだけ) */
const STATUS_TABLE = [
  [1,"仕入"],[2,"出庫"],[3,"空受"],[4,"返却"],[5,"検査"],[6,"充填"],[7,"営業充出"],[8,"仮出庫"],[9,"営業充入"],
  [10,"空瓶在庫"],[11,"返品"],[12,"充瓶在庫"],[13,"ラベル再発行"],
  [64,"車載充出"],[65,"車載空出"],[67,"車載充戻"],[68,"車載空戻"],[90,"検査済出し"],[99,"棚卸"]
];
const STATUS_BUTTONS = [2, 3];   // 画面に並べるボタン(出庫・空受)。それ以外は右端の選択欄から選ぶ

/* ガス種(保存・送信するのは数値コードと名前。ボタンには label を表示する)
   label＝ボタンに表示する略称、cap＝選んだときに自動で入る容量(空文字なら空欄)、unit＝単位、adj＝容量の増減ボタンを出す */
const AZURE_GRAY = "#6F8CA3";
const AZURE_GRAY_LIGHT = "#A8BDCB";     // 薄いアズールグレー(Ar と ArCo)
const VIVID_GREEN = "#17B26A";          // 明瞭な緑(ArCo の縞)
const GAS_TABLE = [
  { code:1001, label:"Ace",      name:"ｱｾﾁﾚﾝ",       cap:7,  unit:"kg", adj:true, bg:"#C2694B", fg:"#fff" },   // 明るめの赤褐色
  { code:1002, label:"O2",       name:"酸素",         cap:7,  unit:"㎥", bg:"#222222", fg:"#fff" },              // 黒
  { code:1003, label:"N2",       name:"窒素",         cap:7,  unit:"㎥", bg:AZURE_GRAY, fg:"#fff" },            // アズールグレー
  { code:1004, label:"Ar",       name:"アルゴン",     cap:7,  unit:"㎥", bg:AZURE_GRAY_LIGHT, fg:"#1f2933" },   // 薄いアズールグレー
  { code:1006, label:"CO2",      name:"炭酸",         cap:30, unit:"kg", bg:"#3F9A5E", fg:"#fff" },              // 緑
  { code:1007, label:"ArCo",     name:"アルコミック", cap:7,  unit:"㎥", fg:"#1f2933",
    // ボタン：横縞(薄いアズールグレー・緑・薄いアズールグレー)。緑は太め(高さの40%)
    bg:"linear-gradient(to bottom, " + AZURE_GRAY_LIGHT + " 0 30%, " + VIVID_GREEN + " 30% 70%, " + AZURE_GRAY_LIGHT + " 70% 100%)",
    // 右側の「選んだガス種」の表示：全体は薄いアズールグレー。縦書きの文字「ルコ」(2〜3文字目)の背景だけ緑
    vertBg:AZURE_GRAY_LIGHT, vertHL:{ from:1, to:3, bg:VIVID_GREEN } },
  { code:1008, label:"フロン",   name:"フロン",       cap:"", unit:"kg", bg:"#A3A9AF", fg:"#1f1f1f" },           // グレー
  { code:2001, label:"LP",       name:"プロパン",     cap:"", unit:"kg", bg:"#A3A9AF", fg:"#1f1f1f" },
  { code:5001, label:"医O2",    name:"医療用酸素",   cap:"", unit:"㎥", bg:"#222222", fg:"#fff" }               // 黒
];
// ボタンの並び順(2行に左から右へ並べる)。上段：Ace O2 N2 フロン LP ／ 下段：CO2 Ar ArCo 医O2 その他
const GAS_CHIP_ORDER = [1001, 1002, 1003, 1008, 2001, 1006, 1004, 1007, 5001];
const OTHER_GAS_STYLE = { bg:"#2D87E3", fg:"#fff" };                  // 「その他」ボタン：アズールブルー
const OTHER_GAS_UNIT = "㎥";                                           // 「その他」を選んだときの初期の単位
const ADJ_STEPS = [-0.2, -0.1, 0, 0.1, 0.2];   // ｱｾﾁﾚﾝの容量の増減ボタン(0.0＝基準に戻す)
const UNITS = ["㎥","kg"];

const CT_KEY = "containerLogs";
const BACKUP_KEYS = ["meetingLogs","dailyVehicleInfo","todoItems","containerLogs","customerHidden","customerExtra","dailyWeather"];
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

/* 旧版(区分＝出庫/回収の文字、ガス種＝文字だけ)のデータを、コード形式に自動変換する */
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
const FS = {   // 顧客カードの文字サイズ(小・標準・大)。単位は画面上の文字の大きさ
  s:{ name:18, sum:12, line:14, badge:12, btn:12, row:15, hint:11, swipe:13 },
  m:{ name:20, sum:14, line:16, badge:14, btn:14, row:17, hint:13, swipe:15 },
  l:{ name:24, sum:17, line:19, badge:17, btn:16, row:20, hint:15, swipe:18 }
};
let ctFs = "m";
try{ const v = localStorage.getItem("ctFontSize"); if(FS[v]) ctFs = v; }catch(e){ /* 保存できない環境では標準 */ }
const ctOpen = new Set();   // 「編集」で開いている顧客カード(日付|顧客名)
let ctDateTouched = false;  // 日付を手で変えたか(変えていなければ開くたびに今日にする)

const $ = id => document.getElementById(id);

// 文字の幅の見積もり(em)：全角は1、半角カナは約0.55、半角は約0.62
function emW(t){
  return [...String(t)].reduce((w, ch) => {
    const cc = ch.codePointAt(0);
    return w + (cc >= 0xFF61 && cc <= 0xFF9F ? 0.55 : (cc <= 0x7F ? 0.62 : 1.05));
  }, 0);
}
// 一覧と明細での表示だけ短くする(データはそのまま：1001 ｱｾﾁﾚﾝ)
function shortGas(name){ return nfkc(name) === "アセチレン" ? "アセチ" : name; }

function nowHM(){
  const d = new Date();
  return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}
function newId(){ return Date.now() + "-" + Math.random().toString(36).slice(2,8); }

/* 入力の正規化(全角で入っても半角に直す) */
function normSym(s){ return String(s || "").normalize("NFKC").toUpperCase().replace(/\s+/g,""); }
function normNum(s){ return String(s || "").normalize("NFKC").toUpperCase().replace(/\s+/g,""); }

function ctSorted(logs){
  return [...logs].sort((a,b) =>
    (a.date || "").localeCompare(b.date || "") ||
    (a.time || "").localeCompare(b.time || "") ||
    (a.createdAt || "").localeCompare(b.createdAt || ""));
}

/* =========================================================
   見た目(既存アプリのパステル配色に合わせる)
========================================================= */
const style = document.createElement("style");
style.textContent = `
  header{ flex-wrap:wrap; gap:6px; padding:8px 12px; }
  header .nav-btn{ flex:1 1 0; min-width:0; padding:9px 4px; font-size:14px; text-align:center; white-space:nowrap; }
  .nav-btn.active-lav{ background:var(--lavender); color:var(--lavender-ink); border-color:var(--lavender-dark); }
  .ct-datebox{ display:flex; flex:0 0 100%; flex-direction:row; align-items:center; gap:8px; min-width:0; }
  .ct-dleft{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:2px; }
  .ct-dline1{ display:flex; align-items:baseline; min-width:0; }
  .ct-bcpsub{ flex:none; text-align:right; }
  .ct-wx{ display:block; width:100%; overflow:hidden; border:none; background:transparent; font-family:inherit; font-size:12.5px; font-weight:700; color:#0B7A7A; padding:0; text-align:left; cursor:pointer; }   /* アズールグリーン(濃いめ) */
  .ct-wx[hidden]{ display:none; }
  .ct-wxtrack{ display:inline-block; white-space:nowrap; animation:ctWxScroll var(--wx-dur, 20s) linear infinite; }
  .ct-wx.paused .ct-wxtrack{ animation-play-state:paused; }
  .ct-wx.static .ct-wxtrack{ animation:none; }
  @keyframes ctWxScroll{ from{ transform:translateX(0); } to{ transform:translateX(-50%); } }
  @media (prefers-reduced-motion: reduce){ .ct-wxtrack{ animation:none; } }
  .ct-wxsheet{ position:fixed; left:0; right:0; bottom:0; z-index:120; background:#fff; border-top:2px solid var(--line); border-radius:16px 16px 0 0; padding:14px 16px 20px; box-shadow:0 -6px 20px rgba(0,0,0,0.15); max-height:70vh; overflow-y:auto; }
  .ct-wxsheet[hidden]{ display:none; }
  .ct-wxsheet h3{ margin:0 0 8px; font-size:16px; }
  .ct-wxsheet .wx-row{ display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px solid var(--line); font-size:14px; }
  .ct-wxsheet .wx-row span:first-child{ color:var(--ink-soft); flex:none; }
  .ct-wxsheet .wx-note{ font-size:11.5px; color:var(--ink-soft); margin-top:8px; }
  .ct-wxsheet .wx-btns{ display:flex; gap:10px; margin-top:12px; }
  .ct-datebox #dateDisplay{ display:block; white-space:nowrap; line-height:1.25; }
  .ct-bcpsub{ font-size:10px; font-weight:400; color:var(--ink-soft); white-space:nowrap; line-height:1.25; }
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

  .ct-badge{ display:inline-block; font-size:var(--fs-badge,14px); font-weight:700; padding:2px 10px; border-radius:999px; margin-right:8px; }
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
    flex:none; width:34px; min-height:88px; border-radius:10px; overflow:hidden;
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
    padding:4px 11px; font-size:var(--fs-btn,14px); font-weight:700; font-family:inherit; cursor:pointer;
  }
  .ct-chip-row .chip.gas{ border:none; font-weight:700; padding:10px 14px; }
  .ct-chip-row .chip.gas.on{ box-shadow:0 0 0 2px #fff, 0 0 0 4px var(--ink); }

  .ct-cust{ background:var(--card); border:1px solid var(--line); border-left:5px solid var(--mint); border-radius:var(--radius); padding:12px 14px 4px; margin-bottom:10px; }
  .ct-cust-head{ display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:4px; }
  .ct-cust-name{ font-size:var(--fs-name,20px); font-weight:700; min-width:0; overflow-wrap:anywhere; }
  .ct-cust-sum{ font-size:var(--fs-sum,14px); color:var(--ink-soft); white-space:nowrap; }
  .ct-row{ display:flex; align-items:center; gap:8px; padding:9px 0; border-top:1px solid var(--line); }
  .ct-row-main{ flex:1; min-width:0; }
  .ct-row-line1{ font-size:14px; font-weight:700; }
  .ct-row-line2{ font-size:12.5px; color:var(--ink-soft); margin-top:2px; }
  .ct-row .card-action{ flex:0 0 auto; padding:7px 11px; font-size:12px; }

  .ct-datewrap{ position:relative; }
  .ct-dph{ position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:15px; color:var(--ink-soft); pointer-events:none; }
  #containerScreen input[type=date].empty{ color:transparent; }

  .ct-sum-line{ display:grid; grid-template-columns:var(--sumw, auto) minmax(0,1fr); column-gap:10px; align-items:start; font-size:var(--fs-line,16px); padding:3px 0; }
  .ct-sum-gases{ display:flex; flex-wrap:wrap; gap:2px 12px; min-width:0; }
  .ct-sum-line .ct-badge{ margin-right:0; }
  .ct-sum-gas{ white-space:nowrap; }
  .ct-actions{ display:flex; justify-content:flex-end; gap:8px; padding:8px 0 10px; margin-top:6px; border-top:1px solid var(--line); }
  .ct-tog{
    border:1.5px solid var(--lavender-dark); background:#fff; color:var(--lavender-ink); border-radius:999px;
    padding:4px 14px; font-size:var(--fs-btn,14px); font-weight:700; font-family:inherit; cursor:pointer;
  }
  .ct-tog.open{ background:var(--lavender); }

  .ct-inwrap{ position:relative; }
  .ct-person-field{ flex:1 1 0 !important; min-width:0; }
  .ct-title-field{ flex:0 0 138px !important; min-width:0; }
  #doneTodoBox{ margin-top:30px; }
  #doneTodoBox h2{ color:var(--ink-soft); }
  .done-item{ background:#F2EEE4 !important; border-left-color:#CFC8BB !important; color:var(--ink-soft); }
  .done-item .line-done{ text-decoration:line-through; text-decoration-color:rgba(214,69,69,0.55); text-decoration-thickness:1.5px; color:var(--ink-soft); }
  .done-item .done-suffix{ color:rgba(214,69,69,0.7); margin-left:4px; }
  .done-item input[type=checkbox]{ width:20px; height:20px; }
  #doneTodoBox .btn{ margin-top:6px; }
  .ct-timebox{ position:relative; display:inline-flex; align-items:center; gap:8px; width:7.6em; min-width:0; padding:8px 10px; border:1.5px solid var(--line); border-radius:10px; background:#FFFDF9; box-sizing:border-box; vertical-align:middle; }
  .ct-timebox .ct-inlab{ font-size:11px; color:var(--ink-soft); flex:none; }
  .ct-timetext{ font-size:15px; white-space:nowrap; }
  .ct-timebox > input[type=time]{ position:absolute !important; inset:0; width:100% !important; height:100% !important; max-width:none !important; opacity:0; border:0 !important; padding:0 !important; margin:0; font-size:16px; }
  .ct-inwrap > label.ct-inlab{ position:absolute; left:12px; top:50%; transform:translateY(-50%); margin:0; font-size:11px; color:var(--ink-soft); white-space:nowrap; pointer-events:none; z-index:1; }
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
  .ct-swbg{ position:absolute; inset:0; display:flex; font-size:var(--fs-swipe,15px); font-weight:700; }
  .ct-sw-edit, .ct-sw-del{ flex:1; display:flex; align-items:center; padding:0 18px; }
  .ct-sw-edit{ background:var(--sky); color:var(--sky-ink); justify-content:flex-start; }
  .ct-sw-del{ background:var(--pink); color:var(--pink-ink); justify-content:flex-end; }
  .ct-swipe-hint{ font-size:var(--fs-hint,13px); color:var(--ink-soft); text-align:center; padding:4px 0 6px; }
  .ct-sw-edit{ background:var(--mint); color:var(--mint-ink); }

  .ct-swrap > .ct-row.ct-drow{ display:grid; column-gap:10px; align-items:center; font-size:var(--fs-row,17px); padding:9px 0; }
  .ct-d1 .ct-badge{ margin-right:0; }
  .ct-d2{ font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight:700; white-space:nowrap; }
  .ct-d3{ min-width:0; overflow-wrap:anywhere; }
  .ct-d4{ text-align:right; white-space:nowrap; }

  .ct-fs{ display:inline-flex; gap:4px; background:#F2EEE4; border-radius:999px; padding:3px; }
  .ct-fs button{ border:none; background:transparent; padding:4px 11px; border-radius:999px; font-family:inherit; font-size:12px; font-weight:700; color:var(--ink-soft); cursor:pointer; }
  .ct-fs button.on{ background:#fff; color:var(--ink); box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  .ct-sent{ font-size:.7em; font-weight:400; color:var(--ink-soft); border:1px solid var(--line); border-radius:4px; padding:0 3px; margin-left:6px; white-space:nowrap; }

  #reportScreen .footer-actions{ display:none; }
  .dt-chips{ display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin:0 2px 14px; }
  .dt-chips-label{ font-size:14px; font-weight:700; color:var(--ink); }
  .dt-chip{ font-size:14px; font-weight:700; padding:4px 12px; border-radius:999px; }
  .dt-chip.v, .dt-chip.d, .dt-chip.c{ background:var(--butter); color:var(--butter-ink); }
  .dt-frame{ border:2px solid var(--line); border-radius:16px; margin-bottom:16px; overflow:hidden; }
  .dt-head{ display:block; width:100%; text-align:left; border:none; padding:10px 14px; font-family:inherit; font-size:17px; font-weight:700; }
  .dt-toggle{ display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
  .dt-body{ padding:12px 12px 2px; }
  .dt-body[hidden]{ display:none; }
  .dt-item{ background:#fff; border:1px solid rgba(0,0,0,0.07); border-radius:12px; padding:10px; margin-bottom:12px; }
  .dt-item .btn{ font-size:16px; padding:13px 8px; line-height:1.35; }
  .dt-desc{ font-size:13px; color:var(--ink-soft); margin:7px 2px 0; line-height:1.5; text-align:center; }
  .dt-state{ font-size:14px; font-weight:700; color:var(--ink); margin:0 2px 12px; }
  .dt-state.warn{ color:var(--pink-ink); }
  .dt-note{ font-size:13px; font-weight:700; color:var(--pink-ink); margin:0 2px 12px; }
  .dt-frame.send{ background:#EEF9F5; border-color:var(--mint-dark); }
  .dt-frame.send .dt-head{ background:var(--mint); color:var(--mint-ink); }
  .dt-frame.save{ background:#EDF6FB; border-color:var(--sky-dark); }
  .dt-frame.save .dt-head{ background:var(--sky); color:var(--sky-ink); }
  .dt-frame.master{ background:#F3EFFC; border-color:var(--lavender-dark); }
  .dt-frame.master .dt-head{ background:var(--lavender); color:var(--lavender-ink); }
  .dt-frame.del{ background:#FFF0F4; border-color:var(--pink-dark); }
  .dt-frame.del .dt-head{ background:var(--pink); color:var(--pink-ink); }

  .ct-dhead{ padding:9px 0 3px; border-top:1px solid var(--line); }
  .ct-dhead .ct-badge{ margin-right:0; }
  .ct-dhead + .ct-swrap{ border-top:0; }

  .ct-combo{ position:relative; }
  .ct-combo > input{ width:100%; padding-right:36px; }
  .ct-combo-btn{ position:absolute; right:4px; top:50%; transform:translateY(-50%); border:none; background:transparent; color:var(--ink-soft); font-size:12px; padding:8px 9px; cursor:pointer; }
  .ct-combo-list{ position:absolute; left:0; right:0; top:calc(100% + 4px); z-index:30; max-height:240px; overflow-y:auto; -webkit-overflow-scrolling:touch; background:#fff; border:1.5px solid var(--line); border-radius:10px; box-shadow:0 4px 14px rgba(0,0,0,0.12); }
  .ct-combo-list[hidden]{ display:none; }
  .ct-combo-item{ display:block; width:100%; text-align:left; padding:11px 12px; border:none; border-bottom:1px solid var(--line); background:#fff; font-family:inherit; font-size:14px; color:var(--ink); cursor:pointer; }
  .ct-combo-item:last-child{ border-bottom:none; }
  .ct-combo-item.none{ background:#FAF6EF; color:var(--ink-soft); font-weight:700; }
  .ct-combo-item:active{ background:var(--butter); }
  .ct-filter-info{ font-size:11.5px; color:var(--ink-soft); margin:2px 2px 10px; }
  .ct-filter-info:empty{ display:none; }

  .ct-gas-area{ align-items:center; }
  .ct-gascol{ flex:1; min-width:0; }
  .ct-gashead{ display:flex; justify-content:space-between; align-items:center; height:20px; margin-bottom:4px; }
  .ct-gashead label{ margin:0; }
  .ct-gasdir{ display:flex; gap:14px; font-size:17px; font-weight:900; line-height:1; color:var(--lavender-ink); }
  .ct-gasdir span{ visibility:hidden; }
  .ct-gasdir span.on{ visibility:visible; animation:ctBlink 1s ease-in-out infinite; }
  @keyframes ctBlink{ 0%,100%{ opacity:1; } 50%{ opacity:.15; } }

  .ct-hint{ display:inline-flex; align-items:center; gap:26px; }
  .ct-hint-l, .ct-hint-r{ display:inline-flex; align-items:center; gap:6px; }
  .ct-hint .word{ font-weight:700; }
  .ct-hint-l .word{ color:var(--pink-ink); }
  .ct-hint-r .word{ color:var(--mint-ink); }
  .ct-hint .arrow{ font-size:1.5em; font-weight:900; line-height:1; -webkit-text-stroke:1px currentColor; animation:ctBlink 1s ease-in-out infinite; }
  .ct-hint-l .arrow{ color:#D6336C; }
  .ct-hint-r .arrow{ color:#128F5A; }
  @media (prefers-reduced-motion: reduce){
    .ct-gasdir span.on{ animation:none; }
    .ct-hint .arrow{ animation:none; }
  }

  /* 一画面に収める：訪問入力・車両情報・容器ログの余白を詰める */
  #visitScreen h2{ margin:8px 0 6px; font-size:14px; }
  #visitScreen .card{ padding:10px 12px; margin-bottom:8px; }
  #visitScreen .field{ margin-bottom:8px; }
  #visitScreen .field > label{ margin-bottom:4px; }
  #visitScreen input[type=text], #visitScreen input[type=time], #visitScreen textarea{ padding:8px 10px; }
  #visitScreen .chip-group{ gap:6px; }
  #visitScreen .chip{ padding:7px 2px; font-size:12.5px; }
  #visitScreen textarea{ resize:none; min-height:0; overflow-y:auto; line-height:1.45; }
  #visitScreen .ct-inwrap input[type=time]{ width:100%; min-width:0; max-width:100%; font-size:14px; padding-right:4px; text-align:left; }
  #visitScreen .btn{ padding:11px; }
  #visitStatusField > div{ display:inline-block !important; margin:0 10px 0 0 !important; vertical-align:middle; }
  #visitStatusField .ct-inwrap{ display:inline-block; width:8.5em; vertical-align:middle; }
  #visitStartTimeInput{ width:100%; padding-top:6px; padding-bottom:6px; font-size:14px; }

  #vehicleScreen h2{ margin:6px 0 6px; }
  .ct-h2-inline{ display:flex !important; justify-content:flex-start !important; align-items:center; gap:10px; }
  #vehicleScreen .card{ padding:10px; margin-bottom:8px; }
  #vehicleScreen .field{ margin-bottom:6px; }
  #vehicleScreen input[type=number], #vehicleScreen input[type=text]{ padding:8px 10px; }
  #vehicleScreen .dial{ width:72px; height:72px; }
  #vehicleScreen .dial-row{ margin-top:8px; }
  #vehicleScreen .mode-switch-btn{ padding:6px; }
  #vehicleScreen .dial-actions .btn{ padding:12px 10px; }
  #vehicleScreen .btn{ padding:10px; }
  #vehicleScreen #distanceSummaryCard{ padding:8px 12px; margin-bottom:6px; }

  #containerScreen h2{ margin:8px 0 8px; }
  #containerScreen .card{ padding:10px; margin-bottom:8px; }
  #containerScreen .field{ margin-bottom:6px; }
  #containerScreen .kana-grid{ gap:4px; margin-bottom:6px; }
  #containerScreen .kana-btn{ padding:6px 0; }
  .ct-lbrow{ display:flex; justify-content:space-between; align-items:center; height:26px; margin-bottom:4px; }
  .ct-lbrow label{ margin:0; }
  .ct-lbrow .btn-mini{ padding:2px 10px; line-height:1.2; }

  .ct-flash{ position:fixed; left:50%; top:40%; transform:translate(-50%,-50%) scale(.9); font-size:64px; font-weight:700; color:var(--mint-ink); background:rgba(255,255,255,0.95); border:3px solid var(--mint-dark); border-radius:24px; padding:14px 44px; z-index:200; opacity:0; pointer-events:none; transition:opacity .15s, transform .15s; }
  .ct-flash.show{ opacity:1; transform:translate(-50%,-50%) scale(1); }

  /* 顧客の管理 */
  .cm-top{ display:flex; align-items:center; gap:10px; margin:6px 0 10px; }
  .cm-top h2{ margin:0; }
  .cm-row{ display:flex; align-items:center; gap:10px; padding:10px 4px; border-bottom:1px solid var(--line); font-size:15px; }
  .cm-row input[type=checkbox]{ width:20px; height:20px; flex:none; }
  .cm-name{ flex:1; min-width:0; overflow-wrap:anywhere; }
  .cm-code{ font-size:12px; color:var(--ink-soft); white-space:nowrap; }
  .cm-tag{ font-size:11px; border:1px solid var(--lavender-dark); color:var(--lavender-ink); border-radius:4px; padding:0 4px; white-space:nowrap; }
  .cm-mini{ border:1.5px solid var(--line); background:#fff; border-radius:8px; padding:4px 9px; font-size:12px; font-weight:700; font-family:inherit; color:var(--ink); cursor:pointer; }
  .cm-note{ font-size:14px; font-weight:700; color:var(--lavender-ink); margin:0 2px 8px; }
  .cm-head{ display:flex; justify-content:space-between; font-size:12px; color:var(--ink-soft); padding:6px 4px 2px; border-bottom:1px solid var(--line); }
  .cm-chk{ display:flex; align-items:center; gap:4px; font-size:12px; color:var(--ink-soft); padding:6px 4px; flex:none; white-space:nowrap; cursor:pointer; }
  .cm-row.is-hidden .cm-name{ color:var(--ink-soft); text-decoration:line-through; }
  .cm-tools{ display:flex; gap:8px; margin:8px 0; flex-wrap:wrap; align-items:center; }
  .cm-count{ font-size:12px; color:var(--ink-soft); margin-left:auto; }
  .ct-gasbar-wrap{ position:relative; flex:1; min-width:0; background:#FBF1D8; border:1px solid #EEDDB4; border-radius:12px; overflow:hidden; }
  .ct-gasbar{ position:relative; display:grid; grid-auto-flow:row; gap:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; padding:4px; }
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
    <div style="height:6px;"></div>

    <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
      <div class="ct-datefield">
        <span class="ct-inlab">日付</span>
        <span class="ct-datetext" id="ctDateText"></span>
        <input type="date" id="ctDate" aria-label="日付">
      </div>
      <div id="ctTimeField" style="display:none;">
        <label for="ctTime">時刻</label>
        <input type="time" id="ctTime">
      </div>
    </div>

    <div class="field" style="margin-bottom:6px;">
      <input type="text" id="ctCustomer" placeholder="顧客名" aria-label="顧客名" autocomplete="off">
    </div>
    <div id="ctKanaArea" style="display:none;">
      <div class="kana-grid" id="ctKanaGrid"></div>
    </div>
    <div class="customer-list" id="ctCustomerList" style="display:none;"></div>

    <div class="field">
      <div class="ct-gashead"><label>ガス種</label><span class="ct-gasdir" aria-hidden="true"><span id="ctGasL">←</span><span id="ctGasR">→</span></span></div>
      <div class="ct-gas-area">
        <div class="ct-gascol">
          <div class="ct-gasbar-wrap" id="ctGasWrap"><div class="ct-chip-row ct-gasbar" id="ctGasChips"></div></div>
        </div>
        <div class="ct-gas-vert" id="ctGasVert"><span></span></div>
      </div>
      <input type="text" id="ctGasOther" placeholder="ガス種を入力" style="margin-top:8px;display:none;" autocomplete="off">
    </div>

    <div class="row-gap" style="margin-top:6px;">
      <div class="field" style="flex:1;">
        <div class="ct-lbrow"><label for="ctSymbol">記号(英数字)</label></div>
        <input type="text" id="ctSymbol" inputmode="email" lang="en" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="例：AB1">
      </div>
      <div class="field" style="flex:2;">
        <div class="ct-lbrow"><label for="ctNumber">番号(数字)</label><button type="button" class="btn-mini" id="ctNumKb" aria-label="キーボードの切り替え">ABC</button></div>
        <input type="text" id="ctNumber" inputmode="numeric" autocomplete="off" placeholder="例：12345">
      </div>
    </div>

    <div class="field">
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="text" id="ctCapacity" inputmode="decimal" maxlength="5" placeholder="容量" aria-label="容量(最大5桁)" autocomplete="off" style="width:7em;flex:none;text-align:right;">
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

  <h2 class="h2-flex"><span>容器ログ(<span id="ctCount">0</span>本)</span><span class="ct-fs" id="ctFsSeg"></span></h2>
  <div class="ct-seg" id="ctFilterSeg" style="margin-bottom:10px;"></div>
  <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;">
    <div class="ct-combo" id="ctSearchCombo" style="flex:2;min-width:0;">
      <input type="text" id="ctSearch" placeholder="客名検索" aria-label="客名検索" autocomplete="off">
      <button type="button" class="ct-combo-btn" id="ctSearchBtn" aria-label="顧客の一覧を開く">▼</button>
      <div class="ct-combo-list" id="ctSearchList" hidden></div>
    </div>
    <div class="ct-combo" id="ctDateCombo" style="flex:1.5;min-width:0;">
      <input type="text" id="ctFilterDate" placeholder="日付検索" aria-label="日付検索" readonly>
      <button type="button" class="ct-combo-btn" id="ctDateBtn" aria-label="日付の一覧を開く">▼</button>
      <div class="ct-combo-list" id="ctDateList" hidden></div>
    </div>
  </div>
  <div class="ct-filter-info" id="ctFilterInfo"></div>
  <div id="ctList"></div>

  <div class="ct-status ct-offline-status"></div>
`;
document.querySelector("main").appendChild(section);

// 記録したとき、大きな文字で一瞬だけ「登録」と出す
const flashEl = document.createElement("div");
flashEl.className = "ct-flash";
flashEl.id = "ctFlash";
document.body.appendChild(flashEl);
let flashTimer = null;
function flashText(t){
  flashEl.textContent = t;
  flashEl.classList.add("show");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => flashEl.classList.remove("show"), 800);
}

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
  const chipGases = GAS_CHIP_ORDER.map(code => GAS_TABLE.find(g => g.code === code)).filter(Boolean)
    .concat(GAS_TABLE.filter(g => !GAS_CHIP_ORDER.includes(g.code)));   // 並びに書き忘れたガス種は最後に足す
  chipGases.forEach(g => addChip(g.label || g.name, g, ctGasSel === g.code, () => pickGas(g.code)));
  addChip("その他", OTHER_GAS_STYLE, ctGasSel === "other", () => pickGas("other"));

  // 上段・下段の2行(左から右へ読む順に並べる)。2行いっしょに横へ滑らせる
  box.style.gridTemplateColumns = `repeat(${Math.ceil(box.children.length / 2)}, max-content)`;
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
  const hasLeft = box.scrollLeft > 2;
  const hasRight = box.scrollLeft + box.clientWidth < box.scrollWidth - 2;
  wrap.classList.toggle("has-left", hasLeft);
  wrap.classList.toggle("has-right", hasRight);
  const L = $("ctGasL"), R = $("ctGasR");                     // 続きのある方向だけ、矢印を点滅させる
  if(L) L.classList.toggle("on", hasLeft);
  if(R) R.classList.toggle("on", hasRight);
}

// 選んだガス種を、ボタン群の右端に縦書きの文字で表示する(背景色はボタンと同じ。誤入力を防ぐ)
function renderGasSelected(){
  const el = $("ctGasVert");
  const g = curGas();
  let text, st = null;
  if(g){
    text = nfkc(g.name);               // ｱｾﾁﾚﾝ → アセチレン(縦書きで正しく読めるよう全角に)
    st = g;
  }else if(ctGasSel === "other"){
    const t = $("ctGasOther").value.trim();
    text = t ? nfkc(t) : "その他";
    st = OTHER_GAS_STYLE;
  }else{
    text = "未選択";
  }
  const sp = el.querySelector("span");
  sp.textContent = text;
  sp.style.cssText = "";
  if(g && g.vertHL){                     // 指定した文字だけ、表示の幅いっぱいに背景を付ける(縦書きなので、文字の高さ=1em×字間)
    const u = 1.05, h = g.vertHL;
    const p1 = Math.round(h.from * u * 100) / 100, p2 = Math.round(h.to * u * 100) / 100;   // 浮動小数の誤差を丸める
    sp.style.flex = "1";
    sp.style.lineHeight = "34px";
    sp.style.background = `linear-gradient(to bottom, transparent ${p1}em, ${h.bg} ${p1}em, ${h.bg} ${p2}em, transparent ${p2}em)`;
  }
  el.style.background = st ? (st.vertBg || st.bg) : "";
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

// ｱｾﾁﾚﾝ：基準の容量に -0.2/-0.1/0.0/+0.1/+0.2 を足し引きする5つのボタン(0.0 を押すと基準に戻る)
function round1(x){ return Math.round(x * 10) / 10; }

function renderAdj(){
  const g = curGas();
  const field = $("ctAdjField");
  if(!g || !g.adj){ field.style.display = "none"; return; }
  field.style.display = "block";
  $("ctAdjLabel").textContent = `${g.name}の容量の増減(基準 ${g.cap}${g.unit})`;

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

  if(ctDateFilter && l.date !== ctDateFilter) return false;     // 日付検索(空＝入力しない)

  const sv = $("ctSearch").value;                                 // 客名検索：客名、または読み仮名
  if(sv.trim() && !matchCust(l, sv)) return false;
  return true;
}

function normQ(x){ return nfkc(x).toUpperCase().replace(/\s+/g, ""); }
function hira(x){ return (typeof toHiragana === "function" ? toHiragana(x) : nfkc(x)).replace(/\s+/g, ""); }

// 客名リスト(取り込み済みなら)から、記録の客の読み仮名を調べる(古い記録の分も補う)
let _mv = -1, _byCode = null, _byName = null, masterVer = 0;
function masterMaps(){
  if(_mv !== masterVer){
    _mv = masterVer; _byCode = new Map(); _byName = new Map();
    allCustomers().forEach(i => {
      if(i.c && !_byCode.has(i.c)) _byCode.set(i.c, i);
      if(i.n && !_byName.has(i.n)) _byName.set(i.n, i);
    });
  }
  return (_byCode.size || _byName.size) ? { byCode:_byCode, byName:_byName } : null;
}
function readingFor(l){
  if(l.customerKana) return l.customerKana;
  const m = masterMaps();
  if(!m) return "";
  const hit = (l.customerCode && m.byCode.get(l.customerCode)) || m.byName.get(l.customer);
  return hit ? (hit.k || "") : "";
}
function matchCust(l, text){
  const q = normQ(text);
  if(!q) return true;
  if(normQ(l.customer).includes(q)) return true;
  const r = readingFor(l);
  return !!r && hira(r).includes(hira(text));
}

/* ---------- 検索欄・日付検索のコンボボックス ---------- */
let ctDateFilter = "";   // 日付検索：YYYY-MM-DD(空＝入力しない)

function comboItem(box, text, isNone, onPick){
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ct-combo-item" + (isNone ? " none" : "");
  b.textContent = text;
  b.addEventListener("click", onPick);
  box.appendChild(b);
}

function closeCombos(exceptId){
  ["ctSearchList", "ctDateList"].forEach(id => { if(id !== exceptId) $(id).hidden = true; });
}

function renderSearchList(){
  const box = $("ctSearchList");
  box.innerHTML = "";
  comboItem(box, "入力しない", true, () => { $("ctSearch").value = ""; box.hidden = true; renderList(); });
  const seen = new Map();
  ctLogs.forEach(l => { if(l.customer && !seen.has(l.customer)) seen.set(l.customer, l); });
  const text = $("ctSearch").value;
  const names = [...seen.keys()]
    .filter(n => !text.trim() || matchCust(seen.get(n), text))
    .sort((x, y) => x.localeCompare(y, "ja"));
  names.forEach(n => comboItem(box, n, false, () => { $("ctSearch").value = n; box.hidden = true; renderList(); }));
  if(names.length === 0){
    const none = document.createElement("div");
    none.className = "customer-empty";
    none.textContent = "該当する顧客はありません";
    box.appendChild(none);
  }
}

function renderDateList(){
  const box = $("ctDateList");
  box.innerHTML = "";
  comboItem(box, "入力しない", true, () => { ctDateFilter = ""; box.hidden = true; renderList(); });
  [...new Set(ctLogs.map(l => l.date).filter(Boolean))].sort().reverse().forEach(dt =>
    comboItem(box, fmtDateWeek(dt), false, () => { ctDateFilter = dt; box.hidden = true; renderList(); }));
}

function toggleCombo(listId, render){
  const box = $(listId);
  const willOpen = box.hidden;
  closeCombos(listId);
  if(willOpen){ render(); box.hidden = false; box.scrollTop = 0; } else { box.hidden = true; }
}

// 開いている一覧は、ログが増減したときに作り直す
function renderCustList(){
  if(!$("ctSearchList").hidden) renderSearchList();
  if(!$("ctDateList").hidden) renderDateList();
}

// 日付検索の欄に、選んだ日付(なければ空＝「入力しない」の表示)
function updateDatePh(){
  $("ctFilterDate").value = ctDateFilter ? fmtDateWeek(ctDateFilter) : "";
}

/* ---------- 直近に作業した顧客名(その日のうち) ---------- */
let ctAutoCust = "";            // 自動で入れた顧客名(自分で書き換えたら、空にする)
let lastCust = null;
try{ lastCust = JSON.parse(localStorage.getItem("lastCustomer") || "null"); }catch(e){ lastCust = null; }
function trackCustomer(name){
  const n = String(name || "").trim();
  if(!n) return;
  lastCust = { name:n, date:getToday() };
  try{ localStorage.setItem("lastCustomer", JSON.stringify(lastCust)); }catch(e){ /* 保存できなくても動く */ }
}
function recentCustomer(){ return (lastCust && lastCust.date === getToday()) ? lastCust.name : ""; }

// ホームで作業中の顧客名(訪問中・訪問の編集中・ホームの訪問先に入力中)。なければ空
function captureHomeCustomer(){
  if(typeof currentVisit !== "undefined" && currentVisit && currentVisit.target) return String(currentVisit.target).trim();
  const vs = $("visitScreen");
  if(vs && vs.classList.contains("active") && $("visitTarget") && $("visitTarget").value.trim()) return $("visitTarget").value.trim();
  const hv = $("homeVisitTarget"), rs = $("reportScreen");
  if(hv && rs && rs.classList.contains("active") && hv.value.trim()) return hv.value.trim();
  return "";
}
// 容器タブを開くとき、顧客名の欄に初期入力する(修正はできる)
//   ・ホームで作業中の顧客があれば、それを入れる(変更中・追加中は触らない)
//   ・なければ、直近に作業した顧客を、欄が空か、自動で入れたままのときだけ入れる
function fillContainerCustomer(strong){
  if(ctEditId || ctAdding) return;
  const inp = $("ctCustomer"), cur = inp.value.trim();
  let name = "";
  if(strong) name = strong;
  else if(!cur || cur === ctAutoCust) name = recentCustomer();
  if(!name || name === cur) return;
  inp.value = name;
  ctAutoCust = name;
  ctPicked = null;
  showCustomerList(null);
}

/* ---------- 顧客名の選択(日報アプリの客先名リストを共用) ---------- */
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
        ctPicked = { code: item.c || "", name: item.n, k: item.k || "" };
        trackCustomer(item.n);
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

// 文字を打つと候補が出る(客先名リストがあるときだけ)
$("ctCustomer").addEventListener("input", () => {
  ctAutoCust = "";
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
   記録(新規／編集)
========================================================= */
// フォームの状態(通常／編集中／追加中)に合わせて、見出しとボタンを切り替える
function updateFormMode(){
  const editing = !!ctEditId;
  const adding = !editing && ctAdding;
  $("ctSaveButton").textContent = editing ? "更新" : "記録する";
  const cancel = $("ctCancelEdit");
  cancel.style.display = (editing || adding) ? "block" : "none";
  cancel.textContent = editing ? "更新をやめる" : "追加をやめる";
  $("ctTitle").textContent = editing ? "容器ログ(変更中)" : (adding ? "容器ログ(追加中)" : "容器ログ");
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
      if(!window.confirm(`番号に英字入力しますか？\n(入力された英字：${list})`)){
        $("ctNumber").focus();
        return;
      }
    }else{
      showToast("番号は半角の数字で入力してください(英字は確認のうえ入力できます)");
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
  let kana = "";                       // 読み仮名(客名リストから。読みでも検索できるように保存)
  if(ctPicked && ctPicked.name === f.customer && ctPicked.k) kana = ctPicked.k;
  else{ const mm = masterMaps(); const hit = mm && mm.byName.get(f.customer); kana = hit ? (hit.k || "") : ""; }

  const wasEditing = !!targetId;
  if(targetId){
    const log = ctLogs.find(x => x.id === targetId);
    if(log){
      Object.assign(log, f, { customerCode: code, customerKana: kana });
      delete log.sentAt;                 // 直した記録は、また未送信に戻す
      const t = $("ctTime").value;
      if(t) log.time = t;
    }
    ctEditId = null;
    showToast("更新しました");
  }else{
    ctLogs.push(Object.assign({ id:newId(), time:nowHM() }, f, { customerCode: code, customerKana: kana, createdAt:new Date().toISOString() }));
    showToast(`${statusName(f.status)}を記録しました`);
  }
  ctSave();
  trackCustomer(f.customer);
  flashText(wasEditing ? "更新" : "登録");

  // 記号・番号は、記録のたびに空白(初期状態)へ戻す。区分・顧客・ガス種・容量は残す
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
  ctPicked = l.customerCode ? { code:l.customerCode, name:l.customer, k:l.customerKana || "" } : null;
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
  ctPicked = hit ? { code:hit.customerCode, name, k:hit.customerKana || "" } : null;
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
function applyFs(){
  const list = $("ctList"), f = FS[ctFs];
  [["name","--fs-name"],["sum","--fs-sum"],["line","--fs-line"],["badge","--fs-badge"],["btn","--fs-btn"],["row","--fs-row"],["hint","--fs-hint"],["swipe","--fs-swipe"]]
    .forEach(([k, v]) => list.style.setProperty(v, f[k] + "px"));
  const seg = $("ctFsSeg");
  seg.innerHTML = "";
  [["s","小"],["m","標準"],["l","大"]].forEach(([k, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-fs", k);
    b.textContent = label;
    b.className = k === ctFs ? "on" : "";
    seg.appendChild(b);
  });
}

function renderList(){
  const list = $("ctList");
  list.innerHTML = "";
  applyFs();
  renderCustList();
  updateDatePh();

  const logs = ctLogs
    .filter(passFilter)
    .sort((a,b) =>
      (b.date || "").localeCompare(a.date || "") ||
      (b.time || "").localeCompare(a.time || "") ||
      (b.createdAt || "").localeCompare(a.createdAt || ""));

  $("ctCount").textContent = logs.length;

  const info = [];
  if(ctFilter !== "all") info.push(ctFilter === "2" ? "出庫のみ" : (ctFilter === "3" ? "空受のみ" : "出庫・空受以外"));
  if($("ctSearch").value.trim()) info.push(`顧客「${$("ctSearch").value.trim()}」`);
  if(ctDateFilter) info.push(`日付 ${fmtDateWeek(ctDateFilter)}`);
  $("ctFilterInfo").textContent = info.length ? "絞り込み中：" + info.join("・") : "";

  if(logs.length === 0){
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = info.length ? `条件に合う容器ログはありません(${info.join("・")})` : "容器ログはまだありません";
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
      // 新しい順(上が新しい)
      const rows = [...c.rows].sort((a,b) =>
        (b.time || "").localeCompare(a.time || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));

      const card = document.createElement("div");
      card.className = "ct-cust";
      const ckey = `${day.date}|${c.name}`;
      const open = ctOpen.has(ckey);

      // 区分ごと → ガス種ごと の本数と合計数量(数量は数字のみ・単位なし)
      const noCap = l => (l.capacity === "" || l.capacity == null);
      const gasOrd = l => { const i = GAS_TABLE.findIndex(g => g.code === l.gasCode); return i >= 0 ? i : 100; };
      const byStatus = {};
      rows.forEach(l => {                              // 容量のある行を先に集計
        if(noCap(l)) return;
        const list = byStatus[l.status] || (byStatus[l.status] = []);
        const gname = l.gas || "(ガス種なし)";
        let g = list.find(x => x.name === gname && x.unit === (l.unit || ""));
        if(!g){ g = { name:gname, unit:l.unit || "", ord:gasOrd(l), n:0, sum:0, hasQty:true }; list.push(g); }
        g.n++;
        g.sum += Number(l.capacity) || 0;
      });
      rows.forEach(l => {                              // 容量が空欄の行は、本数だけ数える
        if(!noCap(l)) return;
        const list = byStatus[l.status] || (byStatus[l.status] = []);
        const gname = l.gas || "(ガス種なし)";
        let g = list.find(x => x.name === gname);
        if(!g){ g = { name:gname, unit:"", ord:gasOrd(l), n:0, sum:0, hasQty:false }; list.push(g); }
        g.n++;
      });
      const order = sc => sc === 2 ? 0 : (sc === 3 ? 1 : 2 + sc);

      const badgeW = Math.ceil(Math.max(...Object.keys(byStatus).map(sc => emW(statusName(Number(sc)))), 2) * FS[ctFs].badge + 24);
      card.style.setProperty("--sumw", badgeW + "px");
      let html = `<div class="ct-cust-head"><span class="ct-cust-name">${escapeHtml(c.name || "(顧客名なし)")}</span>` +
                 `<span class="ct-cust-sum">合計 ${rows.length}本</span></div>`;
      Object.keys(byStatus).map(Number).sort((x, y) => order(x) - order(y)).forEach(sc => {
        const cls = sc === 2 ? "out" : (sc === 3 ? "in" : "oth");
        const parts = byStatus[sc]
          .sort((p, q) => p.ord - q.ord || p.name.localeCompare(q.name, "ja") || p.unit.localeCompare(q.unit))
          .map(g => `<span class="ct-sum-gas">${escapeHtml(shortGas(g.name))} ${g.n}本${g.hasQty ? "(" + round1(g.sum) + ")" : ""}</span>`).join("");
        html += `<div class="ct-sum-line"><span class="ct-badge ${cls}">${escapeHtml(statusName(sc))}</span><span class="ct-sum-gases">${parts}</span></div>`;
      });

      // 「明細」を押したときだけ、1本ずつ表示する(行を右へスワイプ＝変更、左へスワイプ＝削除)
      // 並び順：区分 → ガス種 → 記号・番号。区分は同じ区分の見出しとして1回だけ出し、記号番号の行は1文字右へ。時刻は出さない
      if(open){
        const numCmp = (p, q) => (/^\d+$/.test(p) && /^\d+$/.test(q))
          ? (Number(p) - Number(q)) || p.localeCompare(q)
          : String(p).localeCompare(String(q));
        const detail = [...rows].sort((p, q) =>
          order(p.status) - order(q.status) || gasOrd(p) - gasOrd(q) ||
          String(p.gas || "").localeCompare(String(q.gas || ""), "ja") ||
          String(p.symbol).localeCompare(String(q.symbol)) || numCmp(p.number, q.number));

        // 列の幅をそろえる(記号番号と容量は固定幅、ガス種は残り)。容量は数字だけ(単位は出さない)
        const capStr = l => noCap(l) ? "" : String(l.capacity);
        const c2 = Math.max(...detail.map(l => String(l.symbol).length + 1 + String(l.number).length));
        const c4 = Math.ceil(Math.max(...detail.map(l => emW(capStr(l)))) * FS[ctFs].row + 4);
        const cols = `${c2}ch minmax(0,1fr) ${c4}px`;

        html += `<div class="ct-swipe-hint"><span class="ct-hint">` +
          `<span class="ct-hint-l"><span class="arrow">←</span><span class="word">削除</span></span>` +
          `<span class="ct-hint-r"><span class="word">変更</span><span class="arrow">→</span></span>` +
          `</span></div>`;
        let prevStatus = null;
        detail.forEach(l => {
          const cls = l.status === 2 ? "out" : (l.status === 3 ? "in" : "oth");
          if(l.status !== prevStatus){
            prevStatus = l.status;
            html += `<div class="ct-dhead"><span class="ct-badge ${cls}">${escapeHtml(statusName(l.status))}</span></div>`;
          }
          html += `
            <div class="ct-swrap" data-id="${escapeHtml(l.id)}">
              <div class="ct-swbg"><span class="ct-sw-edit">変更</span><span class="ct-sw-del">削除</span></div>
              <div class="ct-row ct-drow" style="grid-template-columns:${cols}">
                <span class="ct-d2">${escapeHtml(l.symbol)}-${escapeHtml(l.number)}</span>
                <span class="ct-d3">${escapeHtml(shortGas(l.gas || ""))}${l.sentAt ? '<span class="ct-sent">済</span>' : ""}</span>
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
    trackCustomer(k.split("|").slice(1).join("|"));
    if(ctOpen.has(k)) ctOpen.delete(k); else ctOpen.add(k);
    renderList();
    return;
  }
  const add = e.target.closest(".ct-add");
  if(add){ trackCustomer(decodeURIComponent(add.getAttribute("data-name"))); startAddTo(decodeURIComponent(add.getAttribute("data-name")), add.getAttribute("data-date")); return; }
});

function deleteLog(id){
  const l = ctLogs.find(x => x.id === id);
  if(!l) return;
  if(!window.confirm(`${l.symbol}-${l.number}(${statusName(l.status)})を削除しますか？`)) return;
  ctLogs = ctLogs.filter(x => x.id !== id);
  if(ctEditId === id) cancelEdit();
  ctSave();
  renderList();
  showToast("削除しました");
}

/* 行のスワイプ：右へ＝変更(上のフォームで変更状態に)、左へ＝削除(確認あり)。縦スクロールは邪魔しない */
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
      return "shared";
    }
  }catch(err){
    if(err && err.name === "AbortError") return false;   // 共有画面を閉じただけ
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}

/* 容器ログ：未送信の分をCSVにして、共有画面からメールで送る(添付)。共有画面が使えない環境では、保存してメールの下書きを開く */
async function mailContainerCsv(){
  const logs = ctLogs.filter(l => !l.sentAt);
  if(logs.length === 0){ showToast("未送信の容器はありません"); return; }
  const name = `容器ログ_${getToday().replace(/-/g,"")}.csv`;
  const r = await saveFile(name, csvText(logs), "text/csv", true);
  if(r === "shared"){
    showToast("送れたら「送信済みにする」を押してください");
  }else if(r === "downloaded"){
    const subject = `容器ログ ${getToday()}`;
    const body = "容器ログのCSVを添付してください(ダウンロードに保存しました)";
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}

// 緯度,経度を、小数第5位(約1メートル)までの数字にする。取れていないときは空欄
function posText(lat, lng, loc){
  let a = lat, b = lng;
  if((a === "" || a == null || b === "" || b == null) && typeof loc === "string" && loc.includes(",")){
    const p = loc.split(",");
    a = p[0]; b = p[1];
  }
  const x = parseFloat(a), y = parseFloat(b);
  return (isFinite(x) && isFinite(y)) ? `${x.toFixed(5)},${y.toFixed(5)}` : "";
}

/* 日報メール：送信済みにした記録は送らない。末尾に、未送信の「容器ログ」を付ける */
const origBuildReportMail = window.buildReportMail;
if(typeof origBuildReportMail === "function"){
  window.buildReportMail = function(){
    const m0 = meetingLogs, v0 = dailyVehicleInfo;
    const visitCopies = [];
    const today = getToday();
    let r;
    try{
      // 末尾に目印を付けて渡し、できあがった本文の目印の所へ、位置情報の行を差し込む(特記事項が複数行でも崩れない)
      meetingLogs = m0.filter(l => !l.sentAt).map((l, i) => {
        visitCopies.push(l);
        return Object.assign({}, l, { notes:(l.notes || "") + "\u0001L" + i + "\u0001" });
      });
      const vf = {};
      Object.keys(v0).forEach(k => {
        const v = v0[k];
        if(v && v.sentAt) return;
        const marked = v && (k === today || (typeof vehicleHasData === "function" && vehicleHasData(v)));
        vf[k] = marked
          ? Object.assign({}, v, { return: Object.assign({}, v.return, { fuel: ((v.return && v.return.fuel) || "") + "\u0001V" + k + "\u0001" }) })
          : v;
      });
      dailyVehicleInfo = vf;
      r = origBuildReportMail();
    }finally{
      meetingLogs = m0;
      dailyVehicleInfo = v0;
    }
    r.body = r.body
      .replace(/\u0001L(\d+)\u0001/g, (m, i) => {
        const l = visitCopies[Number(i)] || {};
        return `\n開始位置：${posText(l.startLat, l.startLng, l.startLocation)}\n終了位置：${posText(l.endLat, l.endLng, l.endLocation)}`;
      })
      .replace(/\u0001V([\d-]+)\u0001/g, (m, k) => {
        const v = v0[k] || {}, d = v.departure || {}, rt = v.return || {};
        let wxLine = "";
        try{
          const w = (JSON.parse(localStorage.getItem(WX_DAILY_KEY) || "{}") || {})[k];
          if(w && w.text) wxLine = `\n天気：${w.text}${w.max != null ? "　最高" + w.max : ""}${w.min != null ? "　最低" + w.min : ""}`;
        }catch(e){ wxLine = ""; }
        return `\n出発位置：${posText(d.lat, d.lng, d.location)}\n帰社位置：${posText(rt.lat, rt.lng, rt.location)}${wxLine}`;
      });
    const unsent = ctLogs.filter(l => !l.sentAt);
    if(unsent.length > 0){
      r.body += "【容器ログ】\n" + CSV_HEAD.join(",") + "\n" + csvLines(unsent).join("\n") + "\n";
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
   バックアップ(ホーム画面の下部にボタンを追加)
========================================================= */
async function backupExport(){
  const data = {};
  BACKUP_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if(v !== null) data[k] = v;
  });
  const obj = { app:"eigyo-nippo", version:1, exportedAt:new Date().toISOString(), data };
  const r = await saveFile(`営業日報バックアップ_${getToday().replace(/-/g,"")}.json`, JSON.stringify(obj), "application/json", false);
  if(r){ try{ localStorage.setItem("lastBackupAt", new Date().toISOString()); }catch(e){} renderData(); }
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

/* =========================================================
   「データ」画面：送る・保存・消す をここに集める
========================================================= */
const dataSection = document.createElement("section");
dataSection.id = "dataScreen";
dataSection.className = "screen";
dataSection.innerHTML = `
  <h2>データ</h2>

  <div class="dt-chips" id="dtUnsent">
    <span class="dt-chips-label">未送信</span>
    <span class="dt-chip v" id="dtChipV"></span>
    <span class="dt-chip d" id="dtChipD"></span>
    <span class="dt-chip c" id="dtChipC"></span>
  </div>

  <section class="dt-frame send">
    <div class="dt-head">送る</div>
    <div class="dt-body">
      <div class="dt-item">
        <button class="btn btn-outline-mint" id="dtMailReport">全データをメール送信<br>(日報・車両・ToDo・容器)</button>
        <div class="dt-desc">未送信の全データを送る</div>
      </div>
      <div class="dt-item">
        <button class="btn btn-outline-mint" id="dtMailCsv">容器だけメール送信<br>(CSV添付)</button>
        <div class="dt-desc" id="dtMailCsvDesc"></div>
      </div>
      <div class="dt-item">
        <button class="btn btn-outline-mint" id="dtCsv">容器だけスマホ保存<br>(CSV保存)</button>
        <div class="dt-desc" id="dtCsvDesc"></div>
      </div>
      <div class="dt-item">
        <button class="btn btn-mint" id="dtMarkSent">送信済みにする</button>
        <div class="dt-desc">送ったあとに押す。次から送らない</div>
      </div>
    </div>
  </section>

  <section class="dt-frame save">
    <div class="dt-head">保存</div>
    <div class="dt-body">
      <div class="dt-state" id="dtLastBackup"></div>
      <div class="dt-item">
        <button class="btn btn-outline-mint" id="dtBackup">バックアップ保存</button>
        <div class="dt-desc">日報・車両・容器・ToDo</div>
      </div>
      <div class="dt-item">
        <button class="btn btn-outline-mint" id="dtRestore">バックアップから戻す</button>
        <div class="dt-desc">保存したファイルで置き換え</div>
      </div>
    </div>
  </section>

  <section class="dt-frame master">
    <div class="dt-head">顧客リスト(ダウンロード)</div>
    <div class="dt-body" id="dtMaster">
      <div class="dt-item">
        <button class="btn btn-outline-mint" id="dtCustManage">顧客の管理</button>
        <div class="dt-desc">表示・非表示、顧客の追加</div>
      </div>
    </div>
  </section>

  <section class="dt-frame del">
    <button type="button" class="dt-head dt-toggle" id="dtDelHead" aria-expanded="false"><span>消す</span><span id="dtCaret">▶</span></button>
    <div class="dt-body" id="dtDelBody" hidden>
      <div class="dt-note">消すと戻せません。先にバックアップを</div>
      <div class="dt-item">
        <button class="btn btn-outline-pink" id="dtDelSent">送信済みを削除</button>
        <div class="dt-desc" id="dtDelSentDesc"></div>
      </div>
      <div class="dt-item">
        <button class="btn btn-outline-pink" id="dtDelReport">日報・車両を削除</button>
        <div class="dt-desc" id="dtDelReportDesc"></div>
      </div>
      <div class="dt-item">
        <button class="btn btn-outline-pink" id="dtDelContainer">容器を削除</button>
        <div class="dt-desc" id="dtDelContainerDesc"></div>
      </div>
      <div class="dt-item">
        <button class="btn btn-outline-pink" id="dtDelTodo">ToDoリストを削除</button>
        <div class="dt-desc" id="dtDelTodoDesc"></div>
      </div>
    </div>
  </section>
`;
document.querySelector("main").appendChild(dataSection);

// ホームにあった客先名リストの操作(取り込み・更新・削除)を、この画面へ移す
(function moveMasterUI(){
  const host = $("dtMaster");
  const bar = document.querySelector("#reportScreen .master-bar");
  const keyBox = $("masterKeyBox");
  if(bar) host.appendChild(bar);
  if(keyBox) host.appendChild(keyBox);
})();

/* =========================================================
   顧客リスト：非表示にした顧客と、追加した顧客
   ・ダウンロードしたリスト(customerMaster)とは別に保存する。新しくダウンロードしても残る
   ・顧客コードを目印にする(コードがない顧客は名前)
   ・ホームと容器の顧客選択には、非表示を除き、追加分を足した「見える分」だけを渡す
========================================================= */
const CH_KEY = "customerHidden", CE_KEY = "customerExtra";
function loadJson(k, def){ try{ const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? def : v; }catch(e){ return def; } }
let custHidden = new Set(loadJson(CH_KEY, []));
let custExtra = loadJson(CE_KEY, []);
if(!Array.isArray(custExtra)) custExtra = [];
function custKey(i){ return i.c ? "c:" + i.c : "n:" + i.n; }
function saveCust(){
  localStorage.setItem(CH_KEY, JSON.stringify([...custHidden]));
  localStorage.setItem(CE_KEY, JSON.stringify(custExtra));
}
function rawMaster(){ try{ return JSON.parse(localStorage.getItem("customerMaster") || "null"); }catch(e){ return null; } }

// 非表示も含めた全件(ダウンロード + 追加)。追加分のコードがダウンロード側にもあるときは、ダウンロード側を使う
function allCustomers(){
  const raw = rawMaster();
  const base = (raw && Array.isArray(raw.items)) ? raw.items : [];
  const codes = new Set(base.map(i => i.c).filter(Boolean));
  const extras = custExtra.filter(e => !(e.c && codes.has(e.c))).map(e => ({ n:e.n, k:e.k || "", c:e.c || "", x:true, id:e.id }));
  return base.map(i => ({ n:i.n, k:i.k || "", c:i.c || "", x:false })).concat(extras);
}
function applyMasterOverlay(){
  const raw = rawMaster();
  const vis = allCustomers().filter(i => !custHidden.has(custKey(i)));
  masterVer++;
  if(!raw && custExtra.length === 0){ customerMaster = null; return; }
  customerMaster = { office: raw ? (raw.office || "") : "", updated: raw ? (raw.updated || "") : "", items: vis.map(i => ({ n:i.n, k:i.k, c:i.c })) };
}

const origRenderMasterUI = window.renderMasterUI;
if(typeof origRenderMasterUI === "function"){
  window.renderMasterUI = function(){
    applyMasterOverlay();
    origRenderMasterUI();
    const st = $("masterStatus");
    if(st){
      let t = st.textContent.replace("客先名リスト", "顧客リスト");
      const hid = allCustomers().filter(i => custHidden.has(custKey(i))).length;
      if(hid > 0) t += `(非表示 ${hid})`;
      st.textContent = t;
    }
  };
}
// 表示の言葉をそろえる：「客先名リスト」→「顧客リスト」、「TODO」→「ToDo」
const origShowToast = window.showToast;
if(typeof origShowToast === "function"){
  window.showToast = function(m){ origShowToast(String(m).replace(/TODO/g, "ToDo").replace(/客先名リスト/g, "顧客リスト").replace(/営業所キー/g, "担当キー")); };
}
/* =========================================================
   天気(気象庁の予報データ。位置は外へ送らない)
   ・現在地に一番近い予報区を選び、その区のファイルを取ってくる
   ・ヘッダー: 日付の横に「天気・最高気温」、2行目に「降水確率(今・数時間後)」。タップで詳細
   ・電波がないときは、最後に取れた内容を使う。その日の最初の天気を、日報の記録にする
========================================================= */
const WX_AREAS = [   // 予報区(一次細分区域)の代表地点。office＝気象庁の予報ファイルの番号
  { office:"011000", name:"宗谷地方", lat:45.42, lng:141.67 },
  { office:"012000", name:"上川地方", lat:43.77, lng:142.37 },
  { office:"012000", name:"留萌地方", lat:43.94, lng:141.64 },
  { office:"013000", name:"網走地方", lat:44.02, lng:144.27 },
  { office:"013000", name:"北見地方", lat:43.81, lng:143.89 },
  { office:"013000", name:"紋別地方", lat:44.36, lng:143.36 },
  { office:"014030", name:"十勝地方", lat:42.92, lng:143.20 },
  { office:"014100", name:"根室地方", lat:43.33, lng:145.58 },
  { office:"014100", name:"釧路地方", lat:42.98, lng:144.38 },
  { office:"015000", name:"胆振地方", lat:42.63, lng:141.60 },
  { office:"015000", name:"日高地方", lat:42.17, lng:142.77 },
  { office:"016000", name:"石狩地方", lat:43.06, lng:141.35 },
  { office:"016000", name:"空知地方", lat:43.20, lng:141.78 },
  { office:"016000", name:"後志地方", lat:42.90, lng:140.76 },
  { office:"017000", name:"渡島地方", lat:41.77, lng:140.73 },
  { office:"017000", name:"檜山地方", lat:41.87, lng:140.12 }
];
const WX_POINTS = {   // 気温の地点
  "稚内":[45.42,141.67], "旭川":[43.77,142.37], "留萌":[43.94,141.64], "網走":[44.02,144.27], "紋別":[44.36,143.36],
  "北見":[43.81,143.89], "帯広":[42.92,143.20], "釧路":[42.98,144.38], "根室":[43.33,145.58], "室蘭":[42.32,140.97],
  "苫小牧":[42.63,141.60], "浦河":[42.17,142.77], "札幌":[43.06,141.35], "岩見沢":[43.20,141.78], "倶知安":[42.90,140.76],
  "函館":[41.77,140.73], "江差":[41.87,140.12]
};
const WX_KEY = "wxCache", WX_DAILY_KEY = "dailyWeather";
const WX_URL = o => `https://www.jma.go.jp/bosai/forecast/data/forecast/${o}.json`;

function wxDist(lat1, lng1, lat2, lng2){ const dx = (lng1 - lng2) * 0.73, dy = lat1 - lat2; return Math.sqrt(dx * dx + dy * dy); }
function wxNearest(lat, lng){
  let best = null, bd = 1e9;
  WX_AREAS.forEach(a => { const d = wxDist(lat, lng, a.lat, a.lng); if(d < bd){ bd = d; best = a; } });
  return bd <= 3.0 ? best : null;              // 北海道から離れすぎているときは出さない
}
const wxClean = t => String(t || "").replace(/[\u3000\s]+/g, " ").trim();
const wxJstDate = ms => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);

function wxParse(json, area, lat, lng){
  const rep0 = json[0], ts = rep0.timeSeries;
  const pick = (arr, name) => (arr || []).find(a => a.area && a.area.name === name) || (arr || [])[0] || {};
  const a0 = pick(ts[0].areas, area.name), a1 = pick(ts[1].areas, area.name);
  let tp = null;
  if(ts[2] && ts[2].areas && ts[2].areas.length){
    let bd = 1e9;
    ts[2].areas.forEach(p => { const c = WX_POINTS[p.area.name]; if(c){ const d = wxDist(lat, lng, c[0], c[1]); if(d < bd){ bd = d; tp = p; } } });
    if(!tp) tp = ts[2].areas[0];
  }
  const d = {
    office: area.office, areaName: area.name, report: rep0.reportDatetime, fetchedAt: new Date().toISOString(),
    wTimes: ts[0].timeDefines || [], weathers: (a0.weathers || []).map(wxClean), codes: a0.weatherCodes || [],
    popsT: ts[1].timeDefines || [], popsV: a1.pops || [],
    tempName: tp ? tp.area.name : "", tempsT: tp ? (ts[2].timeDefines || []) : [], tempsV: tp ? (tp.temps || []) : []
  };
  const wk = json[1];                                   // 週間予報：翌々日など、短い予報にない日を補う
  if(wk && wk.timeSeries && wk.timeSeries[0]){
    const w0 = pick(wk.timeSeries[0].areas, area.name);
    d.wkT = wk.timeSeries[0].timeDefines || []; d.wkCodes = w0.weatherCodes || []; d.wkPops = w0.pops || [];
    const t1 = wk.timeSeries[1];
    if(t1 && t1.areas && t1.areas.length){
      const wp = t1.areas.find(p => p.area && p.area.name === d.tempName) || t1.areas[0];
      d.wkMin = wp.tempsMin || []; d.wkMax = wp.tempsMax || [];
    }
  }
  return d;
}
function wxTempsFor(d, dayKey){
  const out = {};
  (d.tempsT || []).forEach((t, i) => {
    const v = parseFloat(d.tempsV[i]);
    if(!isFinite(v)) return;
    const day = String(t).slice(0, 10), hour = parseInt(String(t).slice(11, 13), 10);
    out[day] = out[day] || {};
    if(hour === 9) out[day].max = v; else if(hour === 0) out[day].min = v;
  });
  return out[dayKey] || {};
}
function wxTemps(d, nowMs){
  const today = wxTempsFor(d, wxJstDate(nowMs));
  if(today.min != null && today.max != null && today.min >= today.max) delete today.min;   // 今日の最低は、過ぎた時刻の値が入ることがある
  return today;
}
function wxPops(d, nowMs){                    // 今のブロックと、そのあと2つ(6時間ごと)
  const t = d.popsT || [];
  let idx = -1;
  for(let i = 0; i < t.length; i++){ const st = Date.parse(t[i]); if(st <= nowMs && nowMs < st + 6 * 3600 * 1000){ idx = i; break; } }
  if(idx < 0) return [];
  const res = [];
  for(let k = 0; k < 3 && idx + k < t.length; k++){
    res.push({ label: k === 0 ? "今" : `${parseInt(String(t[idx + k]).slice(11, 13), 10)}時〜`, v: d.popsV[idx + k] });
  }
  return res;
}
// 天気コード → 短い言葉(よく出るものだけ。ないものは、最初の数字から 晴れ・くもり・雨・雪)
const WX_CODE_WORDS = {
  "100":"晴れ","101":"晴れ 時々 くもり","102":"晴れ 一時 雨","103":"晴れ 時々 雨","104":"晴れ 一時 雪","105":"晴れ 時々 雪",
  "110":"晴れ のち くもり","111":"晴れ のち くもり","112":"晴れ のち 一時 雨","113":"晴れ のち 時々 雨","114":"晴れ のち 雨","115":"晴れ のち 一時 雪",
  "200":"くもり","201":"くもり 時々 晴れ","202":"くもり 一時 雨","203":"くもり 時々 雨","204":"くもり 一時 雪","205":"くもり 時々 雪",
  "210":"くもり のち 晴れ","211":"くもり のち 晴れ","212":"くもり のち 一時 雨","213":"くもり のち 時々 雨","214":"くもり のち 雨","215":"くもり のち 一時 雪",
  "300":"雨","301":"雨 時々 晴れ","302":"雨 時々 止む","303":"雨 時々 雪","311":"雨 のち 晴れ","313":"雨 のち くもり","314":"雨 のち 時々 雪",
  "400":"雪","401":"雪 時々 晴れ","402":"雪 時々 止む","403":"雪 時々 雨","411":"雪 のち 晴れ","413":"雪 のち くもり","414":"雪 のち 雨"
};
function wxCodeWord(code){
  const c = String(code || "");
  return WX_CODE_WORDS[c] || ({ "1":"晴れ", "2":"くもり", "3":"雨", "4":"雪" })[c[0]] || "";
}
// 今日・明日・明後日の3日分
function wxDays(d, nowMs){
  const labels = ["今日", "明日", "明後日"];
  return labels.map((label, i) => {
    const key = wxJstDate(nowMs + i * 24 * 3600 * 1000), out = { label, key };
    let si = (d.wTimes || []).findIndex(t => String(t).slice(0, 10) === key);
    if(si < 0 && !d.wTimes && i < (d.weathers || []).length) si = i;           // 古い保存形式
    const wi = (d.wkT || []).findIndex(t => String(t).slice(0, 10) === key);
    if(si >= 0 && d.weathers && d.weathers[si]){ out.text = d.weathers[si]; out.code = (d.codes || [])[si]; out.word = out.text.split(" ")[0]; }
    else if(wi >= 0 && d.wkCodes && d.wkCodes[wi]){ out.code = d.wkCodes[wi]; out.text = wxCodeWord(out.code); out.word = out.text.replace(/ /g, ""); }
    const tm = i === 0 ? wxTemps(d, nowMs) : wxTempsFor(d, key);
    if(tm.max == null && wi >= 0 && d.wkMax){ const v = parseFloat(d.wkMax[wi]); if(isFinite(v)) tm.max = v; }
    if(tm.min == null && wi >= 0 && d.wkMin){ const v = parseFloat(d.wkMin[wi]); if(isFinite(v)) tm.min = v; }
    out.max = tm.max; out.min = tm.min;
    if(i === 0){ out.popsNow = wxPops(d, nowMs); }
    else{
      const vals = [];
      (d.popsT || []).forEach((t, j) => { if(String(t).slice(0, 10) === key){ const v = parseFloat(d.popsV[j]); if(isFinite(v)) vals.push(v); } });
      if(vals.length) out.pop = Math.max(...vals);
      else if(wi >= 0 && d.wkPops){ const v = parseFloat(d.wkPops[wi]); if(isFinite(v)) out.pop = v; }
    }
    return out;
  });
}
function wxItemText(day){
  if(!day.text) return "";
  const icon = wxIcon(day.code);
  let s = `${day.label}：${icon ? icon + " " : ""}${day.word}`;
  if(day.max != null) s += ` 最高${day.max}℃`;
  if(day.min != null) s += ` 最低${day.min}℃`;
  if(day.popsNow && day.popsNow.length) s += " 降水 " + day.popsNow.map(x => `${x.label}${x.v}%`).join(" ");
  else if(day.pop != null) s += ` 降水${day.pop}%`;
  return s;
}
function wxIcon(code){ return ({ "1":"☀", "2":"☁", "3":"☂", "4":"❄" })[String(code || "")[0]] || ""; }

function wxLoad(){ try{ return JSON.parse(localStorage.getItem(WX_KEY) || "null"); }catch(e){ return null; } }
function wxReduced(){ try{ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; } }
let wxDayIdx = 0;
function wxRender(){
  const d = wxLoad(), btn = $("ctWx");
  if(!btn) return;
  const track = btn.querySelector(".ct-wxtrack");
  const items = (d && d.weathers && d.weathers.length) ? wxDays(d, Date.now()).map(wxItemText).filter(Boolean) : [];
  if(items.length === 0){ btn.hidden = true; track.textContent = ""; return; }
  const mark = (Date.now() - Date.parse(d.fetchedAt) > 3 * 3600 * 1000) ? "* " : "";     // 3時間より古いときは「*」
  btn.hidden = false;
  if(wxReduced()){
    wxDayIdx = wxDayIdx % items.length;
    track.textContent = mark + items[wxDayIdx];
    btn.classList.add("static");
  }else{
    btn.classList.remove("static");
    const one = mark + items.join("　　│　　") + "　　│　　";
    track.textContent = one + one;                  // 同じものを2つつなげて、切れ目なく左へ流す
    const half = track.scrollWidth / 2;
    btn.style.setProperty("--wx-dur", (half > 0 ? Math.max(12, half / 30) : 20) + "s");   // 約30ピクセル/秒
  }
}
function wxRecordDaily(d){
  try{
    const day = getToday();
    const all = JSON.parse(localStorage.getItem(WX_DAILY_KEY) || "{}");
    if(all[day]) return;                          // その日の最初に取れたものを残す
    const tm = wxTemps(d, Date.now());
    all[day] = { text: d.weathers[0] || "", max: tm.max != null ? tm.max : null, min: tm.min != null ? tm.min : null, area: d.areaName, at: d.fetchedAt };
    localStorage.setItem(WX_DAILY_KEY, JSON.stringify(all));
  }catch(e){ /* 記録できなくても、表示は続ける */ }
}
function wxPosition(){
  return new Promise(resolve => {
    if(!navigator.geolocation){ resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat:p.coords.latitude, lng:p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy:false, timeout:8000, maximumAge:1800000 });
  });
}
let wxBusy = false;
async function refreshWeather(force){
  if(wxBusy) return;
  wxBusy = true;
  try{
    const cache = wxLoad();
    if(!force && cache && Date.now() - Date.parse(cache.fetchedAt) < 30 * 60 * 1000){ wxRender(); return; }
    const pos = await wxPosition();
    let area = null, lat = 43.06, lng = 141.35;
    if(pos){ lat = pos.lat; lng = pos.lng; area = wxNearest(lat, lng); }
    else if(cache){ area = WX_AREAS.find(a => a.name === cache.areaName) || null; if(area){ lat = area.lat; lng = area.lng; } }
    if(!area){ wxRender(); return; }
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => { if(ctl) ctl.abort(); }, 8000);
    try{
      const res = await fetch(WX_URL(area.office), ctl ? { signal: ctl.signal, cache:"no-store" } : { cache:"no-store" });
      if(!res.ok) throw new Error("http " + res.status);
      const d = wxParse(await res.json(), area, lat, lng);
      localStorage.setItem(WX_KEY, JSON.stringify(d));
      wxRecordDaily(d);
    }catch(e){ /* 電波がない・取れないときは、最後に取れた内容のまま */ }
    finally{ clearTimeout(timer); }
    wxRender();
  }finally{ wxBusy = false; }
}
window.ctRefreshWeather = refreshWeather;

const wxSheet = document.createElement("div");
wxSheet.className = "ct-wxsheet";
wxSheet.id = "ctWxSheet";
wxSheet.hidden = true;
document.body.appendChild(wxSheet);
function wxShowSheet(){
  const d = wxLoad();
  if(!d){ return; }
  const now = Date.now(), days = wxDays(d, now), p = wxPops(d, now), tm = days[0];
  const hm = iso => { const x = new Date(iso); return isNaN(x.getTime()) ? "" : `${x.getMonth() + 1}/${x.getDate()} ${String(x.getHours()).padStart(2,"0")}:${String(x.getMinutes()).padStart(2,"0")}`; };
  const row = (a, b) => `<div class="wx-row"><span>${escapeHtml(a)}</span><span>${escapeHtml(b)}</span></div>`;
  const sub = day => `${day.max != null ? "最高 " + day.max + "℃" : ""}${day.min != null ? "　最低 " + day.min + "℃" : ""}${day.pop != null ? "　降水 " + day.pop + "%" : ""}`.trim();
  wxSheet.innerHTML = `<h3>天気(気象庁) ${escapeHtml(d.areaName)}</h3>` +
    row("今日", days[0].text || "") +
    row("気温", `${tm.max != null ? "最高 " + tm.max + "℃" : ""}${tm.min != null ? "　最低 " + tm.min + "℃" : ""}${d.tempName ? "(" + d.tempName + ")" : ""}`) +
    row("降水確率", p.map(x => `${x.label} ${x.v}%`).join("　")) +
    row("明日", `${days[1].text || ""}${sub(days[1]) ? "　" + sub(days[1]) : ""}`) +
    row("明後日", `${days[2].text || ""}${sub(days[2]) ? "　" + sub(days[2]) : ""}`) +
    `<div class="wx-note">発表 ${escapeHtml(hm(d.report))}　取得 ${escapeHtml(hm(d.fetchedAt))}　出典: 気象庁ホームページ(予報区ごとの予報で、地点の天気とは異なる場合があります。明後日は週間予報から補うため、天気は短い言葉です)</div>` +
    `<div class="wx-btns"><button type="button" class="btn btn-outline-mint" id="wxRefresh">更新</button><button type="button" class="btn btn-mint" id="wxClose">閉じる</button></div>`;
  wxSheet.hidden = false;
}
wxSheet.addEventListener("click", e => {
  if(e.target.closest("#wxClose")){ wxSheet.hidden = true; return; }
  if(e.target.closest("#wxRefresh")){ refreshWeather(true).then(() => { if(!wxSheet.hidden) wxShowSheet(); }); }
});
document.addEventListener("pointerdown", e => { if(!wxSheet.hidden && !e.target.closest("#ctWxSheet") && !e.target.closest("#ctWx")) wxSheet.hidden = true; });
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible") refreshWeather(false); });
window.addEventListener("online", () => refreshWeather(true));

const nativeConfirm = window.confirm.bind(window);
window.confirm = function(m){ return nativeConfirm(String(m).replace(/客先名リスト/g, "顧客リスト").replace(/営業所キー/g, "担当キー")); };
const origSetMasterMessage = window.setMasterMessage;
if(typeof origSetMasterMessage === "function"){
  window.setMasterMessage = function(text, isError){
    origSetMasterMessage(String(text).replace(/営業所キー/g, "担当キー").replace(/この営業所/g, "この担当"), isError);
  };
}
const origRenderTodoList = window.renderTodoList;
function normalizeTodoHeads(){
  document.querySelectorAll(".todo-list-target h2 span:first-child").forEach(sp => {
    if(sp.textContent === "TODOリスト") sp.textContent = "ToDoリスト";
  });
}
if(typeof origRenderTodoList === "function"){
  window.renderTodoList = function(){ origRenderTodoList(); normalizeTodoHeads(); renderDoneTodos(); };
}
normalizeTodoHeads();

/* ---------- 車両タブ：終了したToDoリスト。チェックを外すと、実行中へ戻る ---------- */
const doneBox = document.createElement("div");
doneBox.id = "doneTodoBox";
doneBox.hidden = true;
const vehScreen = $("vehicleScreen");
if(vehScreen) vehScreen.appendChild(doneBox);
let doneLimit = 20;

function renderDoneTodos(){
  const box = $("doneTodoBox");
  if(!box) return;
  const done = todoItems.filter(t => t && t.done)
    .sort((a, b) => (b.completedAt || b.createdAt || "").localeCompare(a.completedAt || a.createdAt || ""));
  box.hidden = done.length === 0;
  box.innerHTML = "";
  if(done.length === 0) return;
  const h = document.createElement("h2");
  h.className = "h2-flex";
  h.innerHTML = '<span>終了したToDoリスト</span><span class="h2-note">チェックを外すと戻る</span>';
  box.appendChild(h);
  done.slice(0, doneLimit).forEach(t => {
    const md = typeof formatMonthDay === "function" ? formatMonthDay(t.date) : "";
    const suffix = typeof formatDoneSuffix === "function" ? formatDoneSuffix(t.completedAt) : "(済)";
    const text = `${md}　${t.target ? t.target + "　" : ""}${t.content || ""}`;
    const div = document.createElement("div");
    div.className = "todo-item done-item";
    div.setAttribute("data-id", t.id);
    div.innerHTML = `<label><input type="checkbox" class="todo-undo" data-id="${escapeHtml(t.id)}" checked>` +
      `<span class="todo-line"><span class="line-done">${escapeHtml(text)}</span><span class="done-suffix">${escapeHtml(suffix)}</span></span></label>`;
    box.appendChild(div);
  });
  if(done.length > doneLimit){
    const more = document.createElement("button");
    more.type = "button";
    more.className = "btn btn-outline-mint";
    more.id = "doneMore";
    more.textContent = `さらに表示(残り ${done.length - doneLimit}件)`;
    box.appendChild(more);
  }
}

doneBox.addEventListener("change", e => {
  const cb = e.target.closest(".todo-undo");
  if(!cb || cb.checked) return;
  const item = todoItems.find(t => t.id === cb.getAttribute("data-id"));
  if(!item) return;
  item.done = false;                    // 実行中へ戻す(並びの番号 order はそのまま＝元の位置に戻る)
  delete item.completedAt;
  if(typeof saveTodos === "function") saveTodos(); else localStorage.setItem("todoItems", JSON.stringify(todoItems));
  if(typeof renderTodoList === "function") renderTodoList(); else renderDoneTodos();
  if(typeof renderReportScreen === "function") renderReportScreen();   // 日報の「内容」の赤線と「(済)」も消える
  showToast("ToDoリストに戻しました");
});
doneBox.addEventListener("click", e => {
  if(e.target.closest("#doneMore")){ doneLimit += 20; renderDoneTodos(); }
});
renderDoneTodos();

/* ---------- 訪問入力：面談者の欄を狭く、敬称の欄を広く／敬称に「係長」を足す ---------- */
(function widenTitle(){
  const tf = $("meetingPersonTitle") && $("meetingPersonTitle").closest(".field");
  const pf = $("meetingPerson") && $("meetingPerson").closest(".field");
  if(tf) tf.classList.add("ct-title-field");
  if(pf) pf.classList.add("ct-person-field");
  const dd = $("honorificDropdown"), inp = $("meetingPersonTitle");
  if(dd && inp && ![...dd.querySelectorAll(".honorific-option")].some(b => b.textContent === "係長")){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "honorific-option";
    btn.textContent = "係長";
    btn.addEventListener("mousedown", e => e.preventDefault());
    btn.addEventListener("click", () => { inp.value = "係長"; dd.classList.remove("show"); });
    dd.appendChild(btn);
    if(typeof HONORIFIC_OPTIONS !== "undefined" && Array.isArray(HONORIFIC_OPTIONS) && !HONORIFIC_OPTIONS.includes("係長")) HONORIFIC_OPTIONS.push("係長");
  }
})();

/* ---------- 顧客の管理の画面 ---------- */
const custSection = document.createElement("section");
custSection.id = "custScreen";
custSection.className = "screen";
custSection.innerHTML = `
  <div class="cm-top"><button type="button" class="btn-mini" id="cmBack">← データ</button><h2>顧客の管理</h2></div>
  <div class="cm-note" id="cmHiddenNote"></div>
  <div class="ct-seg" id="cmTabs">
    <button type="button" data-tab="all"></button>
    <button type="button" data-tab="show"></button>
    <button type="button" data-tab="hide"></button>
  </div>
  <div class="card" style="margin-top:10px;">
    <input type="text" id="cmSearch" placeholder="顧客名・読み仮名・コードで検索" autocomplete="off">
    <div class="kana-grid" id="cmKana" style="margin-top:8px;"></div>
    <div class="cm-tools">
      <button type="button" class="cm-mini" id="cmHideAll">絞り込んだ分を全て非表示</button>
      <button type="button" class="cm-mini" id="cmShowAll">絞り込んだ分を全て表示に戻す</button>
      <span class="cm-count" id="cmCount"></span>
    </div>
    <div class="cm-head"><span>顧客</span><span>非表示にする</span></div>
    <div id="cmList"></div>
    <button type="button" class="btn btn-outline-mint" id="cmMore" style="margin-top:10px;" hidden>さらに表示</button>
  </div>
  <div class="card" id="cmAddCard">
    <div class="dt-title" id="cmAddTitle" style="font-size:15px;font-weight:700;margin-bottom:8px;">顧客を追加</div>
    <div class="cm-tools" style="display:block;">
      <input type="text" id="cmAddName" placeholder="顧客名" autocomplete="off" style="margin-bottom:8px;">
      <input type="text" id="cmAddKana" placeholder="読み仮名(省略可)" autocomplete="off" style="margin-bottom:8px;">
      <input type="text" id="cmAddCode" placeholder="顧客コード(省略可)" autocomplete="off" style="margin-bottom:8px;">
    </div>
    <button type="button" class="btn btn-mint" id="cmAddBtn">追加</button>
    <button type="button" class="btn btn-outline-mint" id="cmAddCancel" style="margin-top:8px;" hidden>やめる</button>
  </div>
`;
document.querySelector("main").appendChild(custSection);

let cmTab = "all", cmKana = null, cmLimit = 100, cmEditId = null;

function cmItems(){
  let items = allCustomers();
  if(cmTab === "show") items = items.filter(i => !custHidden.has(custKey(i)));
  else if(cmTab === "hide") items = items.filter(i => custHidden.has(custKey(i)));
  const q = $("cmSearch").value;
  if(q.trim()){
    const nq = normQ(q), hq = hira(q);
    items = items.filter(i => normQ(i.n).includes(nq) || (i.k && hira(i.k).includes(hq)) || (i.c && normQ(i.c).includes(nq)));
  }
  if(cmKana) items = items.filter(i => kanaRowOf(i.k) === cmKana);
  items.sort((a, b) => hira(a.k || a.n).localeCompare(hira(b.k || b.n), "ja") || a.n.localeCompare(b.n, "ja"));
  return items;
}

function updateCustCounts(){
  const all = allCustomers();
  const hid = all.filter(i => custHidden.has(custKey(i))).length;
  const tabs = $("cmTabs").querySelectorAll("button");
  tabs[0].textContent = `すべて ${all.length}`;
  tabs[1].textContent = `表示中 ${all.length - hid}`;
  tabs[2].textContent = `非表示 ${hid}`;
  tabs.forEach(b => { b.className = (b.getAttribute("data-tab") === cmTab) ? "on" : ""; });
  $("cmHiddenNote").textContent = `非表示 ${hid}件`;
}

function renderCust(){
  updateCustCounts();
  const grid = $("cmKana");
  grid.innerHTML = "";
  [...KANA_ROWS.map(r => r[0]), "他"].forEach(row => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kana-btn" + (row === cmKana ? " active" : "");
    b.textContent = row;
    b.addEventListener("click", () => { cmKana = (cmKana === row) ? null : row; cmLimit = 100; renderCust(); });
    grid.appendChild(b);
  });

  const items = cmItems();
  $("cmCount").textContent = `${items.length}件`;
  const list = $("cmList");
  list.innerHTML = "";
  if(items.length === 0){
    const e = document.createElement("div");
    e.className = "empty";
    e.textContent = cmTab === "hide" ? "非表示の顧客はありません" : "該当する顧客はありません";
    list.appendChild(e);
  }
  items.slice(0, cmLimit).forEach(i => {
    const key = custKey(i);
    const hidden = custHidden.has(key);
    const row = document.createElement("div");
    row.className = "cm-row" + (hidden ? " is-hidden" : "");
    row.innerHTML = `<span class="cm-name">${escapeHtml(i.n)}</span>` +
      (i.x ? '<span class="cm-tag">追加</span>' : "") +
      (i.c ? `<span class="cm-code">${escapeHtml(i.c)}</span>` : "") +
      (i.x ? `<button type="button" class="cm-mini" data-act="edit" data-id="${escapeHtml(i.id)}">直す</button><button type="button" class="cm-mini" data-act="del" data-id="${escapeHtml(i.id)}">消す</button>` : "") +
      `<label class="cm-chk"><input type="checkbox" data-key="${encodeURIComponent(key)}"${hidden ? " checked" : ""}><span>非表示</span></label>`;
    list.appendChild(row);
  });
  $("cmMore").hidden = items.length <= cmLimit;
  $("cmMore").textContent = `さらに表示(残り ${Math.max(0, items.length - cmLimit)}件)`;
}

function cmResetAddForm(){
  cmEditId = null;
  $("cmAddName").value = ""; $("cmAddKana").value = ""; $("cmAddCode").value = "";
  $("cmAddTitle").textContent = "顧客を追加";
  $("cmAddBtn").textContent = "追加";
  $("cmAddCancel").hidden = true;
}

// 保存して、ホーム・容器の顧客選択に反映する(一覧の作り直しはしない)
function applyCustomers(){
  saveCust();
  if(typeof window.renderMasterUI === "function") window.renderMasterUI(); else applyMasterOverlay();
}
function refreshCustomers(){ applyCustomers(); renderCust(); }

function goToCust(){
  cmTab = "all"; cmLimit = 100;
  renderCust();
  showScreen("cust");
  updateNav("data");
}

$("cmTabs").addEventListener("click", e => {
  const b = e.target.closest("button");
  if(!b) return;
  cmTab = b.getAttribute("data-tab");
  cmLimit = 100;
  renderCust();
});
$("cmSearch").addEventListener("input", () => { cmLimit = 100; renderCust(); });
$("cmMore").addEventListener("click", () => { cmLimit += 100; renderCust(); });

// 「非表示」のチェック：付けるとすぐ非表示、外すとすぐ表示に戻る
$("cmList").addEventListener("change", e => {
  const cb = e.target.closest('input[type="checkbox"]');
  if(!cb) return;
  const key = decodeURIComponent(cb.getAttribute("data-key"));
  if(cb.checked) custHidden.add(key); else custHidden.delete(key);
  applyCustomers();
  if(cmTab === "all"){
    cb.closest(".cm-row").classList.toggle("is-hidden", cb.checked);   // 一覧に残したまま、灰色＋取り消し線にする
    updateCustCounts();
  }else{
    renderCust();                                                       // 「表示中」「非表示」の絞り込み中は、一覧から外れる
  }
});

// 絞り込んだ分を、まとめて非表示／表示に戻す
function cmBulk(hide){
  const target = cmItems().filter(i => custHidden.has(custKey(i)) !== hide);
  if(target.length === 0){ showToast(hide ? "非表示にする顧客はありません" : "表示に戻す顧客はありません"); return; }
  if(!window.confirm(`絞り込んだ ${target.length}件を${hide ? "非表示にします" : "表示に戻します"}。\n\nよろしいですか?`)) return;
  target.forEach(i => { if(hide) custHidden.add(custKey(i)); else custHidden.delete(custKey(i)); });
  refreshCustomers();
  showToast(`${target.length}件を${hide ? "非表示にしました" : "表示に戻しました"}`);
}
$("cmHideAll").addEventListener("click", () => cmBulk(true));
$("cmShowAll").addEventListener("click", () => cmBulk(false));

$("cmList").addEventListener("click", e => {
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;
  const id = btn.getAttribute("data-id");
  const ex = custExtra.find(x => x.id === id);
  if(!ex) return;
  if(btn.getAttribute("data-act") === "edit"){
    cmEditId = id;
    $("cmAddName").value = ex.n; $("cmAddKana").value = ex.k || ""; $("cmAddCode").value = ex.c || "";
    $("cmAddTitle").textContent = "追加した顧客を直す";
    $("cmAddBtn").textContent = "更新";
    $("cmAddCancel").hidden = false;
    const card = $("cmAddCard");
    if(card.scrollIntoView) card.scrollIntoView({ block:"center" });
  }else{
    if(!window.confirm(`「${ex.n}」を削除します。\n\n戻せません。削除しますか?`)) return;
    custHidden.delete(custKey(ex));
    custExtra = custExtra.filter(x => x.id !== id);
    if(cmEditId === id) cmResetAddForm();
    refreshCustomers();
    showToast("削除しました");
  }
});
$("cmAddBtn").addEventListener("click", () => {
  const n = $("cmAddName").value.trim();
  const k = $("cmAddKana").value.trim();
  const c = nfkc($("cmAddCode").value).trim();
  if(!n){ showToast("顧客名を入力してください"); $("cmAddName").focus(); return; }
  if(c && allCustomers().some(i => i.c === c && !(cmEditId && i.id === cmEditId))){ showToast("この顧客コードは登録済みです"); $("cmAddCode").focus(); return; }
  if(cmEditId){
    const ex = custExtra.find(x => x.id === cmEditId);
    if(ex){
      const oldKey = custKey(ex);
      ex.n = n; ex.k = k; ex.c = c;
      if(custHidden.has(oldKey) && oldKey !== custKey(ex)){ custHidden.delete(oldKey); custHidden.add(custKey(ex)); }
    }
    showToast("更新しました");
  }else{
    custExtra.push({ id:newId(), n, k, c });
    showToast("追加しました");
  }
  cmResetAddForm();
  refreshCustomers();
});
$("cmAddCancel").addEventListener("click", cmResetAddForm);
$("cmBack").addEventListener("click", () => goToData());
$("dtCustManage").addEventListener("click", goToCust);

// 起動時：非表示・追加を反映した「見える分」の顧客リストにする
applyMasterOverlay();
if(typeof window.renderMasterUI === "function") window.renderMasterUI();

/* ---------- 訪問入力・車両情報：一画面に収める ---------- */
(function layoutHostScreens(){
  const vs = $("vehicleScreen");
  if(vs){
    const h2 = [...vs.children].find(e => e.tagName === "H2");
    const pill = $("vehicleStatusPill");
    if(h2 && pill){ h2.classList.add("ct-h2-inline"); h2.appendChild(pill); }      // 「帰社」「帰社済み」を、見出しの右横へ
    const lab = $("vehicleModeLabel");
    if(lab && lab.parentNode) lab.parentNode.style.display = "none";
  }
})();

// 「内容」「特記事項」：最初は1行分。入力して足りなくなるところで、1行分だけ高くする。
// 文字を消しても、高さは戻さない(入力中に動かないように)。画面を開いたときだけ高さを決め直す
let visitMax = { c:9999, n:9999 };
function borderV(ta){
  const cs = window.getComputedStyle(ta);
  return (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
}
function growTA(ta, maxH){
  const cur = ta.offsetHeight;
  ta.style.height = "1px";
  const need = ta.scrollHeight + borderV(ta);
  ta.style.height = Math.min(maxH, Math.max(cur, need)) + "px";
}
function rowsHeight(ta, rows){                                         // 指定した行数ぶんの高さ
  const cs = window.getComputedStyle(ta);
  const fs = parseFloat(cs.fontSize) || 15;
  const lhRaw = parseFloat(cs.lineHeight);
  const lh = /px\s*$/.test(String(cs.lineHeight)) ? lhRaw : (lhRaw > 0 ? lhRaw * fs : fs * 1.45);   // 「1.45」のような倍率も、px も扱う
  const pad = (parseFloat(cs.paddingTop) || 8) + (parseFloat(cs.paddingBottom) || 8) + borderV(ta);
  return lh * rows + pad;
}
function fitVisitScreen(){
  const ta = $("meetingContent"), notes = $("meetingNotes"), card = $("meetingCard"), end = $("endButton"), vs = $("visitScreen");
  if(!ta || !notes || !card || !end || !vs || !vs.classList.contains("active") || card.style.display === "none") return;
  ta.style.height = "1px"; notes.style.height = "1px";
  const hc = ta.scrollHeight + borderV(ta), hn = notes.scrollHeight + borderV(notes);   // 空の欄の、1行分の高さ
  ta.style.height = hc + "px"; notes.style.height = hn + "px";
  visitMax = { c: Math.max(hc, rowsHeight(ta, 10)), n: Math.max(hn, rowsHeight(notes, 10)) };   // 広がるのは10行まで(それを超えると、欄の中でスクロール)
  growTA(ta, visitMax.c);                                             // 編集のときは、すでにある文字に合わせる
  growTA(notes, visitMax.n);
}
if($("meetingContent")) $("meetingContent").addEventListener("input", () => growTA($("meetingContent"), visitMax.c));
if($("meetingNotes")) $("meetingNotes").addEventListener("input", () => growTA($("meetingNotes"), visitMax.n));
const origGoToVisit = window.goToVisit;
if(typeof origGoToVisit === "function"){
  window.goToVisit = function(){ origGoToVisit(); fitVisitScreen(); };
}

// 「送信済み」の印と件数
function vehDays(){
  if(typeof vehicleHasData !== "function") return [];
  return Object.keys(dailyVehicleInfo).filter(d => vehicleHasData(dailyVehicleInfo[d]));
}
function vehSendable(d){            // 帰社まで終わった日、または過去の日だけを、送信済みにできる
  const v = dailyVehicleInfo[d];
  return !!(v && ((v.return && v.return.time) || d < getToday()));
}
function dataCounts(){
  const days = vehDays();
  return {
    visits: meetingLogs.length,
    visitsUnsent: meetingLogs.filter(l => !l.sentAt).length,
    vehDays: days.length,
    vehUnsent: days.filter(d => !dailyVehicleInfo[d].sentAt).length,
    vehMarkable: days.filter(d => !dailyVehicleInfo[d].sentAt && vehSendable(d)).length,
    ct: ctLogs.length,
    ctUnsent: ctLogs.filter(l => !l.sentAt).length,
    todoPending: todoItems.filter(t => !t.done).length,
    todoDone: todoItems.filter(t => t.done).length
  };
}
function persistReport(){
  if(typeof saveLogs === "function") saveLogs(); else localStorage.setItem("meetingLogs", JSON.stringify(meetingLogs));
  if(typeof saveVehicle === "function") saveVehicle(); else localStorage.setItem("dailyVehicleInfo", JSON.stringify(dailyVehicleInfo));
}

function renderData(){
  const c = dataCounts();
  $("dtChipV").textContent = `訪問 ${c.visitsUnsent}`;
  $("dtChipD").textContent = `車両 ${c.vehUnsent}`;
  $("dtChipC").textContent = `容器 ${c.ctUnsent}`;
  $("dtMailCsvDesc").textContent = `未送信 ${c.ctUnsent}本`;
  $("dtCsvDesc").textContent = `全件 ${c.ct}本を保存`;
  const last = localStorage.getItem("lastBackupAt");
  const el = $("dtLastBackup");
  if(last){
    const d = new Date(last);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    el.textContent = `最後の保存：${fmtDateWeek(ds)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    el.className = "dt-state";
  }else{
    el.textContent = "まだ保存していません";
    el.className = "dt-state warn";
  }
  const sv = c.visits - c.visitsUnsent, sd = c.vehDays - c.vehUnsent, sc = c.ct - c.ctUnsent;
  $("dtDelSentDesc").textContent = `訪問 ${sv}・車両 ${sd}・容器 ${sc}`;
  $("dtDelSent").disabled = (sv + sd + sc) === 0;
  $("dtDelReportDesc").textContent = `訪問 ${c.visits}・車両 ${c.vehDays}`;
  $("dtDelContainerDesc").textContent = `${c.ct}本(未送信 ${c.ctUnsent})`;
  $("dtDelTodoDesc").textContent = `未完了 ${c.todoPending}・完了 ${c.todoDone}`;
}

// 「消す」の枠は、見出しをタップして開く（押し間違い防止。画面を開くたびに閉じる）
function setDelOpen(open){
  $("dtDelBody").hidden = !open;
  $("dtDelHead").setAttribute("aria-expanded", open ? "true" : "false");
  $("dtCaret").textContent = open ? "▼" : "▶";
}
$("dtDelHead").addEventListener("click", () => setDelOpen($("dtDelBody").hidden));

function markAllSent(){
  const c = dataCounts();
  if(c.visitsUnsent + c.vehMarkable + c.ctUnsent === 0){ showToast("未送信はありません"); return; }
  if(!window.confirm(`未送信(訪問 ${c.visitsUnsent}・車両 ${c.vehMarkable}・容器 ${c.ctUnsent})を\n送信済みにします。次回から送りません。\n\nよろしいですか?`)) return;
  const now = new Date().toISOString();
  meetingLogs.forEach(l => { if(!l.sentAt) l.sentAt = now; });
  vehDays().forEach(d => { if(!dailyVehicleInfo[d].sentAt && vehSendable(d)) dailyVehicleInfo[d].sentAt = now; });
  ctLogs.forEach(l => { if(!l.sentAt) l.sentAt = now; });
  persistReport();
  ctSave();
  renderList();
  renderData();
  showToast("送信済みにしました");
}

function afterDelete(msg){
  cancelEdit();
  renderList();
  renderData();
  showToast(msg);
}

function delSentOnly(){
  const c = dataCounts();
  const sv = c.visits - c.visitsUnsent, sd = c.vehDays - c.vehUnsent, sc = c.ct - c.ctUnsent;
  if(sv + sd + sc === 0){ showToast("送信済みはありません"); return; }
  if(!window.confirm(`送信済み(訪問 ${sv}・車両 ${sd}・容器 ${sc})を削除します。\n未送信は残ります。\n\n戻せません。削除しますか?`)) return;
  meetingLogs = meetingLogs.filter(l => !l.sentAt);
  Object.keys(dailyVehicleInfo).forEach(d => { if(dailyVehicleInfo[d] && dailyVehicleInfo[d].sentAt) delete dailyVehicleInfo[d]; });
  ctLogs = ctLogs.filter(l => !l.sentAt);
  persistReport();
  ctSave();
  afterDelete("送信済みを削除しました");
}

function delReportVehicle(){
  const c = dataCounts();
  if(c.visits + c.vehDays === 0){ showToast("日報・車両はありません"); return; }
  if(!window.confirm(`訪問 ${c.visits}・車両 ${c.vehDays}を削除します。\n(未送信:訪問 ${c.visitsUnsent}・車両 ${c.vehUnsent})\n\n戻せません。削除しますか?`)) return;
  localStorage.removeItem("meetingLogs");
  localStorage.removeItem("dailyVehicleInfo");
  meetingLogs = [];
  dailyVehicleInfo = {};
  currentVisit = null;
  afterDelete("日報・車両を削除しました");
}

function delContainer(){
  const c = dataCounts();
  if(c.ct === 0){ showToast("容器はありません"); return; }
  if(!window.confirm(`容器 ${c.ct}本を削除します。\n(未送信 ${c.ctUnsent}本)\n\n戻せません。削除しますか?`)) return;
  ctLogs = [];
  ctSave();
  afterDelete("容器を削除しました");
}

function delTodo(){
  const c = dataCounts();
  if(c.todoPending + c.todoDone === 0){ showToast("ToDoリストはありません"); return; }
  if(!window.confirm(`ToDoリスト(未完了 ${c.todoPending}・完了 ${c.todoDone})を削除します。\n\n戻せません。削除しますか?`)) return;
  localStorage.removeItem("todoItems");
  todoItems = [];
  afterDelete("ToDoリストを削除しました");
}

$("dtMailReport").addEventListener("click", () => { const b = $("mailButton"); if(b) b.click(); });
$("dtMailCsv").addEventListener("click", mailContainerCsv);
$("dtCsv").addEventListener("click", async () => {
  if(ctLogs.length === 0){ showToast("容器がありません"); return; }
  await saveFile(`容器ログ全件_${getToday().replace(/-/g,"")}.csv`, csvText(ctLogs), "text/csv", true);
});
$("dtMarkSent").addEventListener("click", markAllSent);
$("dtBackup").addEventListener("click", backupExport);
$("dtRestore").addEventListener("click", () => backupFile.click());
$("dtDelSent").addEventListener("click", delSentOnly);
$("dtDelReport").addEventListener("click", delReportVehicle);
$("dtDelContainer").addEventListener("click", delContainer);
$("dtDelTodo").addEventListener("click", delTodo);

// オフライン保存の注意(保存できていないときだけ出る)は、ホームの下に置く
(function(){
  const status = document.createElement("div");
  status.className = "ct-status ct-offline-status";
  $("reportScreen").appendChild(status);
})();

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

/* ホーム画面に追加するための設定(index.html に書いてあれば何もしません) */
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
   ナビゲーション(ヘッダーに「容器」ボタンを追加)
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
  const left = document.createElement("div");
  left.className = "ct-dleft";
  const l1 = document.createElement("div");
  l1.className = "ct-dline1";
  l1.appendChild(dateEl);
  const wx = document.createElement("button");     // 今日〜明後日の天気が、左へ流れる掲示
  wx.type = "button";
  wx.id = "ctWx";
  wx.className = "ct-wx";
  wx.hidden = true;
  const track = document.createElement("span");
  track.className = "ct-wxtrack";
  wx.appendChild(track);
  left.appendChild(l1);
  left.appendChild(wx);
  const sub = document.createElement("div");       // 右端に2行
  sub.className = "ct-bcpsub";
  sub.innerHTML = "BCP用<br>オフライン使用可";
  box.appendChild(left);
  box.appendChild(sub);

  let pressTimer = null, longPressed = false;
  wx.addEventListener("pointerdown", () => {       // 触れている間は、流れが止まる
    wx.classList.add("paused");
    longPressed = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { if(wxReduced()){ longPressed = true; wxShowSheet(); } }, 500);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => wx.addEventListener(t, () => { wx.classList.remove("paused"); clearTimeout(pressTimer); }));
  wx.addEventListener("click", () => {
    if(wxReduced()){                                // 「動きを減らす」: 流さず1日分。タップで日が替わり、長押しで詳細
      if(longPressed){ longPressed = false; return; }
      wxDayIdx++;
      wxRender();
      return;
    }
    if(wxSheet.hidden) wxShowSheet(); else wxSheet.hidden = true;
  });
  wxRender();                                       // 保存してある天気をすぐ出し、少し待ってから、最新を取りに行く
  setTimeout(() => refreshWeather(false), 800);
}

const navBtn = document.createElement("button");
navBtn.className = "nav-btn";
navBtn.id = "navContainerButton";
navBtn.textContent = "容器";
$("navVehicleButton").insertAdjacentElement("afterend", navBtn);

const navData = document.createElement("button");
navData.className = "nav-btn";
navData.id = "navDataButton";
navData.textContent = "データ";
navBtn.insertAdjacentElement("afterend", navData);

const origUpdateNav = window.updateNav;
window.updateNav = function(name){
  origUpdateNav(name);
  const isContainer = (name === "container");
  const isData = (name === "data");
  if(isContainer || isData){
    $("navHomeButton").classList.remove("active-mint");
    $("navVehicleButton").classList.remove("active-peach");
  }
  navBtn.classList.toggle("active-sky", isContainer);
  navData.classList.toggle("active-lav", isData);
};

function renderContainer(){
  if(!ctDateTouched && !ctEditId) setDate(getToday());
  renderModeAndUnit();
  renderGasChips();
  renderKana();
  renderFilter();
  renderList();
}

function goToData(){
  vehicleViewMode = null;
  setDelOpen(false);
  renderData();
  showScreen("data");
  updateNav("data");
}

function goToContainer(strong){
  vehicleViewMode = null;
  fillContainerCustomer(strong);
  renderContainer();
  showScreen("container");
  updateNav("container");
}

/* ---------- ホームで作業した顧客名を控える ---------- */
if($("homeVisitTarget")){
  $("homeVisitTarget").addEventListener("input", () => trackCustomer($("homeVisitTarget").value));
  $("homeVisitTarget").addEventListener("change", () => trackCustomer($("homeVisitTarget").value));
}
if($("homeStartButton")) $("homeStartButton").addEventListener("click", () => trackCustomer($("homeVisitTarget") ? $("homeVisitTarget").value : ""));
if($("endButton")) $("endButton").addEventListener("click", () => trackCustomer($("visitTarget") ? $("visitTarget").value : ""));

/* ---------- 車両の走行距離の初期値 ---------- */
function prevDayKey(key){
  const p = String(key).split("-").map(Number);
  const t = new Date(p[0], p[1] - 1, p[2] - 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
}
// 出発の初期値：前日の「帰社」の距離。なければ、これまでの距離(出発・帰社)のうち、いちばん大きい値。どちらもなければ空欄
window.getLatestPastReturnDistance = function(excludeDate){
  const info = dailyVehicleInfo;
  const prev = info[prevDayKey(excludeDate)];
  const pr = prev && prev.return ? prev.return.distance : "";
  if(pr !== "" && pr != null && isFinite(parseFloat(pr))) return pr;
  let max = null;
  Object.keys(info).forEach(k => {
    if(k === excludeDate) return;
    const v = info[k] || {};
    [v.departure && v.departure.distance, v.return && v.return.distance].forEach(x => {
      const n = parseFloat(x);
      if(isFinite(n) && (max === null || n > max)) max = n;
    });
  });
  return max === null ? "" : String(max);
};
// 帰社の初期値：出発の距離。帰社の欄を自分で入力したあとは、上書きしない
const origRenderVehicleScreen = window.renderVehicleScreen;
if(typeof origRenderVehicleScreen === "function"){
  window.renderVehicleScreen = function(){
    try{
      const v = getTodayVehicle();
      if(v && v.departure && v.return && !v.return.time && !v.return.userEdited &&
         v.departure.distance !== "" && v.departure.distance != null){
        v.return.distance = v.departure.distance;
      }
    }catch(e){ /* 初期値を入れられなくても、画面は表示する */ }
    origRenderVehicleScreen();
  };
}
if($("vehicleDistance")){
  $("vehicleDistance").addEventListener("change", () => {
    try{
      if(vehicleViewMode === "return"){
        const v = getTodayVehicle();
        if(v && v.return && !v.return.time){ v.return.userEdited = true; saveVehicle(); }
      }
    }catch(e){ /* 記録できなくても、入力は続けられる */ }
  });
}

/* ---------- ToDoリストに追加する顧客名：会社の種類の語を除いて、先頭3文字 ---------- */
const CORP_RE = /株式会社|[(（]株[)）]|㈱|有限会社|[(（]有[)）]|㈲|合同会社|[(（]合[)）]|合資会社|合名会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|社会福祉法人|医療法人|学校法人/g;
// 北海道の市町村(全179)。「札幌市」「札幌」のどちらの形でも、名前の先頭に合えば地名として扱う
const HK_LIST = [
  "札幌市","江別市","千歳市","恵庭市","北広島市","石狩市","当別町","新篠津村",                                           // 石狩
  "函館市","北斗市","松前町","福島町","知内町","木古内町","七飯町","鹿部町","森町","八雲町","長万部町",                      // 渡島
  "江差町","上ノ国町","厚沢部町","乙部町","奥尻町","今金町","せたな町",                                                   // 檜山
  "小樽市","島牧村","寿都町","黒松内町","蘭越町","ニセコ町","真狩村","留寿都村","喜茂別町","京極町","倶知安町","共和町",
  "岩内町","泊村","神恵内村","積丹町","古平町","仁木町","余市町","赤井川村",                                              // 後志
  "夕張市","岩見沢市","美唄市","芦別市","赤平市","三笠市","滝川市","砂川市","歌志内市","深川市","南幌町","奈井江町",
  "上砂川町","由仁町","長沼町","栗山町","月形町","浦臼町","新十津川町","妹背牛町","秩父別町","雨竜町","北竜町","沼田町","幌加内町", // 空知
  "旭川市","士別市","名寄市","富良野市","鷹栖町","東神楽町","当麻町","比布町","愛別町","上川町","東川町","美瑛町",
  "上富良野町","中富良野町","南富良野町","占冠村","和寒町","剣淵町","下川町","美深町","音威子府村","中川町",               // 上川
  "留萌市","増毛町","小平町","苫前町","羽幌町","初山別村","遠別町","天塩町",                                              // 留萌
  "稚内市","猿払村","浜頓別町","中頓別町","枝幸町","豊富町","礼文町","利尻町","利尻富士町","幌延町",                      // 宗谷
  "北見市","網走市","紋別市","美幌町","津別町","斜里町","清里町","小清水町","訓子府町","置戸町","佐呂間町","遠軽町",
  "湧別町","滝上町","興部町","西興部村","雄武町","大空町",                                                                 // オホーツク
  "室蘭市","苫小牧市","登別市","伊達市","豊浦町","壮瞥町","白老町","厚真町","洞爺湖町","安平町","むかわ町",               // 胆振
  "日高町","平取町","新冠町","浦河町","様似町","えりも町","新ひだか町",                                                   // 日高
  "帯広市","音更町","士幌町","上士幌町","鹿追町","新得町","清水町","芽室町","中札内村","更別村","大樹町","広尾町",
  "幕別町","池田町","豊頃町","本別町","足寄町","陸別町","浦幌町",                                                         // 十勝
  "釧路市","釧路町","厚岸町","浜中町","標茶町","弟子屈町","鶴居村","白糠町",                                              // 釧路
  "根室市","別海町","中標津町","標津町","羅臼町"                                                                          // 根室
];
// 「北海道」と、市町村名(市町村を付けた形と、付けない形)。長いほうを先に調べる
const HK_PLACES = [...new Set([...HK_LIST, ...HK_LIST.map(n => n.slice(0, -1)), "北海道"])]
  .sort((a, b) => Array.from(b).length - Array.from(a).length);

// ToDoに出す顧客名：会社の種類の語と空白を除く。
//   ・先頭が北海道・道内の市町村名 → 地名の頭文字1文字 + 地名のあとの2文字(例: 北海道ガス → 北ガス)
//   ・それ以外 → 先頭の3文字
function shortCustomer(name){
  const src = String(name || "");
  const stripped = src.replace(CORP_RE, "").replace(/[\s\u3000]+/g, "");
  const base = stripped || src.replace(/[\s\u3000]+/g, "");
  for(const p of HK_PLACES){
    if(base.startsWith(p)){
      const rest = Array.from(base.slice(p.length));
      if(rest.length === 0) return p;                                  // 地名だけのときは、そのまま
      return Array.from(p)[0] + rest.slice(0, 2).join("");
    }
  }
  return Array.from(base).slice(0, 3).join("");
}
// この版を入れた時刻より前に追加したToDoは、そのまま(変えない)
let todoShortFrom = localStorage.getItem("todoShortFrom");
if(!todoShortFrom){
  todoShortFrom = new Date().toISOString();
  try{ localStorage.setItem("todoShortFrom", todoShortFrom); }catch(e){ /* 保存できなくても動く */ }
}
const origSaveTodos = window.saveTodos;
if(typeof origSaveTodos === "function"){
  window.saveTodos = function(){
    todoItems.forEach(t => {
      if(t && t.source === "line" && !t.shortDone && (t.createdAt || "") >= todoShortFrom){
        t.fullTarget = t.target;
        t.target = shortCustomer(t.target);
        t.shortDone = true;
      }
    });
    origSaveTodos();
  };
}

/* 入力欄の上のラベルをなくし、欄の中に表示する
   ・文字入力の欄：薄い文字(入力を始めると消える)
   ・日付・時刻・走行距離・敬称(最初から値が入る欄)：欄の左端に、消えない小さな文字 */
const INLINE_IDS = new Set(["meetingPersonTitle"]);

function halfParens(t){ return String(t).replace(/（/g, "(").replace(/）/g, ")"); }

const SHORT_LABELS = { "開始時刻":"開始", "終了時刻":"終了" };
const LABEL_RENAME = { "営業所キー":"担当キー" };            // 顧客リストの単位は「担当」   // 時刻欄の見出しは2文字に(欄を狭くする)

function makeInline(inp, lb, text){
  if(SHORT_LABELS[text]) text = SHORT_LABELS[text];
  const wrap = document.createElement("div");
  wrap.className = "ct-inwrap";
  inp.parentNode.insertBefore(wrap, inp);
  wrap.appendChild(inp);
  lb.className = "ct-inlab";
  lb.removeAttribute("style");
  lb.textContent = halfParens(text);
  wrap.insertBefore(lb, inp);
  inp.style.paddingLeft = (text.length * 11 + (inp.type === "time" ? 16 : 24)) + "px";
  inp.style.textAlign = "left";
}

// 時刻の欄：見える部分は小さな箱「開始 09:15」。iPhoneの時刻入力は、その上に透明で重ねる(押すと、これまで通り入力画面が開く)
function makeTimeBox(inp, lb, text){
  if(SHORT_LABELS[text]) text = SHORT_LABELS[text];
  const box = document.createElement("div");
  box.className = "ct-timebox";
  inp.parentNode.insertBefore(box, inp);
  const tag = document.createElement("span");
  tag.className = "ct-inlab";
  tag.textContent = halfParens(text);
  const txt = document.createElement("span");
  txt.className = "ct-timetext";
  box.appendChild(tag);
  box.appendChild(txt);
  box.appendChild(inp);
  lb.textContent = halfParens(text);
  lb.style.display = "none";
  box.appendChild(lb);
  inp.setAttribute("aria-label", halfParens(text));
  const sync = () => { txt.textContent = inp.value ? inp.value : "--:--"; };
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if(proto && proto.get && proto.set){          // 画面の外から値を入れても(編集を開くときなど)、箱の表示を更新する
    Object.defineProperty(inp, "value", { configurable:true, get(){ return proto.get.call(inp); }, set(v){ proto.set.call(inp, v); sync(); } });
  }
  inp.addEventListener("input", sync);
  inp.addEventListener("change", sync);
  sync();
}

function convertHostLabels(){
  document.querySelectorAll("label[for]").forEach(lb => {
    if(lb.closest("#containerScreen")) return;
    const inp = document.getElementById(lb.getAttribute("for"));
    if(!inp) return;
    if(inp.id === "vehicleDistance") return;     // 走行距離は、欄の上の見出し(ラベル)のまま
    let text = lb.textContent.trim();
    if(LABEL_RENAME[text]) text = LABEL_RENAME[text];
    const type = (inp.type || "").toLowerCase();
    if(type === "time"){
      makeTimeBox(inp, lb, text);
    }else if(INLINE_IDS.has(inp.id) || type === "date"){
      makeInline(inp, lb, text);
    }else if(inp.tagName === "TEXTAREA" || (inp.tagName === "INPUT" && ["text","number","password","search","tel",""].includes(type))){
      inp.placeholder = halfParens(text);
      inp.setAttribute("aria-label", halfParens(text));
      lb.style.display = "none";
    }
  });
}
convertHostLabels();
{ const t = $("ctTime"), l = document.querySelector('label[for="ctTime"]'); if(t && l) makeTimeBox(t, l, "時刻"); }

// 画面の固定の文言（見出し・ボタンなど）の括弧を半角にする。訪問履歴・TODOなど入力された内容は書き換えない
(function normalizeHostParens(){
  const skip = el => !el || el.closest("#visitList, .todo-list-target, #ctList, #customerList, script, style, textarea");
  ["reportScreen", "visitScreen", "vehicleScreen"].forEach(id => {
    const root = $(id);
    if(!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      if(skip(n.parentElement)) return;
      let v = n.nodeValue;
      if(/[（）]/.test(v)) v = halfParens(v);
      if(/TODOリスト/.test(v)) v = v.replace(/TODOリスト/g, "ToDoリスト");
      if(v !== n.nodeValue) n.nodeValue = v;
    });
    root.querySelectorAll("[placeholder]").forEach(e => { e.placeholder = halfParens(e.placeholder); });
  });
})();

// ダイヤルの案内文
document.querySelectorAll(".dial-hint").forEach(el => {
  if(/中心/.test(el.textContent)){
    el.textContent = "中心  細かい　外側 大きい";
    el.style.whiteSpace = "pre-wrap";
  }
});

navBtn.addEventListener("click", () => {
  const strong = captureHomeCustomer();         // 訪問の状態を消す前に、ホームの顧客名を控える
  if(!confirmLeaveVisitIfNeeded()) return;
  currentVisit = null;
  goToContainer(strong);
});

navData.addEventListener("click", () => {
  if(!confirmLeaveVisitIfNeeded()) return;
  currentVisit = null;
  goToData();
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
$("ctFsSeg").addEventListener("click", e => {
  const b = e.target.closest("button");
  if(!b) return;
  ctFs = b.getAttribute("data-fs");
  try{ localStorage.setItem("ctFontSize", ctFs); }catch(err){ /* 保存できなくても、この画面では切り替わる */ }
  renderList();
});
$("ctGasChips").addEventListener("scroll", updateGasShadows, { passive:true });
window.addEventListener("resize", updateGasShadows);
syncDateText();

/* 検索・日付での絞り込み(過去の記録を後から探す) */
$("ctSearch").addEventListener("input", () => {
  renderList();
  closeCombos("ctSearchList");
  renderSearchList();
  $("ctSearchList").hidden = false;
});
$("ctSearch").addEventListener("click", () => { if($("ctSearchList").hidden) toggleCombo("ctSearchList", renderSearchList); });
$("ctSearchBtn").addEventListener("click", () => toggleCombo("ctSearchList", renderSearchList));
$("ctFilterDate").addEventListener("click", () => toggleCombo("ctDateList", renderDateList));
$("ctDateBtn").addEventListener("click", () => toggleCombo("ctDateList", renderDateList));
document.addEventListener("pointerdown", e => { if(!e.target.closest(".ct-combo")) closeCombos(); });
$("ctCapacity").addEventListener("input", renderAdj);
$("ctGasOther").addEventListener("input", renderGasSelected);
$("ctSaveButton").addEventListener("click", () => saveFromForm());

/* 記号・番号・容量は、入力しながら(確定時にも)半角に直す：全角→半角、小文字→大文字 */
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
