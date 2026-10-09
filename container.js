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
const GAS_TYPES = ["酸素","アセチレン","炭酸","窒素","アルゴン","水素","ヘリウム","その他"];
const UNITS = ["㎥","kg"];

const CT_KEY = "containerLogs";
const BACKUP_KEYS = ["meetingLogs","dailyVehicleInfo","todoItems","containerLogs"];
const MAILTO_LIMIT = 50000;

/* ---------- データ ---------- */
let ctLogs = [];
try{ ctLogs = JSON.parse(localStorage.getItem(CT_KEY) || "[]"); }catch(e){ ctLogs = []; }
if(!Array.isArray(ctLogs)) ctLogs = [];

function ctSave(){ localStorage.setItem(CT_KEY, JSON.stringify(ctLogs)); }

let ctMode = "出庫";
let ctUnit = UNITS[0];
let ctFilter = "全て";
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
  .visit-card.ct-out{ border-left-color:var(--sky); }
  .visit-card.ct-in{ border-left-color:var(--peach); }

  .ct-status{ font-size:12px; color:var(--ink-soft); text-align:center; margin:10px 4px; line-height:1.6; }
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
    <div class="ct-seg" id="ctModeSeg">
      <button type="button" data-mode="出庫" class="out">出庫</button>
      <button type="button" data-mode="回収" class="in">回収</button>
    </div>
    <div style="height:14px;"></div>

    <div class="field">
      <label for="ctDate">日付</label>
      <input type="date" id="ctDate">
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
      <input type="text" id="ctGas" placeholder="ボタンで選ぶか、直接入力" style="margin-top:8px;" autocomplete="off">
    </div>

    <div class="field">
      <label for="ctCapacity">容量</label>
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="text" id="ctCapacity" inputmode="decimal" placeholder="例：7" autocomplete="off" style="flex:2;">
        <div class="ct-seg" id="ctUnitSeg" style="flex:1;"></div>
      </div>
    </div>

    <button class="btn btn-lavender" id="ctSaveButton">記録する</button>
    <div style="text-align:center;"><button class="btn-text" id="ctCancelEdit" style="display:none;">編集をやめる</button></div>
  </div>

  <h2 class="h2-flex"><span>容器ログ（<span id="ctCount">0</span>本）</span></h2>
  <div class="ct-seg" id="ctFilterSeg" style="margin-bottom:12px;">
    <button type="button" data-filter="全て">全て</button>
    <button type="button" data-filter="出庫">出庫</button>
    <button type="button" data-filter="回収">回収</button>
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
function renderModeAndUnit(){
  $("ctModeSeg").querySelectorAll("button").forEach(b => {
    b.classList.toggle("on", b.getAttribute("data-mode") === ctMode);
  });

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
  const cur = $("ctGas").value.trim();
  box.innerHTML = "";
  GAS_TYPES.forEach(t => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (t === cur ? " on" : "");
    b.textContent = t;
    b.addEventListener("click", () => {
      if(t === "その他"){
        $("ctGas").value = "";
        $("ctGas").focus();
      }else{
        $("ctGas").value = t;
      }
      renderGasChips();
    });
    box.appendChild(b);
  });
}

function renderFilter(){
  $("ctFilterSeg").querySelectorAll("button").forEach(b => {
    const f = b.getAttribute("data-filter");
    b.className = (f === ctFilter) ? ("on " + (f === "出庫" ? "out" : f === "回収" ? "in" : "")) : "";
  });
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
}

