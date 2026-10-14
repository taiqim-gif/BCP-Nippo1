const {JSDOM}=require("jsdom");
(async()=>{
const dom=await JSDOM.fromURL("http://localhost:8765/harness3.html",{runScripts:"dangerously",resources:"usable",pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{};
let confirmAnswer=true; const confirms=[]; w.confirm=(m)=>{confirms.push(m); return confirmAnswer;};
await new Promise(r=>setTimeout(r,500));
const d=w.document,$=id=>d.getElementById(id);
let fails=0; const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m); if(!c) fails++;};
const set=(id,v)=>{$(id).value=v;};
const ev=(el,t)=>el.dispatchEvent(new w.Event(t,{bubbles:true}));
const stored=()=>JSON.parse(w.localStorage.getItem("containerLogs")||"[]");
const chip=t=>[...d.querySelectorAll("#ctGasChips .chip")].find(b=>b.textContent===t);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// 1) ヘッダーの日付
ok(/^\d{4}\/\d{1,2}\/\d{1,2}　\([日月火水木金土]\)$/.test($("dateDisplay").textContent),"header date: "+$("dateDisplay").textContent);
ok(d.querySelector("header .ct-bcpsub").textContent==="BCP用オフライン使用可","BCP text under date");

// 2) ホスト画面のラベル → 欄の中
const hidden=id=>{const l=d.querySelector(`label[for="${id}"]`);return l && l.style.display==="none";};
ok($("homeVisitTarget").placeholder==="訪問先" && hidden("homeVisitTarget"),"home: label → placeholder");
ok($("masterKeyInput").placeholder==="営業所キー" && hidden("masterKeyInput"),"master key: label → placeholder");
ok($("meetingContent").placeholder==="内容" && hidden("meetingContent") && $("meetingPerson").placeholder==="面談者","visit: textarea/text labels → placeholders");
ok($("vehicleFuel").placeholder==="給油量（L）","vehicle fuel: label → placeholder");
const inl=id=>{const e=$(id);return e.parentNode.classList.contains("ct-inwrap") && e.parentNode.querySelector("label.ct-inlab");};
ok(inl("editStartTime") && inl("editEndTime") && inl("vehicleDistance") && inl("meetingPersonTitle"),"inline labels: 開始/終了/走行距離/敬称");
ok($("meetingPersonTitle").value==="さん" && $("honorificDropdown").parentNode.classList.contains("field"),"敬称 value kept, dropdown still in field");
ok(parseInt($("editStartTime").style.paddingLeft)>40,"inline label padding set: "+$("editStartTime").style.paddingLeft);

// 3) 容器フォーム
$("navContainerButton").click();
const lab=id=>d.querySelector(`#containerScreen label[for="${id}"]`);
ok(!lab("ctCustomer") && !lab("ctCapacity"),"container: no labels for 顧客名/容量 (placeholders instead)");
ok(lab("ctSymbol") && lab("ctSymbol").textContent==="記号（英数字）" && lab("ctNumber") && lab("ctNumber").textContent==="番号（数字）","container: 記号/番号 labels restored");
ok($("ctCustomer").placeholder==="顧客名" && $("ctCapacity").placeholder==="容量" && $("ctSymbol").placeholder==="例：AB1" && $("ctNumber").placeholder==="例：12345","placeholders: 顧客名/容量, 例：AB1/例：12345");
ok($("ctSymbol").getAttribute("inputmode")==="email" && $("ctNumber").getAttribute("inputmode")==="numeric","symbol: alphabet keyboard hint / number: numeric");
ok(lab("ctNumber").parentNode===$("ctNumKb").parentNode && lab("ctNumber").parentNode.style.display==="flex","ABC button on the same row as the 番号 label");

// ガス種バー（横スライド）
const bar=$("ctGasChips");
ok(bar.classList.contains("ct-gasbar") && bar.parentNode.classList.contains("ct-gasbar-wrap"),"gas chips live in a horizontal slide bar");
const css=[...d.querySelectorAll("style")].map(s=>s.textContent).join("\n");
ok(/\.ct-gasbar\{[^}]*display:grid[^}]*overflow-x:auto/.test(css) && /\.ct-gasbar \.chip\{[^}]*flex:none/.test(css),"CSS: grid bar, horizontal scroll");
ok(/repeat\(5, max-content\)/.test(bar.getAttribute("style")||"") && bar.children.length===10,"gas bar: 10 chips in 2 rows x 5 columns (row-major): "+(bar.getAttribute("style")||""));
ok(/has-left::before|has-right::after/.test(css),"CSS: edge shadows");
ok($("ctGasVert") && !bar.contains($("ctGasVert")),"vertical selected-gas box stays outside the bar");

// 4) 日付＋曜日
set("ctDate","2026-10-09"); ev($("ctDate"),"change");
ok($("ctDateText").textContent==="2026/10/9　(金)","date text with weekday: "+$("ctDateText").textContent);
set("ctDate","2026-10-08"); ev($("ctDate"),"change");
ok($("ctDateText").textContent==="2026/10/8　(木)","date text 10/8 木");

// 5) アセチレン調整ボタン
chip("Ace").click();
const adjRow=$("ctAdjRow");
ok(adjRow.className==="ct-adj-row" && [...adjRow.querySelectorAll(".chip")].map(b=>b.textContent).join()==="−0.2,−0.1,0.0,+0.1,+0.2","Ace adj buttons in one row: "+[...adjRow.querySelectorAll(".chip")].map(b=>b.textContent).join());
[...adjRow.querySelectorAll(".chip")][3].click(); ok($("ctCapacity").value==="7.1","+0.1 → 7.1");
[...$("ctAdjRow").querySelectorAll(".chip")][0].click(); ok($("ctCapacity").value==="6.8","−0.2 → 6.8");
[...$("ctAdjRow").querySelectorAll(".chip")][2].click(); ok($("ctCapacity").value==="7","0.0 → 7 (base)");
ok([...$("ctAdjRow").querySelectorAll(".chip")][2].classList.contains("on"),"0.0 highlighted at base");

// 6) 番号に英字
set("ctCustomer","〇〇商店"); chip("O2").click(); set("ctSymbol","a"); set("ctNumber","12x");
confirmAnswer=false; confirms.length=0; $("ctSaveButton").click();
ok(stored().length===0 && /^番号に英字入力しますか？/.test(confirms[0]||""),"letters in number → asks first, 'いいえ' keeps editing: "+(confirms[0]||"").split("\n")[0]);
confirmAnswer=true; $("ctSaveButton").click();
ok(stored().length===1 && stored()[0].number==="12X","letters in number → 'はい' saves");

// 7) 複数登録 → 顧客カードの集計
const rec=(status,gas,cap,sym,num)=>{
  d.querySelector(`#ctStatusSeg button[data-status="${status}"]`).click();
  chip(gas).click(); if(cap!==null){ set("ctCapacity",cap); ev($("ctCapacity"),"input"); }
  set("ctSymbol",sym); set("ctNumber",num); $("ctSaveButton").click();
};
rec(2,"O2","7","B","1");
rec(2,"O2","7","B","2");
rec(2,"Ace","7.2","C","3");
rec(3,"O2","7","D","4");
rec(2,"フロン","","E","5");
ok(stored().length===6,"6 records saved ("+stored().length+")");
const cards=[...d.querySelectorAll("#ctList .ct-cust")];
ok(cards.length===1 && cards[0].querySelector(".ct-cust-sum").textContent==="合計 6本","one customer card, header '合計 6本'");
const lines=[...cards[0].querySelectorAll(".ct-sum-line")].map(l=>l.textContent);
console.log(lines.join(" | "));
ok(lines.length===2 && /^出庫/.test(lines[0]) && /^空受/.test(lines[1]),"summary lines per 区分: 出庫, 空受");
ok(/ｱｾﾁﾚﾝ 1本\(7\.2\)/.test(lines[0]) && /酸素 3本\(21\)/.test(lines[0]) && /フロン 1本$/.test(lines[0]),"出庫: ｱｾﾁﾚﾝ 1本(7.2) 酸素 3本(21) フロン 1本 (no parens)");
ok(/酸素 1本\(7\)$/.test(lines[1]) && !/ｱｾﾁﾚﾝ/.test(lines[1]),"空受: 酸素 1本(7)");
ok(lines[0].indexOf("ｱｾﾁﾚﾝ")<lines[0].indexOf("酸素") && lines[0].indexOf("酸素")<lines[0].indexOf("フロン"),"gas order follows table");
ok(!/(\d)(㎥|kg)\)/.test(lines.join("")),"no units inside parentheses");

// 区分を切り替えても入力は消えない
set("ctCustomer","△△工業"); set("ctSymbol","Z"); set("ctNumber","99");
d.querySelector('#ctStatusSeg button[data-status="3"]').click();
$("ctStatusSel").value="5"; ev($("ctStatusSel"),"change");
ok($("ctCustomer").value==="△△工業" && $("ctSymbol").value==="Z" && $("ctNumber").value==="99","changing 区分 keeps typed data");
set("ctCustomer","〇〇商店"); set("ctSymbol",""); set("ctNumber","");
d.querySelector('#ctStatusSeg button[data-status="2"]').click();

// 8) 明細
const tog=()=>d.querySelector("#ctList .ct-tog");
ok(tog().textContent==="明細" && d.querySelector("#ctList .ct-add").textContent==="＋追加","buttons: ＋追加 / 明細");
tog().click();
ok(tog().textContent==="閉じる","明細 → 閉じる");
const rows=()=>[...d.querySelectorAll("#ctList .ct-swrap > .ct-row")];
ok(rows().length===6,"6 detail rows");
ok(d.querySelectorAll("#ctList .ct-edit, #ctList .ct-del, #ctList .card-action").length===0,"no per-row buttons");
ok(/← 削除/.test(d.querySelector("#ctList .ct-swipe-hint").textContent) && /変更 →/.test(d.querySelector("#ctList .ct-swipe-hint").textContent),"swipe hint shown");
const col=c=>rows().map(r=>r.querySelector(c).textContent);
const seq=[...d.querySelectorAll("#ctList .ct-dhead, #ctList .ct-swrap")].map(e=>e.classList.contains("ct-dhead")?"["+e.textContent+"]":e.querySelector(".ct-d2").textContent);
ok(seq.join(",")==="[出庫],C-3,A-12X,B-1,B-2,E-5,[空受],D-4","区分 header once per group, then rows (区分→ガス種→記号番号): "+seq.join(","));
ok(col(".ct-d3").join()==="ｱｾﾁﾚﾝ,酸素,酸素,酸素,フロン,酸素","gas column: "+col(".ct-d3").join());
ok(col(".ct-d4").join()==="7.2kg,7㎥,7㎥,7㎥,,7㎥","capacity column: "+col(".ct-d4").join());
ok(!rows().some(r=>r.querySelector(".ct-badge")) && d.querySelectorAll("#ctList .ct-dhead .ct-badge").length===2,"badges only in the 2 header rows");
ok(!rows().some(r=>/\d\d:\d\d/.test(r.textContent)),"no time in 明細");
ok(rows().every(r=>/grid-template-columns/.test(r.getAttribute("style")||"")),"each row has the column template");
ok(/\.ct-swrap > \.ct-row\.ct-drow\{[^}]*padding:9px 0 9px 1em/.test(css) && /\.ct-dhead\{ padding:9px 0 3px;/.test(css),"rows indented 1 character relative to the 区分 header");
ok(/\.ct-sw-edit\{ background:var\(--mint\)/.test(css) && /\.ct-badge\.out\{ background:var\(--sky\)/.test(css),"swipe 変更 is mint, 出庫 badge stays sky (different colors)");

// 9) スワイプ
const swipe=async(row,dx,dy=0)=>{
  const mk=(t,x,y)=>new w.MouseEvent(t,{bubbles:true,clientX:x,clientY:y});
  row.dispatchEvent(mk("pointerdown",200,50)); row.dispatchEvent(mk("pointermove",200+dx,50+dy)); row.dispatchEvent(mk("pointerup",200+dx,50+dy));
  await sleep(80);
};
confirms.length=0; await swipe(rows()[0],30);
ok(stored().length===6 && $("ctSaveButton").textContent==="記録する","short swipe → nothing");
await swipe(rows()[0],10,80);
ok(stored().length===6 && confirms.length===0,"vertical drag → nothing");
confirmAnswer=false; await swipe(rows()[0],-100);
ok(stored().length===6 && /削除しますか/.test(confirms[0]||""),"left swipe → delete confirm; 'いいえ' keeps row");
confirmAnswer=true; await swipe(rows()[0],-100);
ok(stored().length===5 && !stored().some(l=>l.symbol==="C"),"left swipe + はい → deleted (C-3)");
const target=rows()[1].querySelector(".ct-d2").textContent;
await swipe(rows()[1],100);
ok($("ctSaveButton").textContent==="更新" && $("ctCancelEdit").textContent==="更新をやめる" && $("ctTitle").textContent==="容器ログ（変更中）","right swipe → 変更 state: 更新 / 更新をやめる");
ok($("ctSymbol").value+"-"+$("ctNumber").value===target,"form loaded with swiped row ("+target+")");
ok(!/新しい記録として追加/.test(d.body.textContent) && !$("ctAddNewButton"),"no '新しい記録として追加' anywhere");
const before=stored().length;
set("ctCapacity","9"); $("ctSaveButton").click();
ok(stored().length===before && stored().some(l=>l.capacity==="9"),"更新 saves in place");
ok($("ctSaveButton").textContent==="記録する" && !$("ctCancelEdit").offsetParent,"back to normal after 更新");
await swipe(rows()[0],100); $("ctCancelEdit").click();
ok($("ctSaveButton").textContent==="記録する" && stored().length===before,"更新をやめる → normal, nothing changed");

// 10) ＋追加は顧客カードから
d.querySelector("#ctList .ct-add").click();
ok($("ctTitle").textContent==="容器ログ（追加中）" && $("ctCustomer").value==="〇〇商店","＋追加 starts adding for that customer");

// 11) 並び順：日付・カード
set("ctCustomer","△△工業"); d.querySelector('#ctStatusSeg button[data-status="2"]').click(); chip("N2").click(); set("ctSymbol","Q"); set("ctNumber","7"); $("ctSaveButton").click();
const names=[...d.querySelectorAll("#ctList .ct-cust-name")].map(e=>e.textContent);
ok(names[0]==="△△工業" && names[1]==="〇〇商店","cards newest first: "+names.join(" > "));

// ---- 12) 顧客検索・日付検索のコンボボックス ----
set("ctCustomer","山田ガス店"); chip("O2").click(); d.querySelector('#ctStatusSeg button[data-status="2"]').click();
set("ctSymbol","Y"); set("ctNumber","1"); $("ctSaveButton").click();
ok(stored().some(l=>l.customer==="山田ガス店" && l.customerKana==="やまだがすてん" && l.customerCode==="3003"),"reading saved with the log (customerKana)");
set("ctDate","2026-10-05"); ev($("ctDate"),"change");
set("ctCustomer","〇〇商店"); set("ctSymbol","W"); set("ctNumber","2"); $("ctSaveButton").click();
const cardNames=()=>[...d.querySelectorAll("#ctList .ct-cust-name")].map(e=>e.textContent);
const items=id=>[...d.querySelectorAll(`#${id} .ct-combo-item`)].map(b=>b.textContent);
ok(!$("ctFilterClear") && !d.querySelector("datalist"),"no 解除 button, no native datalist");
ok($("ctSearchList").hidden && $("ctDateList").hidden,"lists closed at first");
$("ctSearchBtn").click();
ok(!$("ctSearchList").hidden && items("ctSearchList")[0]==="入力しない" && items("ctSearchList").length===4,"▼ opens customer list: "+items("ctSearchList").join("/"));
$("ctSearch").value="やまだ"; ev($("ctSearch"),"input");
ok(cardNames().join()==="山田ガス店","search by reading (hiragana): "+cardNames().join());
ok(items("ctSearchList").join()==="入力しない,山田ガス店","list narrows while typing: "+items("ctSearchList").join());
$("ctSearch").value="ヤマダ"; ev($("ctSearch"),"input");
ok(cardNames().join()==="山田ガス店","search by reading (katakana)");
$("ctSearch").value="工業"; ev($("ctSearch"),"input");
ok(cardNames().join()==="△△工業","search by name part");
$("ctSearch").value=""; ev($("ctSearch"),"input");
d.querySelectorAll("#ctSearchList .ct-combo-item")[3].click();      // 山田ガス店
ok($("ctSearch").value==="山田ガス店" && $("ctSearchList").hidden && cardNames().join()==="山田ガス店","tap a customer → filter applied, list closes");
ok($("ctFilterInfo").textContent==="絞り込み中：顧客「山田ガス店」","filter info: "+$("ctFilterInfo").textContent);
$("ctSearchBtn").click(); d.querySelector("#ctSearchList .ct-combo-item.none").click();
ok($("ctSearch").value==="" && cardNames().length>=3 && $("ctFilterInfo").textContent==="","「入力しない」 clears the customer filter");
$("ctSearchBtn").click(); d.body.dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true}));
ok($("ctSearchList").hidden,"tap outside closes the list");