function readForm(){
  return {
    type: ctMode,
    date: $("ctDate").value,
    customer: $("ctCustomer").value.trim(),
    symbol: normSym($("ctSymbol").value),
    number: normNum($("ctNumber").value),
    gas: $("ctGas").value.trim(),
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
  if(!f.gas){ showToast("ガス種を選んでください"); return; }
  if(f.capacity !== "" && !/^\d+(\.\d+)?$/.test(f.capacity)){ showToast("容量は数字で入力してください"); $("ctCapacity").focus(); return; }

  const dup = ctLogs.find(l => l.id !== ctEditId && l.date === f.date && l.type === f.type &&
                               l.symbol === f.symbol && l.number === f.number);
  if(dup && !window.confirm(`${f.symbol}-${f.number} は同じ日に「${f.type}」で記録済みです。\nもう一度記録しますか？`)) return;

  let code = "";
  if(ctPicked && ctPicked.name === f.customer) code = ctPicked.code || "";
  else if(typeof resolveCustomerCode === "function") code = resolveCustomerCode(f.customer) || "";

  if(ctEditId){
    const log = ctLogs.find(x => x.id === ctEditId);
    if(log) Object.assign(log, f, { customerCode: code });
    ctEditId = null;
    showToast("更新しました");
  }else{
    ctLogs.push(Object.assign({ id:newId(), time:nowHM() }, f, { customerCode: code, createdAt:new Date().toISOString() }));
    showToast(`${f.type}を記録しました`);
  }
  ctSave();

  // 続けて入力しやすいよう、番号だけ消す（顧客・ガス種・容量・記号は残す）
  $("ctNumber").value = "";
  setFormEditing(false);
  renderList();
  $("ctNumber").focus();
}

function startEdit(id){
  const l = ctLogs.find(x => x.id === id);
  if(!l) return;
  ctEditId = id;
  ctMode = l.type;
  ctUnit = l.unit || UNITS[0];
  ctDateTouched = true;
  $("ctDate").value = l.date;
  $("ctCustomer").value = l.customer || "";
  ctPicked = l.customerCode ? { code:l.customerCode, name:l.customer } : null;
  $("ctSymbol").value = l.symbol || "";
  $("ctNumber").value = l.number || "";
  $("ctGas").value = l.gas || "";
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
    .filter(l => ctFilter === "全て" || l.type === ctFilter)
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
  const outByDate = {}, inByDate = {};
  logs.forEach(l => {
    const m = l.type === "出庫" ? outByDate : inByDate;
    m[l.date] = (m[l.date] || 0) + 1;
  });

  let lastDate = null;
  logs.forEach(l => {
    if(l.date !== lastDate){
      lastDate = l.date;
      const head = document.createElement("div");
      head.className = "day-header";
      head.innerHTML = `<span>${escapeHtml(formatDayLabel(l.date, todayStr))}</span>` +
                       `<span>出庫${outByDate[l.date] || 0}本・回収${inByDate[l.date] || 0}本</span>`;
      list.appendChild(head);
    }

    const cls = l.type === "出庫" ? "out" : "in";
    const card = document.createElement("div");
    card.className = "visit-card ct-" + cls;
    const capText = (l.capacity !== "" && l.capacity != null) ? `　${escapeHtml(l.capacity)}${escapeHtml(l.unit || "")}` : "";
    card.innerHTML = `
      <div class="top">
        <span class="target"><span class="ct-badge ${cls}">${escapeHtml(l.type)}</span>${escapeHtml(l.symbol)}-${escapeHtml(l.number)}</span>
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
    if(!window.confirm(`${l.symbol}-${l.number}（${l.type}）を削除しますか？`)) return;
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
const CSV_HEAD = ["日付","時刻","区分","記号","番号","顧客コード","顧客名","ガス種","容量","単位"];

function cell(v){ return String(v == null ? "" : v).replace(/[,\r\n\t"]/g, " ").trim(); }

function csvLines(logs){
  return ctSorted(logs).map(l =>
    [l.date, l.time, l.type, l.symbol, l.number, l.customerCode, l.customer, l.gas, l.capacity, l.unit].map(cell).join(","));
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
async function updateOfflineStatus(){
  const els = document.querySelectorAll(".ct-offline-status");
  if(els.length === 0) return;

  let text;
  if(location.protocol === "file:"){
    text = "📁 ファイルを直接開いています（PCでの利用です。オフライン保存の設定は不要です）";
  }else if(!("serviceWorker" in navigator) || !window.caches){
    text = "⚠ この環境ではオフライン保存を使えません";
  }else{
    let ok = false;
    try{ ok = !!(await caches.match("index.html")) || !!(await caches.match("./")); }catch(e){ ok = false; }
    text = ok
      ? "✅ オフライン保存済み（電波がなくても起動できます）"
      : "⚠ オフライン保存が未完了です。電波のある場所で、このアプリをもう一度開いてください";
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
  updateOfflineStatus();
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
$("ctModeSeg").addEventListener("click", e => {
  const b = e.target.closest("button");
  if(!b) return;
  ctMode = b.getAttribute("data-mode");
  renderModeAndUnit();
});

$("ctFilterSeg").addEventListener("click", e => {
  const b = e.target.closest("button");
  if(!b) return;
  ctFilter = b.getAttribute("data-filter");
  renderFilter();
  renderList();
});

$("ctDate").addEventListener("change", () => { ctDateTouched = true; });
$("ctGas").addEventListener("input", renderGasChips);
$("ctSaveButton").addEventListener("click", saveFromForm);
$("ctCancelEdit").addEventListener("click", cancelEdit);

updateOfflineStatus();

})();