// 日付検索
$("ctDateBtn").click();
ok(items("ctDateList").join()==="入力しない,2026/10/8　(木),2026/10/5　(月)","date list: 入力しない + dates newest first: "+items("ctDateList").join());
d.querySelectorAll("#ctDateList .ct-combo-item")[2].click();
ok($("ctFilterDate").value==="2026/10/5　(月)" && $("ctDateList").hidden,"tap a date → shown in the field");
ok(cardNames().join()==="〇〇商店" && /日付 2026\/10\/5　\(月\)/.test($("ctFilterInfo").textContent),"only that date's log is shown; info: "+$("ctFilterInfo").textContent);
$("ctFilterDate").click(); d.querySelector("#ctDateList .ct-combo-item.none").click();
ok($("ctFilterDate").value==="" && $("ctFilterDate").placeholder==="入力しない" && cardNames().length>=3,"「入力しない」 resets the date filter");

// 0件の理由
d.querySelector('#ctFilterSeg button[data-filter="3"]').click();
$("ctSearch").value="山田"; ev($("ctSearch"),"input");
const emp=d.querySelector("#ctList .empty");
ok(emp && emp.textContent==="条件に合う容器ログはありません（空受のみ・顧客「山田」）","0 results explains the conditions: "+(emp&&emp.textContent));

// ---- 13) ガス種の並び・クリーム背景・カードの文字サイズ ----
const order=[...d.querySelectorAll("#ctGasChips .chip")].map(b=>b.textContent);
ok(order.join()==="Ace,O2,N2,フロン,LP,CO2,Ar,ArCo,医O2,その他","chip order (top row: Ace O2 N2 フロン LP / bottom: CO2 Ar ArCo 医O2 その他): "+order.join());
const css2=[...d.querySelectorAll("style")].map(s=>s.textContent).join("\n");
ok(/\.ct-gasbar-wrap\{[^}]*background:#FBF1D8[^}]*border-radius:12px/.test(css2),"slide bar background is light cream");
ok(/\.ct-gasbar\{[^}]*padding:8px/.test(css2),"bar padding leaves room for the selection ring");
const sz=(sel,px)=>new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\{[^}]*font-size:"+px+"px").test(css2);
ok(sz(".ct-cust-name",20) && sz(".ct-cust-sum",14) && sz(".ct-sum-line",16) && sz(".ct-badge",14),"card text +2: name 20 / total 14 / summary 16 / badge 14");
ok(/\.ct-add\{[^}]*font-size:14px/.test(css2) && /\.ct-tog\{[^}]*font-size:14px/.test(css2),"card text +2: ＋追加 / 明細 buttons 14");
ok(/\.ct-drow\{[^}]*font-size:15px/.test(css2) && sz(".ct-swipe-hint",13) && sz(".ct-swbg",15),"card text +2: detail rows 15 / hint 13 / swipe labels 15");
// 並び替えても、ガス種の選択と自動入力は同じ
const chips2=()=>[...d.querySelectorAll("#ctGasChips .chip")];
chips2().find(b=>b.textContent==="CO2").click();
ok($("ctCapacity").value==="30" && /炭酸/.test($("ctGasVert").textContent),"CO2 still → 30 kg, text 炭酸");
chips2().find(b=>b.textContent==="医O2").click();
ok($("ctCapacity").value==="" && /医療用酸素/.test($("ctGasVert").textContent),"医O2 still → blank, text 医療用酸素");
console.log(fails?("FAILS: "+fails):"ALL PASS");
process.exit(fails?1:0);
})();
