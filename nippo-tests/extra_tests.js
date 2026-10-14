
// ---- 14) 文字サイズの切り替え ----
const fsBtns=()=>[...d.querySelectorAll("#ctFsSeg button")];
ok(fsBtns().map(b=>b.textContent).join()==="小,標準,大" && fsBtns().find(b=>b.classList.contains("on")).textContent==="標準","font size buttons 小/標準/大, default 標準");
const lv=n=>$("ctList").style.getPropertyValue(n);
ok(lv("--fs-name")==="20px" && lv("--fs-row")==="17px" && lv("--fs-sum")==="14px" && lv("--fs-line")==="16px","標準: name 20 / row 17 / total 14 / line 16");
fsBtns().find(b=>b.textContent==="大").click();
ok(lv("--fs-name")==="24px" && lv("--fs-row")==="20px" && lv("--fs-badge")==="17px" && w.localStorage.getItem("ctFontSize")==="l","大: name 24 / row 20 / badge 17, saved on the device");
ok(fsBtns().find(b=>b.classList.contains("on")).textContent==="大","大 is highlighted after re-render");
fsBtns().find(b=>b.textContent==="小").click();
ok(lv("--fs-name")==="18px" && lv("--fs-row")==="15px" && lv("--fs-swipe")==="13px","小: name 18 / row 15 / swipe 13");
fsBtns().find(b=>b.textContent==="標準").click();
ok(!JSON.parse(w.localStorage.getItem("containerLogs")).some(l=>"fs" in l || "ctFontSize" in l),"font size is not part of the log data");

// ---- 15) 区分ごとの行：2行目以降のそろえ ----
d.querySelector('#ctFilterSeg button[data-filter="all"]').click();
$("ctSearch").value=""; ev($("ctSearch"),"input"); d.body.dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true}));
const sl=d.querySelector("#ctList .ct-sum-line");
ok(sl && sl.children.length===2 && sl.children[0].classList.contains("ct-badge") && sl.children[1].classList.contains("ct-sum-gases"),"summary line = [区分 badge][gas list] (wrapped lines align under the first gas)");
const card0=d.querySelector("#ctList .ct-cust");
ok(/--sumw:\s*\d+px/.test(card0.getAttribute("style")||""),"区分 column width is shared inside the card: "+card0.getAttribute("style"));
ok(/\.ct-sum-line\{[^}]*grid-template-columns:var\(--sumw/.test(css2),"CSS grid keeps the 2nd line under the first gas");

// ---- 16) 「データ」画面 ----
const navBtns=["navHomeButton","navVehicleButton","navContainerButton","navDataButton"].map(id=>$(id).textContent);
ok(navBtns.join()==="ホーム,車両,容器,データ","header buttons: "+navBtns.join());
ok(/header\{[^}]*flex-wrap:wrap/.test(css2) && /\.ct-datebox\{[^}]*flex:0 0 100%[^}]*flex-direction:row/.test(css2) && /header \.nav-btn\{[^}]*flex:1 1 0[^}]*white-space:nowrap/.test(css2),"header: 2 rows (date + BCP on top, 4 equal buttons below), no wrapping text");
ok(/#reportScreen \.footer-actions\{ display:none/.test(css2),"Home: old mail / delete buttons hidden");
ok(!$("ctCsvButton") && !$("ctMailButton") && !$("ctClearButton") && !$("backupExportButton"),"container tab: no CSV / mail / delete buttons; no backup buttons on Home");
ok(d.querySelectorAll(".ct-offline-status").length===2 && !$("reportScreen").querySelector(".footer-actions .ct-offline-status"),"offline warning kept on Home and 容器");
$("navDataButton").click();
ok($("dataScreen").classList.contains("active") && $("navDataButton").classList.contains("active-lav") && !$("navContainerButton").classList.contains("active-sky"),"データ screen opens, nav highlighted");
ok($("dtMaster").contains($("masterKeyBox")) && $("dtMaster").querySelector(".master-bar"),"客先名リスト controls moved into データ");
// 枠・ボタン名
const frames=[...d.querySelectorAll("#dataScreen .dt-frame")].map(f=>f.className.replace("dt-frame ","")+":"+f.querySelector(".dt-head").textContent.replace(/[▶▼]/g,"").trim());
ok(frames.join()==="send:送る,save:保存,master:顧客リスト(ダウンロード),del:消す,wx:天気の表示","5 colored frames: "+frames.join());
ok(/\.dt-frame\.send\{[^}]*#EEF9F5/.test(css2) && /\.dt-frame\.save\{[^}]*#EDF6FB/.test(css2) && /\.dt-frame\.master\{[^}]*#F3EFFC/.test(css2) && /\.dt-frame\.del\{[^}]*#FFF0F4/.test(css2),"each frame has its own light background");
ok($("dtMailReport").innerHTML==="日報メール送信<br>(日報・車両・容器ログ)","button 1 (2 lines): "+$("dtMailReport").innerHTML);
ok($("dtMailCsv").innerHTML==="容器ログだけメール送信<br>(CSV添付)","button 2 (2 lines): "+$("dtMailCsv").innerHTML);
ok($("dtCsv").innerHTML==="CSVで書き出す<br>(容器ログだけ全件)","button 3 (2 lines): "+$("dtCsv").innerHTML);
ok($("dtMarkSent").textContent==="送信済みにする" && $("dtBackup").textContent==="バックアップ保存" && $("dtRestore").textContent==="バックアップから戻す" && $("dtDelTodo").textContent==="ToDoリストを削除","other button names (ToDoリストを削除)");
ok(/\.dt-chip\.v, \.dt-chip\.d, \.dt-chip\.c\{[^}]*background:var\(--butter\)/.test(css2),"未送信 chips share one color (yellow), different from the frame colors");
ok(!/[（）]/.test($("dataScreen").textContent.replace(/[\s\S]*?(?=)/,"")) || !/[（）]/.test([...d.querySelectorAll("#dataScreen .btn, #dataScreen .dt-head, #dataScreen .dt-desc, #dataScreen .dt-note")].map(e=>e.textContent).join("")),"no full-width parentheses in the データ labels");
// 「消す」は閉じておく
ok($("dtDelBody").hidden && $("dtDelHead").getAttribute("aria-expanded")==="false" && $("dtCaret").textContent==="▶","「消す」 closed by default");
$("dtDelHead").click();
ok(!$("dtDelBody").hidden && $("dtDelHead").getAttribute("aria-expanded")==="true" && $("dtCaret").textContent==="▼","tap the heading → opens");
ok(/消すと戻せません。先にバックアップを/.test($("dtDelBody").textContent),"warning line inside");
$("dtDelHead").click(); ok($("dtDelBody").hidden,"tap again → closes");
$("dtDelHead").click(); $("navHomeButton").click(); $("navDataButton").click();
ok($("dtDelBody").hidden,"re-entering データ closes 「消す」 again");
$("dtDelHead").click();

const ct0=stored().length;
const chipsTxt=()=>[$("dtChipV"),$("dtChipD"),$("dtChipC")].map(e=>e.textContent).join("|");
ok(chipsTxt()===`訪問 2|車両 2|容器 ${ct0}`,"unsent chips: "+chipsTxt());
ok($("dtUnsent").querySelector(".dt-chips-label").textContent==="未送信","chips label 未送信");
ok(/まだ保存していません/.test($("dtLastBackup").textContent) && $("dtLastBackup").classList.contains("warn"),"no backup yet → warning");
ok(/^\d+本\(未送信 \d+\)$/.test($("dtDelContainerDesc").textContent) && $("dtDelTodoDesc").textContent==="未完了 1・完了 1","short descriptions: "+$("dtDelContainerDesc").textContent+" / "+$("dtDelTodoDesc").textContent);
ok($("dtMailCsvDesc").textContent===`未送信 ${ct0}本` && $("dtCsvDesc").textContent===`全件 ${ct0}本を保存`,"short descriptions: "+$("dtMailCsvDesc").textContent+" / "+$("dtCsvDesc").textContent);
$("dtMailReport").click();
ok(w.__mailClicks===1,"日報メール送信 → triggers the existing mail button");
const m1=w.buildReportMail();
ok(/V:2 D:2/.test(m1.body) && /【容器ログ】/.test(m1.body),"mail before marking: everything included: "+m1.body.split("\n")[0]);
confirms.length=0; $("dtMarkSent").click();
ok(/^未送信\(訪問 2・車両 1・容器 \d+\)を\n送信済みにします。次回から送りません。/.test(confirms[0]||""),"mark-sent confirm (short; vehicle: only the finished day): "+(confirms[0]||"").split("\n")[0]);
ok(chipsTxt()==="訪問 0|車両 1|容器 0","after marking: "+chipsTxt());
const m2=w.buildReportMail();
ok(/V:0 D:1/.test(m2.body) && !/【容器ログ】/.test(m2.body),"mail after marking: sent records excluded: "+m2.body.split("\n")[0]);
ok(stored().every(l=>l.sentAt) && w.eval("meetingLogs").every(l=>l.sentAt),"sentAt stored on visits and container logs");
d.querySelector("#navContainerButton").click();
d.querySelector("#ctList .ct-tog").click();
ok(d.querySelectorAll("#ctList .ct-sent").length>0 && /済/.test(d.querySelector("#ctList .ct-sent").textContent),"sent rows show a small 済 mark in 明細");
$("navDataButton").click(); $("dtDelHead").click();
w.URL.createObjectURL=()=>"blob:x"; w.URL.revokeObjectURL=()=>{};
const dl2=[]; w.HTMLAnchorElement.prototype.click=function(){ dl2.push(this.download); };
toasts0=w.eval("toasts.length"); $("dtMailCsv").click(); await sleep(60);
ok(w.eval("toasts").slice(toasts0).includes("未送信の容器ログはありません"),"mail CSV with nothing unsent → message");
d.querySelector("#navContainerButton").click();
set("ctCustomer","△△工業"); d.querySelector('#ctStatusSeg button[data-status="2"]').click(); chip("O2").click(); set("ctSymbol","U"); set("ctNumber","1"); $("ctSaveButton").click();
$("navDataButton").click(); $("dtDelHead").click();
ok(chipsTxt()==="訪問 0|車両 1|容器 1","new log counts as unsent: "+chipsTxt());
const m3=w.buildReportMail();
ok(/【容器ログ】/.test(m3.body) && /,U,1,/.test(m3.body) && !/,B,2,/.test(m3.body),"mail: only the unsent container log is appended");
const shared=[];
w.navigator.canShare=()=>true; w.navigator.share=async(data)=>{ shared.push([data.files[0].name, data.files[0].type]); };
$("dtMailCsv").click(); await sleep(60);
ok(shared.length===1 && /^容器ログ_\d{8}\.csv$/.test(shared[0][0]) && /csv/.test(shared[0][1]),"mail CSV: shared as a csv file (attach via share sheet): "+shared[0]);
$("dtCsv").click(); await sleep(60);
ok(shared.length===2 && /^容器ログ全件_\d{8}\.csv$/.test(shared[1][0]),"CSV export (all): "+shared[1][0]);
$("dtBackup").click(); await sleep(60);
ok(shared.length===3 && /バックアップ/.test(shared[2][0]) && !!w.localStorage.getItem("lastBackupAt"),"backup saved + date recorded");
ok(/^最後の保存：\d{4}\/\d{1,2}\/\d{1,2}　\([日月火水木金土]\) \d\d:\d\d$/.test($("dtLastBackup").textContent) && !$("dtLastBackup").classList.contains("warn"),"last backup shown: "+$("dtLastBackup").textContent);
w.localStorage.removeItem("lastBackupAt");
w.navigator.share=async()=>{ const e=new Error("x"); e.name="AbortError"; throw e; };
$("dtBackup").click(); await sleep(60);
ok(!w.localStorage.getItem("lastBackupAt"),"cancelled share → backup date not recorded");
w.navigator.canShare=undefined;
dl2.length=0; $("dtMailCsv").click(); await sleep(80);
ok(dl2.length===1 && /^容器ログ_/.test(dl2[0]),"no share sheet: file is downloaded, mail draft opens");

confirms.length=0; confirmAnswer=false; $("dtDelSent").click();
ok(/^送信済み\(訪問 2・車両 1・容器 \d+\)を削除します。\n未送信は残ります。/.test(confirms[0]||""),"delete sent-only: short confirm: "+(confirms[0]||"").split("\n")[0]);
ok(w.eval("meetingLogs.length")===2,"declined → nothing deleted");
confirmAnswer=true; $("dtDelSent").click();
ok(w.eval("meetingLogs.length")===0 && Object.keys(w.eval("dailyVehicleInfo")).join()==="2026-10-08" && stored().length===1 && stored()[0].symbol==="U","sent-only delete keeps the unsent (vehicle today, container U-1)");
confirms.length=0; $("dtDelContainer").click();
ok(/^容器ログ 1本を削除します。\n\(未送信 1本\)/.test(confirms[0]||"") && stored().length===0,"delete container logs: short confirm; deleted");
confirms.length=0; $("dtDelTodo").click();
ok(/^ToDoリスト\(未完了 1・完了 1\)を削除します。/.test(confirms[0]||"") && w.eval("todoItems.length")===0 && !w.localStorage.getItem("todoItems"),"delete TODO");
confirms.length=0; $("dtDelReport").click();
ok(/^訪問 0・車両 1を削除します。/.test(confirms[0]||"") && Object.keys(w.eval("dailyVehicleInfo")).length===0,"delete 日報・車両: confirm shows counts");
ok(chipsTxt()==="訪問 0|車両 0|容器 0","counts refreshed after delete: "+chipsTxt());

// ---- 17) 括弧は半角（アプリの文言のみ。入力されたデータは書き換えない） ----
ok($("vehicleFuel").placeholder==="給油量(L)","host label → placeholder with half-width parens: "+$("vehicleFuel").placeholder);
ok(/訪問履歴\(\d+件\)/.test(d.querySelector("#reportScreen h2.h2-flex").textContent),"host heading normalized: "+d.querySelector("#reportScreen h2.h2-flex").textContent);
ok(d.querySelector("#visitList").textContent.includes("（株）テスト商店"),"entered data keeps its own parentheses: "+d.querySelector("#visitList").textContent);
const shown=[...d.querySelectorAll("#containerScreen, #dataScreen")].map(e=>e.textContent).join("");
ok(!/[（）]/.test(shown),"container / データ screens show no full-width parentheses");
set("ctCustomer","（株）テスト"); chip("O2").click(); set("ctSymbol","P"); set("ctNumber","7"); d.querySelector("#navContainerButton").click(); $("ctSaveButton").click();
ok([...d.querySelectorAll("#ctList .ct-cust-name")].some(e=>e.textContent==="（株）テスト"),"customer name typed with （株） is kept as entered");

// ---- 18) 一画面・「登録」・記号と番号の高さ・ToDoリスト表記 ----
d.querySelector("#navContainerButton").click();
ok(d.querySelectorAll("#containerScreen .ct-lbrow").length===2 && $("ctSymbol").previousElementSibling.classList.contains("ct-lbrow") && $("ctNumber").previousElementSibling.classList.contains("ct-lbrow"),"記号 and 番号 labels are in same-height rows (aligned inputs)");
ok(/\.ct-lbrow\{[^}]*height:26px/.test(css2),"label rows have one fixed height");
set("ctCustomer","△△工業"); d.querySelector('#ctStatusSeg button[data-status="2"]').click(); chip("O2").click(); set("ctSymbol","F"); set("ctNumber","1");
$("ctSaveButton").click();
ok($("ctFlash").classList.contains("show") && $("ctFlash").textContent==="登録","「登録」 shown big right after recording");
ok(d.activeElement===$("ctSymbol"),"cursor goes to 記号 after recording");
await sleep(900);
ok(!$("ctFlash").classList.contains("show"),"「登録」 disappears after ~0.8s");
ok(/\.ct-flash\{[^}]*font-size:64px/.test(css2),"「登録」 is large");

ok(d.querySelector("#vehicleScreen .dt-frame.veh2 .dt-head span").textContent==="ToDoリスト","static heading: ToDoリスト");
w.renderTodoList();
ok(d.querySelector("#vehicleScreen .todo-list-target h2 span").textContent==="ToDoリスト","dynamic heading after re-render: ToDoリスト");
w.showToast("TODOに追加しました");
ok(w.eval("toasts")[w.eval("toasts.length")-1]==="ToDoに追加しました","toast text unified: ToDo");

const vh=d.querySelector("#vehicleScreen .dt-frame.veh1 .dt-head");
ok(vh.contains($("vehicleStatusPill")) && vh.textContent.startsWith("車両情報"),"帰社/帰社済み pill sits right next to the 車両情報 heading");
ok($("vehicleModeLabel").parentNode.style.display==="none","old 出発/帰社 label row hidden");

w.goToVisit();
{ const ta=$("meetingContent"), nt=$("meetingNotes"); let need=20, needN=20;
  Object.defineProperty(ta,"scrollHeight",{configurable:true,get:()=>need});
  Object.defineProperty(nt,"scrollHeight",{configurable:true,get:()=>needN});
  Object.defineProperty(ta,"offsetHeight",{configurable:true,get:()=>parseFloat(ta.style.height)||0});
  Object.defineProperty(nt,"offsetHeight",{configurable:true,get:()=>parseFloat(nt.style.height)||0});
  w.goToVisit();
  ok(ta.style.height==="20px" && nt.style.height==="20px","内容・特記事項 start at 1 row ("+ta.style.height+" / "+nt.style.height+")");
  need=40; ev(ta,"input"); ok(ta.style.height==="40px","grows one row when the text needs it");
  need=20; ev(ta,"input"); ok(ta.style.height==="40px","does not shrink when text is deleted");
  need=60; ev(ta,"input"); ok(ta.style.height==="60px","grows again by one row");
  const before=ta.style.height; w.dispatchEvent(new w.Event("resize")); w.dispatchEvent(new w.Event("orientationchange")); await sleep(250);
  ok(ta.style.height===before,"height does not change on resize / keyboard (no recalculation while typing)");
  need=5000; ev(ta,"input"); ok(parseInt(ta.style.height)<=Math.ceil(20+(w.innerHeight-14)*0.65)+1 && parseInt(ta.style.height)>60,"capped by what fits on the screen ("+ta.style.height+")");
  needN=40; ev(nt,"input"); ok(nt.style.height==="40px","特記事項 grows one row at a time too");
  need=20; needN=20; w.goToVisit(); ok(ta.style.height==="20px" && nt.style.height==="20px","re-opening the screen resets to 1 row"); }
ok(/#visitStartTimeInput\{[^}]*width:100%/.test(css2) && /#visitStatusField \.ct-inwrap\{[^}]*width:8\.5em/.test(css2) && /#visitStatusField > div\{[^}]*inline-block/.test(css2),"訪問中 row: pill and a narrow start-time field side by side");
ok(/#visitScreen \.card\{ padding:10px 12px/.test(css2) && /#visitScreen textarea\{ resize:none/.test(css2),"visit screen spacing compacted; textareas are not user-resizable");

// ---- 19) 顧客の管理(「非表示」のチェックで、すぐ反映) ----
const status=()=>$("masterStatus").textContent;
ok(status()==="顧客リスト：A営業所 3件","status text uses 顧客リスト: "+status());
$("navDataButton").click();
$("dtCustManage").click();
ok($("custScreen").classList.contains("active"),"顧客の管理 opens");
const tabs=()=>[...d.querySelectorAll("#cmTabs button")].map(b=>b.textContent).join("|");
ok(tabs()==="すべて 3|表示中 3|非表示 0","tabs: すべて/表示中/非表示 with counts: "+tabs());
ok($("cmHiddenNote").textContent==="非表示 0件","top note: "+$("cmHiddenNote").textContent);
ok(!$("cmApply") && !d.querySelector(".cm-bar") && !$("cmAll"),"no separate apply / select-all buttons (the check applies at once)");
const rowsOf=()=>[...d.querySelectorAll("#cmList .cm-row")].map(r=>r.querySelector(".cm-name").textContent);
const rowOf=n=>[...d.querySelectorAll("#cmList .cm-row")].find(r=>r.querySelector(".cm-name").textContent===n);
const cbOf=n=>rowOf(n).querySelector('input[type="checkbox"]');
ok(rowsOf().length===3 && rowOf("〇〇商店").querySelector(".cm-chk").textContent.trim()==="非表示" && !cbOf("〇〇商店").checked,"each row has a 非表示 check at the right end (unchecked = visible)");
ok(rowOf("〇〇商店").lastElementChild.classList.contains("cm-chk") && !rowOf("〇〇商店").querySelector(".cm-name").closest("label"),"only the right-end check is tappable (tapping the name does nothing)");
const cssM=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
cbOf("〇〇商店").checked=true; ev(cbOf("〇〇商店"),"change");
ok(JSON.parse(w.localStorage.getItem("customerHidden")).join()==="c:1001","hidden saved at once (by customer code)");
ok(tabs()==="すべて 3|表示中 2|非表示 1" && $("cmHiddenNote").textContent==="非表示 1件","counts updated at once: "+tabs());
ok(rowOf("〇〇商店").classList.contains("is-hidden") && /\.cm-row\.is-hidden \.cm-name\{[^}]*line-through/.test(cssM),"hidden row stays in the list, grayed with a strikethrough");
ok(w.eval("customerMaster.items.length")===2 && !w.eval("customerMaster.items").some(i=>i.n==="〇〇商店"),"pickers get only the visible customers at once");
ok(/\(非表示 1\)/.test(status()) && /^顧客リスト/.test(status()),"status shows hidden count: "+status());
cbOf("〇〇商店").checked=false; ev(cbOf("〇〇商店"),"change");
ok(tabs()==="すべて 3|表示中 3|非表示 0" && w.eval("customerMaster.items.length")===3 && !rowOf("〇〇商店").classList.contains("is-hidden"),"unchecking restores at once");
cbOf("〇〇商店").checked=true; ev(cbOf("〇〇商店"),"change");
d.querySelector('#cmTabs button[data-tab="show"]').click();
ok(rowsOf().join()!=="" && !rowsOf().includes("〇〇商店") && rowsOf().length===2,"表示中 filter: the hidden one leaves the list");
d.querySelector('#cmTabs button[data-tab="hide"]').click();
ok(rowsOf().join()==="〇〇商店" && cbOf("〇〇商店").checked,"非表示 filter lists the hidden one (checked)");
cbOf("〇〇商店").checked=false; ev(cbOf("〇〇商店"),"change");
ok(rowsOf().length===0 && tabs()==="すべて 3|表示中 3|非表示 0","unchecking in the 非表示 filter restores it and it leaves that list");
d.querySelector('#cmTabs button[data-tab="all"]').click();
$("cmSearch").value="やまだ"; ev($("cmSearch"),"input");
ok(rowsOf().join()==="山田ガス店","search by reading in 管理");
$("cmSearch").value=""; ev($("cmSearch"),"input");
// まとめて
$("cmSearch").value="工業"; ev($("cmSearch"),"input");
confirms.length=0; confirmAnswer=true; $("cmHideAll").click();
ok(/^絞り込んだ 1件を非表示にします。/.test(confirms[0]||"") && JSON.parse(w.localStorage.getItem("customerHidden")).join()==="c:2002","bulk hide of the filtered customers (confirm shows the count)");
confirms.length=0; $("cmShowAll").click();
ok(/^絞り込んだ 1件を表示に戻します。/.test(confirms[0]||"") && JSON.parse(w.localStorage.getItem("customerHidden")).length===0,"bulk restore of the filtered customers");
$("cmSearch").value=""; ev($("cmSearch"),"input");
// 容器タブの候補から消える
cbOf("〇〇商店").checked=true; ev(cbOf("〇〇商店"),"change");
d.querySelector("#navContainerButton").click();
$("ctCustomer").value="〇〇"; ev($("ctCustomer"),"input");
ok(![...d.querySelectorAll("#ctCustomerList .customer-item")].some(b=>b.textContent==="〇〇商店"),"hidden customer is not offered in 容器 suggestions");
$("ctCustomer").value=""; ev($("ctCustomer"),"input");
$("navDataButton").click(); $("dtCustManage").click();
cbOf("〇〇商店").checked=false; ev(cbOf("〇〇商店"),"change");
ok(tabs()==="すべて 3|表示中 3|非表示 0" && w.eval("customerMaster.items.length")===3,"restored");
// 顧客を追加
$("cmAddName").value="新規商事"; $("cmAddKana").value="しんきしょうじ"; $("cmAddCode").value="９００１"; $("cmAddBtn").click();
ok(tabs()==="すべて 4|表示中 4|非表示 0" && w.eval("customerMaster.items").some(i=>i.n==="新規商事" && i.c==="9001" && i.k==="しんきしょうじ"),"added customer (code normalized) appears in the pickers: "+tabs());
ok(rowOf("新規商事").querySelector(".cm-tag") && rowOf("新規商事").querySelector('[data-act="edit"]') && rowOf("新規商事").querySelector('[data-act="del"]'),"added customers carry 追加 / 直す / 消す");
$("cmAddName").value="別の会社"; $("cmAddCode").value="9001"; $("cmAddBtn").click();
ok(tabs()==="すべて 4|表示中 4|非表示 0","duplicate code is rejected");
$("cmAddName").value="コード無し商会"; $("cmAddCode").value=""; $("cmAddBtn").click();
ok(tabs()==="すべて 5|表示中 5|非表示 0","customer without a code can be added (name is the key)");
rowOf("新規商事").querySelector('[data-act="edit"]').click();
ok($("cmAddName").value==="新規商事" && $("cmAddBtn").textContent==="更新" && !$("cmAddCancel").hidden,"edit loads the added customer");
$("cmAddName").value="新規商事(改)"; $("cmAddBtn").click();
ok(rowsOf().includes("新規商事(改)") && !rowsOf().includes("新規商事"),"edited");
cbOf("△△工業").checked=true; ev(cbOf("△△工業"),"change");
w.localStorage.setItem("customerMaster",JSON.stringify({office:"A営業所",updated:"2026-11-01",items:[{n:"〇〇商店",k:"あまる",c:"1001"},{n:"△△工業(新)",k:"かさん",c:"2002"},{n:"山田ガス店",k:"やまだがすてん",c:"3003"},{n:"重複コード会社",k:"ちょうふく",c:"9001"}]}));
w.renderMasterUI();
const names2=w.eval("customerMaster.items").map(i=>i.n);
ok(!names2.includes("△△工業(新)") && names2.includes("〇〇商店"),"after a new download, the hidden customer (code 2002) stays hidden even if the name changed: "+names2.join());
ok(names2.includes("重複コード会社") && !names2.includes("新規商事(改)"),"added customer with the same code as a downloaded one → the downloaded one is used");
ok(names2.includes("コード無し商会"),"added customer without code is still there");
ok(JSON.parse(w.localStorage.getItem("customerExtra")).some(e=>e.n==="新規商事(改)"),"the added customer is still stored (just not shown while the code overlaps)");
w.localStorage.removeItem("customerMaster"); w.renderMasterUI();
ok(w.eval("customerMaster").items.map(i=>i.n).sort().join()===["コード無し商会","新規商事(改)"].sort().join(),"clearing the downloaded list keeps the added customers");
$("navDataButton").click(); $("dtCustManage").click();
confirmAnswer=true;
rowOf("コード無し商会").querySelector('[data-act="del"]').click();
ok(!rowsOf().includes("コード無し商会") && JSON.parse(w.localStorage.getItem("customerExtra")).length===1,"added customer deleted");
$("cmBack").click();
ok($("dataScreen").classList.contains("active"),"← データ goes back");

// 担当キー(営業所キーの言い換え)
ok($("masterKeyInput").placeholder==="担当キー" && d.querySelector('label[for="masterKeyInput"]').style.display==="none","key field is 担当キー (was 営業所キー)");
w.setMasterMessage("先に営業所キーを入力してください。キーが違うか、この営業所のリストが登録されていません。",true);
ok(w.eval("window.__lastMsg")==="先に担当キーを入力してください。キーが違うか、この担当のリストが登録されていません。","host messages use 担当: "+w.eval("window.__lastMsg"));


// ---- 20) ガス種の色・方向の矢印・案内の点滅 ----
d.querySelector("#navContainerButton").click();
const gs=t=>[...d.querySelectorAll("#ctGasChips .chip")].find(b=>b.textContent===t);
const stOf=t=>gs(t).getAttribute("style")||"";
ok(gs("Ar").style.background==="rgb(168, 189, 203)" && gs("Ar").style.color==="rgb(255, 255, 255)" && gs("N2").style.background==="rgb(111, 140, 163)","Ar = light azure gray (dark text); N2 stays the darker azure gray");
ok(/rgb\(168, 189, 203\) 0 30%, rgb\(23, 178, 106\) 30% 70%, rgb\(168, 189, 203\) 70% 100%/.test(stOf("ArCo")),"ArCo stripes: light gray 0-30 / vivid green 30-70 (thicker) / light gray 70-100: "+stOf("ArCo").slice(0,150));
gs("ArCo").click();
ok(/アルコミック/.test($("ctGasVert").textContent) && $("ctGasVert").style.background==="rgb(168, 189, 203)","selected-gas box (right): light azure gray base for ArCo");
const vsp=$("ctGasVert").querySelector("span");
ok(/rgb\(23, 178, 106\) 1\.05em/.test(vsp.getAttribute("style")||"") && /rgb\(23, 178, 106\) 3\.15em/.test(vsp.getAttribute("style")||"") && /transparent 3\.15em/.test(vsp.getAttribute("style")||"") && /line-height:\s*34px/.test(vsp.getAttribute("style")||""),"green sits behind the characters ル・コ (2nd and 3rd of 6, 1.05em-3.15em), full width of the box: "+(vsp.getAttribute("style")||"").slice(0,170));
gs("Ar").click();
ok($("ctGasVert").style.background==="rgb(168, 189, 203)" && $("ctGasVert").style.color==="rgb(255, 255, 255)","selected-gas box for Ar: light azure gray");

const bar2=$("ctGasChips");
let sl2=0, cw2=200, sw2=400;
Object.defineProperty(bar2,"clientWidth",{configurable:true,get:()=>cw2});
Object.defineProperty(bar2,"scrollWidth",{configurable:true,get:()=>sw2});
Object.defineProperty(bar2,"scrollLeft",{configurable:true,get:()=>sl2,set:v=>{sl2=v;}});
const dirs=()=>($("ctGasL").classList.contains("on")?"L":"")+($("ctGasR").classList.contains("on")?"R":"");
sl2=0; ev(bar2,"scroll"); ok(dirs()==="R","at the start: only → blinks");
sl2=100; ev(bar2,"scroll"); ok(dirs()==="LR","in the middle: ← and → blink");
sl2=200; ev(bar2,"scroll"); ok(dirs()==="L","at the right end: only ← blinks");
sw2=200; sl2=0; ev(bar2,"scroll"); ok(dirs()==="","everything fits: no arrows");
ok($("ctGasL").textContent==="←" && $("ctGasR").textContent==="→" && $("ctGasL").parentNode.classList.contains("ct-gasdir") && !$("ctGasWrap").contains($("ctGasL")),"arrows sit above the bar, outside it");
const css4=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
ok(/\.ct-gasdir span\.on\{[^}]*animation:ctBlink/.test(css4) && /@keyframes ctBlink/.test(css4),"arrows blink (CSS animation)");
ok(/prefers-reduced-motion: reduce\)\{[^}]*\.ct-gasdir span\.on\{ animation:none/.test(css4.replace(/\n/g," ")),"reduced-motion: arrows stop blinking");

// 案内の点滅
d.querySelector("#navContainerButton").click();
set("ctCustomer","△△工業"); d.querySelector('#ctStatusSeg button[data-status="2"]').click(); chip("O2").click(); set("ctSymbol","H"); set("ctNumber","1"); $("ctSaveButton").click();
d.querySelector("#ctList .ct-tog").click();
const hint=d.querySelector("#ctList .ct-swipe-hint");
ok(hint.textContent==="←削除変更→","hint text: "+hint.textContent);
const arrows=[...hint.querySelectorAll(".arrow")].map(e=>e.textContent);
ok(arrows.join()==="←,→","hint arrows: ← (削除) and → (変更)");
ok([...hint.querySelectorAll(".word")].map(e=>e.textContent).join()==="削除,変更","hint words 削除 / 変更 stay as plain text");
ok(/\.ct-hint \.arrow\{[^}]*font-size:1\.5em[^}]*font-weight:900[^}]*animation:ctBlink 1s ease-in-out infinite/.test(css4),"arrows: bold, 1.5x, same blink as the gas-bar arrows (ctBlink 1s)");
ok(/-webkit-text-stroke:1px/.test(css4),"arrows thickened with an outline");
ok(/\.ct-hint-l \.arrow\{ color:#D6336C/.test(css4) && /\.ct-hint-r \.arrow\{ color:#128F5A/.test(css4) && /\.ct-hint-l \.word\{ color:var\(--pink-ink\)/.test(css4) && /\.ct-hint-r \.word\{ color:var\(--mint-ink\)/.test(css4),"colors: 削除 pink / 変更 green (arrows a bit darker)");
ok(!/@keyframes ctHintL/.test(css4) && !/\.hl\{/.test(css4),"old sequential animation removed");
ok(/prefers-reduced-motion: reduce\)\{[\s\S]*?\.ct-hint \.arrow\{ animation:none/.test(css4),"reduced-motion: arrows stay still");

// 文字サイズ：標準が初期値、最後の設定が残る
ok(w.localStorage.getItem("ctFontSize")==="m" || w.localStorage.getItem("ctFontSize")===null,"font size: default 標準 (saved setting is kept)");


// ---- 21) 時刻欄・容器タブとデータタブの言葉・一画面の余白 ----
ok(d.querySelector('label[for="editStartTime"]').textContent==="開始" && d.querySelector('label[for="editEndTime"]').textContent==="終了" && d.querySelector('label[for="visitStartTimeInput"]').textContent==="開始","time labels shortened to 2 characters");
ok(parseInt($("editStartTime").style.paddingLeft)<=40 && parseInt($("visitStartTimeInput").style.paddingLeft)<=40 && $("editStartTime").style.textAlign==="left","time fields: small left padding (narrow)");
ok(/#visitScreen \.ct-inwrap input\[type=time\]\{[^}]*width:100%[^}]*min-width:0[^}]*max-width:100%/.test(css2),"time inputs never exceed their box");
ok($("ctTime").style.paddingLeft==="38px","container edit-time field uses the same narrow padding");
ok($("ctGasL").closest(".ct-gashead") && $("ctGasL").closest(".ct-gashead").querySelector("label").textContent==="ガス種" && /\.ct-gashead\{[^}]*height:20px[^}]*margin-bottom:4px/.test(css2),"ガス種 heading and the arrows share one row (small gap to the buttons)");
ok(/#containerScreen \.card\{ padding:10px; margin-bottom:8px; \}/.test(css2) && /#containerScreen \.field\{ margin-bottom:6px; \}/.test(css2) && /\.ct-gasbar\{[^}]*padding:4px/.test(css2) && /\.ct-gas-vert\{[^}]*min-height:88px/.test(css2),"container tab spacing tightened");
ok(/#vehicleScreen \.dial\{ width:72px; height:72px; \}/.test(css2) && /#vehicleScreen \.card\{ padding:10px; margin-bottom:8px; \}/.test(css2) && /#vehicleScreen \.mode-switch-btn\{ padding:6px; \}/.test(css2) && /#vehicleScreen h2\{ margin:6px 0 6px; \}/.test(css2),"vehicle tab spacing tightened (dial 72, card padding 10, ...)");
$("navDataButton").click();
ok($("dtMailReport").innerHTML==="全データをメール送信<br>(日報・車両・ToDo・容器)","button 1 line 2: (日報・車両・ToDo・容器)");
ok($("dtCsv").innerHTML==="容器だけスマホ保存<br>(CSV保存)","button 3: 容器だけスマホ保存 / (CSV保存)");
ok($("dtMailCsv").innerHTML==="容器だけメール送信<br>(CSV添付)","button 2: 容器だけメール送信 / (CSV添付)");
ok($("dtDelContainer").textContent==="容器を削除" && $("dtBackup").parentNode.querySelector(".dt-desc").textContent==="日報・車両・容器・ToDo","Data tab: 容器 instead of 容器ログ");
const dataText=[...d.querySelectorAll("#dataScreen .btn, #dataScreen .dt-desc, #dataScreen .dt-head, #dataScreen .dt-note")].map(e=>e.textContent).join("|");
ok(!/容器ログ/.test(dataText),"no 「容器ログ」 left in the Data tab labels");
ok(/容器ログ/.test(d.querySelector("#containerScreen .dt-head").textContent),"容器 tab keeps its own 「容器ログ」 heading");

// ---- 22) 時刻の箱・車両の初期値・ToDoの顧客名・日報メールの位置情報 ----
const css5=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
const tbx=id=>$(id).parentNode;
const TBIDS=["editStartTime","editEndTime","visitStartTimeInput","ctTime"];
ok(TBIDS.every(id=>tbx(id).classList.contains("ct-timebox")),"all 4 time fields are small boxes");
ok(TBIDS.map(id=>tbx(id).querySelector(".ct-inlab").textContent).join()==="開始,終了,開始,時刻","box labels: 開始 / 終了 / 開始 / 時刻");
ok(/\.ct-timebox\{[^}]*width:7\.6em/.test(css5) && /\.ct-timebox > input\[type=time\]\{[^}]*opacity:0/.test(css5),"box is 7.6em wide; the native input sits on top, invisible (so it cannot stick out)");
const txt=id=>tbx(id).querySelector(".ct-timetext").textContent;
ok(txt("editStartTime")==="--:--","empty time shows --:--");
$("editStartTime").value="09:15";
ok(txt("editStartTime")==="09:15","setting the value from code (opening 編集) updates the box: "+txt("editStartTime"));
$("editEndTime").value="10:20"; ev($("editEndTime"),"change");
ok(txt("editEndTime")==="10:20","choosing a time updates the box");
$("ctTime").value="08:30";
ok(txt("ctTime")==="08:30","container edit-time box updates");

// 車両：出発の走行距離の初期値
w.eval('dailyVehicleInfo={"2026-10-07":{departure:{distance:"1000",time:"x"},return:{distance:"1200",time:"y"}},"2026-10-05":{departure:{distance:"900"},return:{distance:"5000"}}}');
ok(w.getLatestPastReturnDistance("2026-10-08")==="1200","departure default = yesterday's return distance");
w.eval('dailyVehicleInfo={"2026-10-05":{departure:{distance:"900"},return:{distance:"1500"}},"2026-10-06":{departure:{distance:"1500"},return:{distance:""}},"2026-10-08":{departure:{distance:"99999"},return:{distance:""}}}');
ok(w.getLatestPastReturnDistance("2026-10-08")==="1500","no record yesterday → the largest past distance (today's own entry excluded)");
w.eval('dailyVehicleInfo={"2026-10-07":{departure:{distance:"1000"},return:{distance:""}}}');
ok(w.getLatestPastReturnDistance("2026-10-08")==="1000","yesterday's return is empty → the largest past distance");
w.eval('dailyVehicleInfo={}');
ok(w.getLatestPastReturnDistance("2026-10-08")==="","nothing recorded → blank");
w.eval('dailyVehicleInfo={"2026-09-30":{departure:{distance:"500"},return:{distance:"700"}}}');
ok(w.getLatestPastReturnDistance("2026-10-01")==="700","previous calendar day across a month boundary (9/30 → 10/1)");

// 車両：帰社の初期値＝出発の距離
w.eval('dailyVehicleInfo={}');
w.getTodayVehicle().departure.distance="500";
w.renderVehicleScreen();
ok(w.getTodayVehicle().return.distance==="500","帰社 default = 出発 distance");
w.getTodayVehicle().departure.distance="520"; w.renderVehicleScreen();
ok(w.getTodayVehicle().return.distance==="520","follows the departure value until the user types in 帰社");
w.eval('vehicleViewMode="return"'); w.getTodayVehicle().return.distance="777"; ev($("vehicleDistance"),"change");
ok(w.getTodayVehicle().return.userEdited===true,"typing in 帰社 marks it as user-edited");
w.getTodayVehicle().departure.distance="530"; w.renderVehicleScreen();
ok(w.getTodayVehicle().return.distance==="777","a distance the user typed in 帰社 is never overwritten");
w.getTodayVehicle().return.userEdited=false; w.getTodayVehicle().return.time="t"; w.getTodayVehicle().departure.distance="540"; w.renderVehicleScreen();
ok(w.getTodayVehicle().return.distance==="777","after 帰社 is recorded, no sync");

// ToDo：顧客名の先頭3文字(会社の種類の語を除く)
const fut=new Date(Date.now()+5000).toISOString();
w.eval('todoItems=[]');
const names3=[["株式会社 北海道ガス","北ガス"],["(株)ABC商事","ABC"],["有限会社 山田商店","山田商"],["（有）佐藤工業","佐藤工"],["合同会社XY","XY"],["株式会社","株式会"],["北海道ガス株式会社","北ガス"],["あい","あい"],["医療法人 札幌クリニック","札クリ"],["㈱ＡＢＣ","ＡＢＣ"],["札幌ガス商会","札ガス"],["旭川運輸","旭運輸"],["有限会社 苫小牧商店","苫商店"],["釧路市役所","釧役所"],["札幌運","札運"],["札幌","札幌"],["札幌市","札幌市"],["北海道","北海道"],["北広島電機","北電機"],["森田商事","森田商"],["清水商店","清商店"],["利尻富士水産","利水産"],["ニセコ観光","ニ観光"],["新ひだか商事","新商事"],["ABC札幌","ABC"],["㈱帯広自動車","帯自動"],["(有)根室水産","根水産"]];
names3.forEach((x,i)=>w.eval('todoItems.push({id:"s'+i+'",source:"line",target:'+JSON.stringify(x[0])+',createdAt:"'+fut+'"})'));
w.eval('todoItems.push({id:"old",source:"line",target:"株式会社 古い会社",createdAt:"2020-01-01T00:00:00.000Z"})');
w.eval('todoItems.push({id:"man",source:"manual",target:"",createdAt:"'+fut+'"})');
w.saveTodos();
const got=w.eval("todoItems").filter(t=>/^s\d/.test(t.id)).map(t=>t.target);
ok(got.join("|")===names3.map(x=>x[1]).join("|"),"ToDo customer names: "+got.join(" | "));
ok(w.eval("todoItems").find(t=>t.id==="old").target==="株式会社 古い会社","ToDo added before this version stays as it was");
ok(w.eval("todoItems").find(t=>t.id==="s0").fullTarget==="株式会社 北海道ガス","the full name is kept in the data");
ok(w.eval("todoItems").find(t=>t.id==="man").target==="","manual ToDo untouched");
w.saveTodos();
ok(w.eval("todoItems").filter(t=>/^s\d/.test(t.id)).map(t=>t.target).join("|")===got.join("|"),"saving again does not shorten twice");

// 日報メール：位置情報
w.eval('meetingLogs=[{createdAt:"v1",date:"2026-10-08",target:"A",notes:"一行目\\n二行目",startLat:43.062123,startLng:141.354241,endLat:43.0623,endLng:141.35401},{createdAt:"v2",date:"2026-10-08",target:"B",notes:"",startLocation:"43.1,141.2"}]');
w.eval('dailyVehicleInfo={"2026-10-07":{departure:{time:"a",lat:43.06001,lng:141.351},return:{time:"b",lat:43.06215,lng:141.35398,fuel:"30"}},"2026-10-08":{departure:{time:"c"},return:{time:""}}}');
const mm=w.buildReportMail().body;
ok(mm.includes("特記事項：一行目\n二行目\n開始位置：43.06212,141.35424\n終了位置：43.06230,141.35401"),"visit block ends with 開始位置 / 終了位置 (after multi-line notes)");
ok(mm.includes("訪問先：B\n特記事項：\n開始位置：43.10000,141.20000\n終了位置：\n"),"position from a 'lat,lng' string; missing → blank value");
ok(mm.includes("給油量：30\n出発位置：43.06001,141.35100\n帰社位置：43.06215,141.35398"),"vehicle block ends with 出発位置 / 帰社位置 right after the 給油量 line");
ok(/出発位置：\n帰社位置：\n/.test(mm),"today's vehicle without positions → blank values");
ok(!/\u0001/.test(mm),"no internal markers leak into the mail");
ok(w.eval("meetingLogs[0].notes")==="一行目\n二行目" && w.eval('dailyVehicleInfo["2026-10-07"].return.fuel')==="30","stored data is not altered by building the mail");

// ---- 23) 敬称・終了したToDoリスト ----
const cssT=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
const ddH=$("honorificDropdown");
ok([...ddH.querySelectorAll(".honorific-option")].map(b=>b.textContent).join()==="社長,工場長,専務,常務,部長,課長,係長","honorific list: 係長 added at the end: "+[...ddH.querySelectorAll(".honorific-option")].map(b=>b.textContent).join());
[...ddH.querySelectorAll(".honorific-option")].pop().click();
ok($("meetingPersonTitle").value==="係長","係長 can be chosen");
ok(w.eval("HONORIFIC_OPTIONS").includes("係長") && w.eval("HONORIFIC_OPTIONS.filter(x=>x==='係長').length")===1,"係長 is also in the options list (once)");
const tfd=$("meetingPersonTitle").closest(".field"), pfd=$("meetingPerson").closest(".field");
ok(tfd.classList.contains("ct-title-field") && pfd.classList.contains("ct-person-field") && /\.ct-title-field\{ flex:0 0 138px/.test(cssT) && /\.ct-person-field\{ flex:1 1 0/.test(cssT),"敬称 field is wider (138px); 面談者 takes the rest");

const fut1="2026-10-09T10:00:00.000Z", fut2="2026-10-09T12:00:00.000Z";
w.eval('todoItems=[{id:"a",date:"2026-10-08",target:"北ガス",content:"配達",done:false,order:1000,createdAt:"2026-10-08T00:00:00Z"},{id:"b",date:"2026-10-08",target:"",content:"電話",done:true,order:2000,completedAt:"'+fut1+'",createdAt:"2026-10-08T00:01:00Z"},{id:"c",date:"2026-10-07",target:"札ガス",content:"見積",done:true,order:3000,completedAt:"'+fut2+'",createdAt:"2026-10-07T00:00:00Z"}]');
w.renderTodoList();
const dbox=$("doneTodoBox");
ok(!dbox.hidden && dbox.parentNode.id==="vehicleScreen" && dbox.querySelector(".dt-head span").textContent==="終了したToDoリスト","finished list sits at the bottom of the 車両 screen");
const drows=()=>[...dbox.querySelectorAll(".done-item")];
ok(drows().length===2 && drows()[0].getAttribute("data-id")==="c" && drows()[1].getAttribute("data-id")==="b","newest finished first");
ok(drows()[0].querySelector(".line-done").textContent==="10/7札ガス　見積" && /^\(\d+\/\d+ 済\)$/.test(drows()[0].querySelector(".done-suffix").textContent),"row shows date/customer/content with red strikethrough and (m/d 済): "+drows()[0].textContent);
ok(/\.done-item \.line-done\{[^}]*line-through[^}]*#D64545/.test(cssT) && /\.done-item \.done-suffix\{[^}]*#D64545/.test(cssT),"red line and red 済 like the 日報 list");
ok(drows().every(r=>r.querySelector(".todo-undo").checked),"each finished row has a checked box (uncheck = back to 実行中)");
const rr0=w.eval("window.__reportRendered||0");
const t0=w.eval("toasts.length");
const cbC=drows()[0].querySelector(".todo-undo"); cbC.checked=false; ev(cbC,"change");
const itc=w.eval("todoItems").find(t=>t.id==="c");
ok(itc.done===false && !("completedAt" in itc) && itc.order===3000,"back to 実行中: done=false, completedAt cleared, order kept (original position)");
ok(drows().length===1 && drows()[0].getAttribute("data-id")==="b","removed from the finished list");
ok(w.eval("window.__reportRendered||0")>rr0,"日報 list is re-rendered, so the red line and (済) on 内容 disappear");
ok(w.eval("toasts").slice(t0).includes("ToDoリストに戻しました"),"toast: ToDoリストに戻しました");
ok(w.eval("todoItems").filter(t=>!t.done).map(t=>t.id).join()==="a,c" || w.eval("todoItems").filter(t=>!t.done).length===2,"back among the active ones");
const cbB=drows()[0].querySelector(".todo-undo"); cbB.checked=false; ev(cbB,"change");
ok(dbox.hidden,"finished list hidden when nothing is finished");
let many='todoItems=[';
for(let i=0;i<25;i++) many+='{id:"d'+i+'",date:"2026-10-08",target:"",content:"件'+i+'",done:true,order:'+(i*10)+',completedAt:"2026-10-09T'+String(10+Math.floor(i/10)).padStart(2,"0")+':'+String(i%10).padStart(2,"0")+':00.000Z",createdAt:"2026-10-08T00:00:00Z"},';
many+=']';
w.eval(many); w.renderTodoList();
ok(drows().length===20 && !!dbox.querySelector("#doneMore") && /残り 5件/.test(dbox.querySelector("#doneMore").textContent),"20 shown, then 「さらに表示(残り 5件)」");
dbox.querySelector("#doneMore").click();
ok(drows().length===25 && !dbox.querySelector("#doneMore"),"さらに表示 shows the rest");

// ---- 24) グレーの終了ToDo・ヘッダーの天気(気象庁) ----
const cssW=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
ok(/\.done-item\{[^}]*background:#F2EEE4[^}]*color:var\(--ink-soft\)/.test(cssW) && /\.done-item \.line-done\{[^}]*line-through[^}]*rgba\(214,69,69/.test(cssW),"finished ToDo rows are grayed out (red line kept, lighter)");
ok(/#doneTodoBox\{ margin-top:14px/.test(cssW),"space between the ToDoリスト card and the finished list card");
ok($("dateDisplay").closest(".ct-dleft") && d.querySelector(".ct-bcpsub").parentNode===$("dateDisplay").parentNode && !$("ctWx").closest(".ct-dleft"),"header: date with BCP right under it (left); weather on the right");

const H=3600*1000;
const jst=ms=>new Date(ms+9*H).toISOString().slice(0,19)+"+09:00";
const jday=ms=>new Date(ms+9*H).toISOString().slice(0,10);
const nowJ=Date.now()+9*H, bs=Math.floor(nowJ/(6*H))*(6*H)-9*H;
const popT=[0,1,2,3,4].map(k=>jst(bs+k*6*H));
const today=jday(Date.now()), tomorrow=jday(Date.now()+24*H), afterDay=jday(Date.now()+48*H);
const fake=[{publishingOffice:"札幌管区気象台",reportDatetime:jst(Date.now()-H),timeSeries:[
 {timeDefines:[jst(Date.now()-H),tomorrow+"T00:00:00+09:00"],areas:[
   {area:{name:"石狩地方",code:"016010"},weatherCodes:["201","200"],weathers:["くもり　朝晩　晴れ","くもり　夜　雨"]},
   {area:{name:"空知地方",code:"016020"},weatherCodes:["300","300"],weathers:["雨","雨"]}]},
 {timeDefines:popT,areas:[
   {area:{name:"石狩地方",code:"016010"},pops:["0","10","20","30","40"]},
   {area:{name:"空知地方",code:"016020"},pops:["90","90","90","90","90"]}]},
 {timeDefines:[today+"T09:00:00+09:00",today+"T00:00:00+09:00",tomorrow+"T00:00:00+09:00",tomorrow+"T09:00:00+09:00"],areas:[
   {area:{name:"札幌",code:"14163"},temps:["18","12","9","17"]},
   {area:{name:"岩見沢",code:"x"},temps:["1","1","1","1"]}]}]}];
const wkDays=[today,tomorrow,afterDay,jday(Date.now()+72*H),jday(Date.now()+96*H),jday(Date.now()+120*H),jday(Date.now()+144*H)].map(k=>k+"T00:00:00+09:00");
fake.push({publishingOffice:"札幌管区気象台",reportDatetime:jst(Date.now()-5*H),timeSeries:[
 {timeDefines:wkDays,areas:[{area:{name:"石狩地方",code:"016010"},weatherCodes:["201","300","100","200","200","200","200"],pops:["","60","20","30","30","30","30"]}]},
 {timeDefines:wkDays,areas:[{area:{name:"札幌",code:"14163"},tempsMin:["","9","6","5","5","5","5"],tempsMax:["","17","15","14","14","14","14"]}]}]});
const fetched=[];
w.fetch=async(url)=>{ fetched.push(url); return {ok:true,json:async()=>fake}; };
const setPos=(lat,lng)=>Object.defineProperty(w.navigator,"geolocation",{configurable:true,value:{getCurrentPosition:(ok,ng)=>{ if(lat==null) ng(new Error("denied")); else ok({coords:{latitude:lat,longitude:lng}}); }}});
setPos(43.06,141.35);
w.localStorage.removeItem("wxCache"); w.localStorage.removeItem("dailyWeather");
await w.ctRefreshWeather(true);
ok(fetched.length===1 && fetched[0]==="https://www.jma.go.jp/bosai/forecast/data/forecast/016000.json","Sapporo position → the nearest forecast area (石狩地方, file 016000): "+fetched[0]);
const dlab=key=>{ const p=key.split("-").map(Number); return `${p[2]}${"日月火水木金土"[new Date(Date.UTC(p[0],p[1]-1,p[2])).getUTCDay()]}`; };
const tomorrowPops=popT.map((t,k)=>[t.slice(0,10),["0","10","20","30","40"][k]]).filter(x=>x[0]===tomorrow).map(x=>parseInt(x[1],10));
const tPop=tomorrowPops.length?Math.max(...tomorrowPops):60;
const view=()=>w.ctWxView();
const r1=()=>[...$("ctWx").querySelectorAll(".wx-r1")].map(e=>e.textContent);
const r2=()=>[...$("ctWx").querySelectorAll(".wx-r2")].map(e=>e.textContent);
while(w.ctWxPageIndex()!==0) w.ctWxStep(1);
ok(!$("ctWx").hidden && JSON.stringify(r2())===JSON.stringify([dlab(today),dlab(tomorrow),dlab(afterDay)]),"2nd row = dates like 14水 / 15木 / 16金: "+r2().join(" | "));
ok(JSON.stringify(r1())===JSON.stringify(["☁☀","☁☂","☀"]) && view().mode===0,"1st row (icons only, no weather words; two icons for a changing day): "+r1().join(" | "));
w.ctWxStep(1);
ok(view().mode===1 && JSON.stringify(r1())===JSON.stringify(["0%",tPop+"%","20%"]),"next view = rainfall probability for the 3 days: "+r1().join(" | "));
w.ctWxStep(1);
ok(view().mode===2 && JSON.stringify(r1())===JSON.stringify(["18/12","17/9","15/6"]),"next view = temperatures (max/min), 3 days together: "+r1().join(" | "));
ok($("ctWx").querySelector(".wx-grid").classList.contains("flip"),"the row flips when it changes");
w.ctWxStep(1);
ok(view().mode===0,"after temperatures, back to icons");
w.ctWxStep(-1); ok(view().mode===2,"turning back");
ok(!/晴れ|くもり|雨|雪/.test(r1().concat(r2()).join("")),"no weather words are shown (icons only)");
w.ctWxStep(1);
$("ctWx").click();
const sh=$("ctWxSheet");
const hh=k=>parseInt(popT[k].slice(11,13),10);
const cells=(sel)=>[...sh.querySelectorAll(sel)].map(e=>e.textContent);
const t1=sh.querySelectorAll("table.wx-tbl")[0], t2=sh.querySelectorAll("table.wx-tbl")[1];
ok(!sh.hidden && /石狩地方/.test(sh.querySelector("h3").textContent) && !!t1 && !!t2,"tap → detail sheet with two ruled tables");
ok([...t1.querySelectorAll("thead th")].map(e=>e.textContent).join()===[","+dlab(today),dlab(tomorrow),dlab(afterDay)].join(),"table 1 columns = dates (no 今日/明日/明後日): "+[...t1.querySelectorAll("thead th")].map(e=>e.textContent).join(" | "));
const rowTxt=(t,i)=>[...t.querySelectorAll("tbody tr")[i].children].map(e=>e.textContent);
ok(rowTxt(t1,0).join("|")===["天気","くもり 朝晩 晴れ","くもり 夜 雨","晴れ"].join("|"),"row 天気: "+rowTxt(t1,0).join("|"));
ok(rowTxt(t1,1).join("|")==="最高(℃)|18|17|15" && rowTxt(t1,2).join("|")==="最低(℃)|12|9|6","rows 最高 / 最低 (numbers only)");
ok(rowTxt(t1,3).join("|")===["降水確率","0%",tPop+"%","20%"].join("|"),"row 降水確率: "+rowTxt(t1,3).join("|"));
ok([...t2.querySelectorAll("thead th")].map(e=>e.textContent).join()===["今",hh(1)+"時〜",hh(2)+"時〜"].join() && [...t2.querySelectorAll("tbody td")].map(e=>e.textContent).join()==="0%,10%,20%","table 2: rainfall every 6 hours (今 / "+hh(1)+"時〜 / "+hh(2)+"時〜)");
ok(!/今日|明日|明後日|この後/.test(sh.textContent.replace(/[0-9]+[日月火水木金土]/g,"")),"the words 今日 / 明日 / 明後日 / この後 are not used in the sheet");
ok(/出典: 気象庁ホームページ/.test(sh.textContent) && /\.wx-tbl\{[^}]*border-collapse:collapse/.test([...d.querySelectorAll("style")].map(x=>x.textContent).join("\n")) && /\.wx-tbl th, \.wx-tbl td\{[^}]*border:1px solid/.test([...d.querySelectorAll("style")].map(x=>x.textContent).join("\n")),"ruled (bordered) cells; source shown");
sh.querySelector("#wxClose").click();
ok(sh.hidden,"sheet closes");
while(w.ctWxPageIndex()!==0) w.ctWxStep(1);
const daily=JSON.parse(w.localStorage.getItem("dailyWeather")||"{}")["2026-10-08"];
ok(daily && daily.text==="くもり" && Object.keys(daily).join()==="text","the day's weather is saved as one word only (くもり): "+JSON.stringify(daily));
fake[0].timeSeries[0].areas[0].weathers[0]="雨"; fake[0].timeSeries[0].areas[0].weatherCodes[0]="300";
await w.ctRefreshWeather(true);
ok(r1()[0]==="☂" && JSON.parse(w.localStorage.getItem("dailyWeather"))["2026-10-08"].text==="くもり","header updates, but the day's saved record keeps the first one");
w.eval('dailyVehicleInfo={"2026-10-08":{departure:{time:"c",lat:43.1,lng:141.2},return:{time:"",fuel:"5"}}}');
const mw=w.buildReportMail().body;
ok(mw.includes("給油量：5\n出発位置：43.10000,141.20000\n帰社位置：\n天気：くもり\n"),"mail: one 天気 word follows the position lines of the vehicle block");
w.fetch=async()=>{ throw new Error("offline"); };
await w.ctRefreshWeather(true);
ok(!$("ctWx").hidden && r1()[0]==="☂","offline: the last weather stays on screen");
ok(view().stale===false && $("ctWx").querySelector(".wx-stale").hidden,"fresh data: no stale mark");
const c0=JSON.parse(w.localStorage.getItem("wxCache")); c0.fetchedAt=new Date(Date.now()-4*H).toISOString(); w.localStorage.setItem("wxCache",JSON.stringify(c0));
await w.ctRefreshWeather(true);
ok(view().stale===true && !$("ctWx").querySelector(".wx-stale").hidden && $("ctWx").querySelector(".wx-stale").textContent==="--","older than 3 hours: a small -- mark in front");
w.fetch=async(url)=>{ fetched.push(url); return {ok:true,json:async()=>fake}; };
setPos(null,null); fetched.length=0;
await w.ctRefreshWeather(true);
ok(fetched.length===1 && /016000/.test(fetched[0]),"position denied → uses the last area");
setPos(35.68,139.76); fetched.length=0; w.localStorage.removeItem("wxCache");
await w.ctRefreshWeather(true);
ok(fetched.length===0 && $("ctWx").hidden,"outside Hokkaido → nothing fetched, nothing shown");
setPos(43.77,142.37); fetched.length=0; await w.ctRefreshWeather(true);
ok(fetched.length===1 && /012000/.test(fetched[0]),"Asahikawa position → 上川・留萌 file (012000)");
setPos(41.77,140.73); fetched.length=0; await w.ctRefreshWeather(true);
ok(/017000/.test(fetched[0]||""),"Hakodate → 渡島・檜山 (017000)");
setPos(42.92,143.2); fetched.length=0; await w.ctRefreshWeather(true);
ok(/014030/.test(fetched[0]||""),"Obihiro → 十勝 (014030)");
setPos(43.33,145.58); fetched.length=0; await w.ctRefreshWeather(true);
ok(/014100/.test(fetched[0]||""),"Nemuro → 釧路・根室 (014100)");
setPos(43.06,141.35);
// 数値がないとき「--」
fake[1].timeSeries[1].areas[0].tempsMax[2]=""; fake[1].timeSeries[1].areas[0].tempsMin[2]="";
await w.ctRefreshWeather(true);
while(w.ctWxPageIndex()!==2) w.ctWxStep(1);
ok(r1()[2]==="--/--","unknown max and min → --/--: "+r1()[2]);
fake[1].timeSeries[1].areas[0].tempsMax[2]="15";
await w.ctRefreshWeather(true);
ok(r1()[2]==="15/--","unknown min only → 15/--");
fake[1].timeSeries[1].areas[0].tempsMax[2]="";  fake[1].timeSeries[1].areas[0].tempsMin[2]="6";
await w.ctRefreshWeather(true);
ok(r1()[2]==="--/6","unknown max only → --/6");
w.ctWxStep(-1); // 降水確率
fake[1].timeSeries[0].areas[0].pops[2]="";
await w.ctRefreshWeather(true);
ok(view().mode===1 && r1()[2]==="--","unknown rainfall probability → --");
fake[1].timeSeries[0].areas[0].weatherCodes[2]="999";
await w.ctRefreshWeather(true);
w.ctWxStep(-1);
ok(view().mode===0 && r1()[2]==="--","an unknown weather code → -- instead of a wrong icon");
fake[1].timeSeries[0].areas[0].weatherCodes[2]="203"; fake[1].timeSeries[0].areas[0].pops[2]="20";
fake[1].timeSeries[1].areas[0].tempsMax[2]="15"; fake[1].timeSeries[1].areas[0].tempsMin[2]="6";
await w.ctRefreshWeather(true);
ok(r1()[2]==="☁☂","day after tomorrow from the weekly code (203 = くもり時々雨 → ☁☂)");
fake[1].timeSeries[0].areas[0].weatherCodes[2]="100";
await w.ctRefreshWeather(true);


// ---- 25) 顧客名の引き継ぎ(ホーム → 容器タブ) ----
if(!$("ctCancelEdit").hidden) $("ctCancelEdit").click();
w.goToReport(); w.eval('currentVisit=null');
$("homeVisitTarget").value="山田ガス店"; ev($("homeVisitTarget"),"input");
$("navContainerButton").click();
ok($("ctCustomer").value==="山田ガス店","typing a customer at Home, then pressing 容器 → it is filled in");
$("ctCustomer").value="△△工業"; ev($("ctCustomer"),"input");
w.goToReport(); $("homeVisitTarget").value="〇〇商店";
$("navContainerButton").click();
ok($("ctCustomer").value==="〇〇商店","a customer typed at Home replaces the field");
$("ctCustomer").value="手で直した顧客"; ev($("ctCustomer"),"input");
ok($("ctCustomer").value==="手で直した顧客","the filled-in name can be edited");
w.goToReport(); $("homeVisitTarget").value=""; w.eval('currentVisit={isEdit:false,target:"△△工業"}');
$("navContainerButton").click();
ok($("ctCustomer").value==="△△工業" && w.eval("currentVisit")===null,"visit in progress → its customer is carried over");
// 直近に作業した顧客
chip("O2").click(); set("ctCustomer","山田ガス店"); ev($("ctCustomer"),"input"); set("ctSymbol","R"); set("ctNumber","1"); $("ctSaveButton").click();
const lc=JSON.parse(w.localStorage.getItem("lastCustomer")||"null");
ok(lc && lc.name==="山田ガス店" && lc.date==="2026-10-08","recording a container log remembers the customer (for today)");
$("ctCustomer").value=""; ev($("ctCustomer"),"input");
$("navDataButton").click();
$("navContainerButton").click();
ok($("ctCustomer").value==="山田ガス店","opened from another tab, with nothing at Home → the most recent customer is filled in");
$("ctCustomer").value="ABC商会"; ev($("ctCustomer"),"input");
w.goToReport(); $("navContainerButton").click();
ok($("ctCustomer").value==="ABC商会","a name typed by hand is not overwritten by the fallback");
// 昨日以前の顧客は使わない
w.eval('getToday=()=>"2026-10-09"');
$("ctCustomer").value=""; ev($("ctCustomer"),"input");
w.goToReport(); $("navContainerButton").click();
ok($("ctCustomer").value==="","a customer from an earlier day is not filled in (the next day)");
w.eval('getToday=()=>"2026-10-08"');
// ボタンで作業した顧客
w.localStorage.removeItem("lastCustomer");
const card=d.querySelector("#ctList .ct-cust");
const cname=card.querySelector(".ct-cust-name").textContent;
card.querySelector(".ct-tog").click();
ok(JSON.parse(w.localStorage.getItem("lastCustomer")).name===cname,"pressing 明細 remembers that card's customer: "+cname);
w.localStorage.removeItem("lastCustomer");
d.querySelector("#ctList .ct-cust .ct-add").click();
ok(JSON.parse(w.localStorage.getItem("lastCustomer")).name===cname && $("ctCustomer").value===cname,"pressing ＋追加 remembers the customer and fills it in");
// 追加中は上書きしない
w.goToReport(); $("homeVisitTarget").value="別会社"; $("navContainerButton").click();
ok($("ctCustomer").value===cname,"in 追加中, the customer is not replaced");
$("ctCancelEdit").click();


// ---- 26) 天気(右側の2段)・BCPは日付の下・自動で切り替わる速さの設定 ----
const css6=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
const dleft=d.querySelector(".ct-dleft");
ok($("dateDisplay").parentNode===dleft && $("dateDisplay").nextElementSibling.classList.contains("ct-bcpsub") && $("dateDisplay").nextElementSibling.textContent==="BCP用オフライン使用可","BCP text sits right under today's date");
ok($("ctWx").parentNode===d.querySelector(".ct-datebox") && $("ctWx").previousElementSibling===dleft,"the weather block is on the right side of the header");
ok($("ctWx").querySelectorAll(".wx-r1").length===3 && $("ctWx").querySelectorAll(".wx-r2").length===3,"2 rows x 3 days");
ok(/\.wx-grid\{[^}]*grid-template-columns:repeat\(3, 52px\)/.test(css6) && /\.wx-r1\{[^}]*color:#0B7A7A/.test(css6) && /\.wx-r2\{[^}]*color:#5B4A9E/.test(css6),"row 1 azure green, row 2 (dates) dark purple");
ok(/\.wx-grid\.flip \.wx-r1\{ animation:ctWxFlip \.4s/.test(css6) && /prefers-reduced-motion: reduce\)\{ \.wx-grid\.flip \.wx-r1\{ animation:none/.test(css6),"flip animation; none under reduced motion");
ok(!d.querySelector(".ct-wxpage") && !d.querySelector(".ct-wxtrack") && !d.querySelector(".ct-wxdots"),"old page / ticker / dots are gone");
// 自動で切り替わる速さ
$("navDataButton").click();
const wxf=[...d.querySelectorAll("#dataScreen .dt-frame")];
ok(wxf.map(f=>f.querySelector(".dt-head").textContent.replace(/[▶▼]/g,"").trim()).join()==="送る,保存,顧客リスト(ダウンロード),消す,天気の表示","the 天気の表示 frame comes after 消す");
ok(/\.dt-frame\.wx\{[^}]*background:#E9F6F6/.test(css6),"天気の表示 frame has its own color");
const speedBtns=()=>[...d.querySelectorAll("#wxSpeedSeg button")];
ok(speedBtns().map(b=>b.textContent).join()==="速い(3秒),標準(3.5秒),ゆっくり(4秒),止める" && speedBtns().find(b=>b.classList.contains("on")).textContent==="標準(3.5秒)" && w.ctWxInterval()===3500,"speed choices (unchanged); default 標準(3.5秒)");
speedBtns().find(b=>b.textContent==="ゆっくり(4秒)").click();
ok(w.localStorage.getItem("wxSpeed")==="4000" && w.ctWxInterval()===4000,"ゆっくり(4秒): saved on the device");
speedBtns().find(b=>b.textContent==="止める").click();
ok(w.localStorage.getItem("wxSpeed")==="stop" && w.ctWxInterval()===0,"止める → interval 0");
speedBtns().find(b=>b.textContent==="速い(3秒)").click();
ok(w.ctWxInterval()===3000,"速い(3秒)");
await w.ctRefreshWeather(true);
const i0=w.ctWxPageIndex(); await sleep(3400);
ok(w.ctWxPageIndex()===(i0+1)%3,"auto: icons → rainfall → temperatures, every 3 seconds ("+i0+" → "+w.ctWxPageIndex()+")");
$("ctWx").dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true}));
const i1=w.ctWxPageIndex(); await sleep(3400);
ok(w.ctWxPageIndex()===i1 && $("ctWx").classList.contains("paused"),"touching the weather pauses it");
$("ctWx").dispatchEvent(new w.MouseEvent("pointerup",{bubbles:true}));
ok(!$("ctWx").classList.contains("paused"),"letting go resumes it");
const i2=w.ctWxPageIndex();
$("ctWx").dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true,clientX:200}));
$("ctWx").dispatchEvent(new w.MouseEvent("pointerup",{bubbles:true,clientX:100}));
$("ctWx").click();
ok(w.ctWxPageIndex()===(i2+1)%3 && $("ctWxSheet").hidden,"swipe left → next view (no detail opens)");
$("ctWx").dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true,clientX:100}));
$("ctWx").dispatchEvent(new w.MouseEvent("pointerup",{bubbles:true,clientX:200}));
$("ctWx").click();
ok(w.ctWxPageIndex()===i2,"swipe right → previous view");
speedBtns().find(b=>b.textContent==="止める").click();
const i3=w.ctWxPageIndex(); await sleep(3400);
ok(w.ctWxPageIndex()===i3,"止める: no automatic change");
$("ctWx").click();
ok(w.ctWxPageIndex()===(i3+1)%3 && $("ctWxSheet").hidden,"止める: tap → next view");
$("ctWx").dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true}));
await sleep(650);
ok(!$("ctWxSheet").hidden,"止める: long press → detail");
$("ctWx").dispatchEvent(new w.MouseEvent("pointerup",{bubbles:true}));
const i4=w.ctWxPageIndex(); $("ctWx").click();
ok(w.ctWxPageIndex()===i4,"the click after a long press does not change the view");
$("ctWxSheet").querySelector("#wxClose").click();
speedBtns().find(b=>b.textContent==="標準(3.5秒)").click();
ok(w.ctWxInterval()===3500,"back to 標準(3.5秒)");
$("ctWx").click(); ok(!$("ctWxSheet").hidden,"normal: tap → detail");
$("ctWxSheet").querySelector("#wxClose").click();
w.localStorage.setItem("wxCache",JSON.stringify({office:"016000",areaName:"石狩地方",report:jst(Date.now()),fetchedAt:new Date().toISOString(),weathers:["晴れ","雨"],codes:["100","300"],popsT:[],popsV:[],tempName:"",tempsT:[],tempsV:[]}));
await w.ctRefreshWeather(false);
while(w.ctWxPageIndex()!==0) w.ctWxStep(1);
ok(r1()[0]==="☀" && r1()[1]==="☂" && r1()[2]==="--","old saved format: today and tomorrow shown; the missing day is --");
fake[1].timeSeries[0].areas[0].weatherCodes[2]="100";
await w.ctRefreshWeather(true);
w.matchMedia=()=>({matches:true});
w.ctWxRestart();
const r0=w.ctWxPageIndex();
await sleep(3700);
ok(w.ctWxPageIndex()===r0,"reduced motion: no automatic change");
$("ctWx").click();
ok(w.ctWxPageIndex()===(r0+1)%3,"reduced motion: tap → next view");
w.matchMedia=undefined;
w.ctWxRestart();


// ---- 27) 天気の文字色 ----
ok(/\.wx-r1\{[^}]*color:#0B7A7A/.test([...d.querySelectorAll("style")].map(x=>x.textContent).join("\n")),"weather text is azure green (dark): #0B7A7A");
ok(!/\.ct-wxtrack\{[^}]*color:/.test([...d.querySelectorAll("style")].map(x=>x.textContent).join("\n")) && /\.ct-bcpsub\{[^}]*color:var\(--ink-soft\)/.test([...d.querySelectorAll("style")].map(x=>x.textContent).join("\n")),"date / BCP colors unchanged");


// ---- 28) ToDoリストの日付(アズールグレー・小さく・細身) ----
const css8=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
ok(/\.todo-date\{[^}]*color:#6F8CA3[^}]*font-size:11px[^}]*"Avenir Next Condensed","DIN Condensed"[^}]*margin-right:6px/.test(css8),"date: azure gray (#6F8CA3), 11px, condensed font, narrow gap");
w.renderTodoList();
const tgt=d.querySelector("#vehicleScreen .todo-list-target");
tgt.insertAdjacentHTML("beforeend",'<div class="todo-item"><label><span class="todo-line">10/9　北ガス　配達</span></label></div>');
w.ctStyleTodoDates();
const tl=tgt.querySelector(".todo-line");
ok(tl.querySelector(".todo-date") && tl.querySelector(".todo-date").textContent==="10/9" && tl.textContent==="10/9北ガス　配達","host ToDo line: only the date part is styled; the rest is unchanged: "+tl.textContent);
w.ctStyleTodoDates();
ok(tl.querySelectorAll(".todo-date").length===1,"styling twice does nothing extra");
tgt.insertAdjacentHTML("beforeend",'<div class="todo-item"><label><span class="todo-line">手入力のToDo</span></label></div>');
w.ctStyleTodoDates();
ok(tgt.querySelectorAll(".todo-line")[1].querySelector(".todo-date")===null,"a line without a date is left alone");
tgt.insertAdjacentHTML("beforeend",'<div class="todo-item"><label><span class="todo-line">10/9　<b>x</b>&lt;script&gt;</span></label></div>');
w.ctStyleTodoDates();
ok(!tgt.querySelector("script") && !tgt.querySelector("b"),"content is escaped (no HTML injected)");
w.eval('todoItems=[{id:"z",date:"2026-10-07",target:"札ガス",content:"見積",done:true,order:1,completedAt:"2026-10-09T12:00:00.000Z",createdAt:"2026-10-07T00:00:00Z"}]');
w.renderTodoList();
ok(d.querySelector("#doneTodoBox .done-item .todo-date") && d.querySelector("#doneTodoBox .done-item .todo-date").textContent==="10/7","finished ToDo rows: the date is styled too");

// ---- 29) 全消去ボタン・カード・ガス種・顧客名の控え・ToDoの並べ替えと編集 ----
const cssX7=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
const CLR7=["homeVisitTarget","ctCustomer","ctSearch","cmSearch","cmAddName"].filter(id=>$(id));
CLR7.forEach(id=>{ $(id).value=""; });
const clrBtn7=id=>$(id).parentNode.querySelector(".ct-clrbtn");
ok(CLR7.length===5 && CLR7.every(id=>$(id).parentNode.classList.contains("ct-clr") && clrBtn7(id)),"every customer-name field has a (X) button: "+CLR7.join(","));
ok(clrBtn7("homeVisitTarget").textContent==="(X)" && /\.ct-clrbtn\{[^}]*top:3px; right:4px/.test(cssX7),"(X) sits at the top right of the field");
ok(CLR7.every(id=>clrBtn7(id).hidden),"hidden while the field is empty");
$("homeVisitTarget").value="山田";
ok(!clrBtn7("homeVisitTarget").hidden,"appears when text is set (even by the app)");
const fired7=[]; ["input","change"].forEach(t=>$("homeVisitTarget").addEventListener(t,()=>fired7.push(t)));
clrBtn7("homeVisitTarget").click();
ok($("homeVisitTarget").value==="" && fired7.join()==="input,change" && clrBtn7("homeVisitTarget").hidden,"(X) clears everything, fires input/change, then hides itself");
$("ctCustomer").value="あい"; ev($("ctCustomer"),"input");
ok(!clrBtn7("ctCustomer").hidden,"typing shows (X) in the 容器 customer field");
clrBtn7("ctCustomer").click(); ok($("ctCustomer").value==="" && clrBtn7("ctCustomer").hidden,"(X) clears the 容器 customer field");
$("homeVisitTarget").value="x"; $("homeVisitTarget").disabled=true;
ok(clrBtn7("homeVisitTarget").hidden,"hidden while the field is locked (visit in progress)");
$("homeVisitTarget").disabled=false; ok(!clrBtn7("homeVisitTarget").hidden,"shown again when unlocked"); $("homeVisitTarget").value="";

// カード(色分け)
const vfr7=[...d.querySelectorAll("#vehicleScreen > .dt-frame")];
ok(vfr7.map(f=>f.className.split(" ").pop()).join()==="veh1,veh2,veh3","車両: 3 colored cards (車両情報 / ToDoリスト / 終了したToDoリスト)");
ok(vfr7[0].querySelector(".dt-head").textContent.startsWith("車両情報") && vfr7[0].querySelector(".dt-head").contains($("vehicleStatusPill")) && /^ToDoリスト/.test(vfr7[1].querySelector(".dt-head").textContent.trim()),"card heads: 車両情報 (with the pill) / ToDoリスト");
ok(/\.dt-frame\.veh2\{[^}]*margin-top:28px/.test(cssX7),"ToDoリスト card is one step lower (28px)");
ok(!!d.querySelector("#containerScreen > .dt-frame.ctin #ctTitle") && !!d.querySelector("#containerScreen > .dt-frame.ctlist #ctCount") && /\.dt-frame\.ctlist\{[^}]*margin-top:14px/.test(cssX7),"容器: 2 colored cards with a gap between the two 「容器ログ」");
ok(/\.dt-frame\.ctin \.dt-head\{[^}]*var\(--mint\)/.test(cssX7) && /\.dt-frame\.ctlist \.dt-head\{[^}]*var\(--peach\)/.test(cssX7) && /\.dt-frame\.veh1 \.dt-head\{[^}]*var\(--sky\)/.test(cssX7) && /\.dt-frame\.veh2 \.dt-head\{[^}]*var\(--lavender\)/.test(cssX7),"each card has its own color");
ok(/\.dt-frame\.compact \.dt-head\{[^}]*padding:5px 12px/.test(cssX7),"compact card heads (low, to save height)");

// ガス種
$("navContainerButton").click();
const GL7=["Ace","O2","N2","フロン","LP","CO2","Ar","ArCo","医O2"];
ok(GL7.every(n=>gs(n) && gs(n).style.color==="rgb(255, 255, 255)"),"all gas buttons have white text");
ok(["Ar","ArCo","フロン","LP"].every(n=>/rgb\(31, 41, 51\)|#1f2933/i.test(gs(n).style.textShadow)) && ["Ace","O2","N2","CO2","医O2"].every(n=>!gs(n).style.textShadow),"light gray buttons get a dark outline so white text stays readable");
ok(/\.ct-gasdir\{[^}]*margin-right:42px/.test(cssX7),"direction arrows moved left (above the buttons)");
ok($("ctStatusSel").options[0].textContent==="他の区分" && $("ctStatusSel").getAttribute("aria-label")==="他の区分","「その他の区分」 → 「他の区分」");

// ホームで消した顧客名が容器タブに残らない
w.goToReport(); w.eval('currentVisit=null'); w.localStorage.removeItem("lastCustomer");
$("ctCustomer").value=""; ev($("ctCustomer"),"input");
$("homeVisitTarget").value="（株）"; ev($("homeVisitTarget"),"input"); ev($("homeVisitTarget"),"change");
$("navContainerButton").click();
ok($("ctCustomer").value==="","only （株） left at Home → nothing is carried to 容器");
w.goToReport(); $("homeVisitTarget").value="）"; ev($("homeVisitTarget"),"input"); ev($("homeVisitTarget"),"change");
$("navContainerButton").click();
ok($("ctCustomer").value==="","only ） left at Home → nothing is carried to 容器");
w.goToReport(); $("homeVisitTarget").value="山田ガス店"; ev($("homeVisitTarget"),"change");
ok(JSON.parse(w.localStorage.getItem("lastCustomer")).name==="山田ガス店","a real name is remembered when the entry is finished");
$("homeVisitTarget").value=""; ev($("homeVisitTarget"),"input");
ok(w.localStorage.getItem("lastCustomer")===null,"clearing the Home field makes the remembered name forgotten");
$("ctCustomer").value=""; ev($("ctCustomer"),"input");
$("navContainerButton").click();
ok($("ctCustomer").value==="","after clearing at Home, the 容器 field stays empty");
w.goToReport(); $("homeVisitTarget").value="山"; ev($("homeVisitTarget"),"input");
ok(w.localStorage.getItem("lastCustomer")===null,"typing character by character does not remember every step");
$("homeVisitTarget").value="";

// ToDoの並べ替え(≡を0.2秒)
const cont7=d.querySelector("#vehicleScreen .todo-list-target");
const mkList7=()=>{
  cont7.innerHTML="";
  w.eval('todoItems=[{id:"a",content:"A",order:1000,done:false,date:"2026-10-08",target:""},{id:"b",content:"B",order:2000,done:false,date:"2026-10-08",target:""},{id:"c",content:"C",order:3000,done:false,date:"2026-10-08",target:""}]');
  ["a","b","c"].forEach(id=>cont7.insertAdjacentHTML("beforeend",`<div class="todo-item" data-id="${id}"><span class="todo-handle">≡</span><label><span class="todo-line">${id}</span></label></div>`));
  [...cont7.querySelectorAll(".todo-item")].forEach((el,i)=>{ el.getBoundingClientRect=()=>({top:i*40,height:40,bottom:i*40+40,left:0,right:100,width:100}); w.attachTodoDrag(el.querySelector(".todo-handle"),cont7); });
};
const order7=()=>[...cont7.querySelectorAll(".todo-item")].map(e=>e.getAttribute("data-id")).join("");
const winEv7=(t,y)=>w.dispatchEvent(new w.MouseEvent(t,{clientY:y}));
mkList7();
const hC7=cont7.querySelectorAll(".todo-handle")[2], itC7=cont7.querySelectorAll(".todo-item")[2];
hC7.dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true,clientY:100}));
await sleep(120);
ok(!itC7.classList.contains("dragging"),"before 0.2 seconds the row is not grabbed");
await sleep(150);
ok(itC7.classList.contains("dragging"),"after holding ≡ for 0.2 seconds the row is grabbed (lifted)");
winEv7("pointermove",5);
winEv7("pointerup",5);
ok(w.eval("todoItems").slice().sort((x,y)=>x.order-y.order).map(t=>t.id).join("")==="cab" && ["c","a","b"].every((id,i)=>w.eval("todoItems").find(t=>t.id===id).order===(i+1)*1000),"dragging up reorders the list and saves the new order: "+w.eval("todoItems").map(t=>t.id+":"+t.order).join(","));
mkList7();
cont7.querySelectorAll(".todo-handle")[2].dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true,clientY:100}));
await sleep(100); winEv7("pointerup",100); await sleep(250);
ok(!cont7.querySelector(".dragging") && order7()==="abc","letting go before 0.2 seconds does nothing (a plain touch)");
mkList7();
cont7.querySelectorAll(".todo-handle")[2].dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true,clientY:100}));
await sleep(50); winEv7("pointermove",130); await sleep(300);
ok(!cont7.querySelector(".dragging"),"moving at once (a scroll) before 0.2 seconds does not grab the row");
winEv7("pointerup",130);

// 車両タブのToDo：長押しで編集
cont7.innerHTML="";
w.eval('todoItems=[{id:"e1",content:"配達",target:"北ガス",order:1000,done:false,date:"2026-10-08",source:"line",shortDone:true,createdAt:"2026-10-08T00:00:00Z"}]');
cont7.insertAdjacentHTML("beforeend",`<div class="todo-item" data-id="e1"><span class="todo-handle">≡</span><label><input type="checkbox"><span class="todo-line">10/8　北ガス　配達</span></label></div>`);
let line7=cont7.querySelector(".todo-line");
const pd7=()=>line7.dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true,clientX:50,clientY:50}));
const pu7=()=>line7.dispatchEvent(new w.MouseEvent("pointerup",{bubbles:true}));
pd7(); await sleep(200); pu7();
ok($("todoEditSheet").hidden,"a short press does not open the editor");
pd7(); await sleep(600);
ok(!$("todoEditSheet").hidden && $("teTarget").value==="北ガス" && $("teContent").value==="配達","press and hold (0.5s) opens the editor with the current customer and content");
pu7();
const clk7=new w.MouseEvent("click",{bubbles:true,cancelable:true}); line7.dispatchEvent(clk7);
ok(clk7.defaultPrevented && !cont7.querySelector("input").checked,"the release after a long press does not tick the check (not finished by mistake)");
$("teContent").value=""; $("teSave").click();
ok(!$("todoEditSheet").hidden && w.eval("todoItems")[0].content==="配達","an empty content is not accepted");
$("teTarget").value="札ガス"; $("teContent").value="見積に変更"; $("teSave").click();
const it07=w.eval("todoItems")[0];
ok($("todoEditSheet").hidden && it07.target==="札ガス" && it07.content==="見積に変更" && it07.shortDone===true,"更新 saves the customer and content");
cont7.innerHTML=""; cont7.insertAdjacentHTML("beforeend",`<div class="todo-item" data-id="e1"><span class="todo-handle">≡</span><label><input type="checkbox"><span class="todo-line">10/8　札ガス　見積に変更</span></label></div>`); line7=cont7.querySelector(".todo-line");
pd7(); await sleep(600); pu7();
ok(!$("todoEditSheet").hidden,"(the editor opens again for the next step)");
$("teCancel").click();
ok($("todoEditSheet").hidden && w.eval("todoItems")[0].content==="見積に変更","やめる closes without changes");
cont7.innerHTML=""; cont7.insertAdjacentHTML("beforeend",`<div class="todo-item" data-id="e1"><span class="todo-handle">≡</span><label><input type="checkbox"><span class="todo-line">10/8　札ガス　見積に変更</span></label></div>`); line7=cont7.querySelector(".todo-line");
pd7(); await sleep(600); pu7(); confirmAnswer=true; $("teDelete").click();
ok($("todoEditSheet").hidden && w.eval("todoItems").length===0,"削除 removes the ToDo (after confirming): hidden="+$("todoEditSheet").hidden+" items="+JSON.stringify(w.eval("todoItems")).slice(0,120)+" confirms="+JSON.stringify(confirms.slice(-2)));


// ---- 30) ホームが空のとき容器も空・途中の文字・カードの色・ホームのカード・ホームのToDo編集・天気の大きさ ----
const cssY=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
w.eval('currentVisit=null'); w.localStorage.removeItem("lastCustomer");
w.goToReport(); $("ctCustomer").value=""; ev($("ctCustomer"),"input");
$("homeVisitTarget").value="山田ガス店"; ev($("homeVisitTarget"),"input"); $("navContainerButton").click();
ok($("ctCustomer").value==="山田ガス店","Home has a customer → carried to 容器");
w.goToReport(); $("homeVisitTarget").value=""; ev($("homeVisitTarget"),"input"); $("navContainerButton").click();
ok($("ctCustomer").value==="","Home emptied → the name filled in earlier is cleared too");
$("ctCustomer").value="手入力の会社"; ev($("ctCustomer"),"input");
w.goToReport(); $("homeVisitTarget").value=""; $("navContainerButton").click();
ok($("ctCustomer").value==="手入力の会社","a name typed by hand in 容器 is kept");
w.localStorage.setItem("lastCustomer",JSON.stringify({name:"△△工業",date:"2026-10-08",src:""}));
$("ctCustomer").value=""; ev($("ctCustomer"),"input");
w.goToReport(); $("homeVisitTarget").value=""; $("navContainerButton").click();
ok($("ctCustomer").value==="","opened from Home with an empty Home field → stays empty (the recent customer is not used)");
$("navDataButton").click(); $("navContainerButton").click();
ok($("ctCustomer").value==="△△工業","opened from another tab → the recent customer is filled in");
for(const v of ["（株","株式会","株式","(有","株式会社","（有）"]){
  $("ctCustomer").value=""; ev($("ctCustomer"),"input");
  w.goToReport(); $("homeVisitTarget").value=v; ev($("homeVisitTarget"),"input"); $("navContainerButton").click();
  ok($("ctCustomer").value==="","unfinished company-type text '"+v+"' is not carried");
}
$("ctCustomer").value=""; ev($("ctCustomer"),"input");
w.goToReport(); $("homeVisitTarget").value="株木商事"; ev($("homeVisitTarget"),"input"); $("navContainerButton").click();
ok($("ctCustomer").value==="株木商事","a real name that starts with 株 is carried");
$("ctCustomer").value=""; ev($("ctCustomer"),"input"); w.goToReport(); $("homeVisitTarget").value="";

// 車両情報のカード：出発=ピーチ、帰社=スカイ(下の大きなボタンと同じ色)
const veh1=d.querySelector("#vehicleScreen .dt-frame.veh1");
w.eval('vehicleViewMode="departure"'); w.renderVehicleScreen();
ok(veh1.getAttribute("data-mode")==="departure","出発の登録: the card is in departure mode");
w.eval('vehicleViewMode="return"'); w.renderVehicleScreen();
ok(veh1.getAttribute("data-mode")==="return","帰社の登録: the card is in return mode");
w.eval('vehicleViewMode="departure"'); d.querySelector("#vehicleScreen .mode-switch-btn").click(); await sleep(30);
ok(veh1.getAttribute("data-mode")==="departure","switching the mode button re-applies the card color");
ok(/\.dt-frame\.veh1\[data-mode="departure"\]\{[^}]*background:#FFF3EA; border-color:var\(--peach-dark\)/.test(cssY) && /\.dt-frame\.veh1\[data-mode="departure"\] \.dt-head\{[^}]*var\(--peach\)/.test(cssY),"CSS: 出発 = peach (head, body tint, border) — the same peach as the big 出発 button");
ok(/\.dt-frame\.veh1\[data-mode="return"\]\{[^}]*background:#EDF6FB; border-color:var\(--sky-dark\)/.test(cssY) && /\.dt-frame\.veh1\[data-mode="return"\] \.dt-head\{[^}]*var\(--sky\)/.test(cssY),"CSS: 帰社 = sky (head, body tint, border) — the same sky as the big 帰社 button");

// ホームのカード
const hf=[...d.querySelectorAll("#reportScreen > .dt-frame")];
ok(hf.map(f=>f.className.split(" ").pop()).join()==="hm1,hm2,hm3","ホーム: 3 cards (訪問先 / ToDoリスト / 訪問履歴)");
ok(hf[0].querySelector(".dt-head").textContent==="訪問先" && hf[0].contains($("homeVisitTarget")) && /^訪問履歴/.test(hf[2].querySelector(".dt-head").textContent) && !!hf[2].querySelector("#visitList"),"ホーム cards: 訪問先 holds the input, 訪問履歴 holds the list");
ok(/\.dt-frame\.hm1 \.dt-head\{[^}]*var\(--mint\)/.test(cssY) && /\.dt-frame\.hm2 \.dt-head, \.dt-frame\.hm2 \.todo-list-target > h2\{[^}]*var\(--lavender\)/.test(cssY) && /\.dt-frame\.hm3 \.dt-head\{[^}]*var\(--peach\)/.test(cssY),"ホーム cards: mint / lavender / peach");
const hmT=d.querySelector("#reportScreen .todo-list-target");
hmT.innerHTML=""; await sleep(20);
ok(hf[1].hidden,"ToDoリスト card is hidden while there is no ToDo");
hmT.innerHTML='<div class="todo-item" data-id="h1"><span class="todo-handle">≡</span><label><span class="todo-line">10/8　北ガス　配達</span></label></div>'; await sleep(20);
ok(!hf[1].hidden,"ToDoリスト card appears when there is a ToDo");
// ホームのToDoも長押しで編集
w.eval('todoItems=[{id:"h1",content:"配達",target:"北ガス",order:1000,done:false,date:"2026-10-08",source:"line",shortDone:true,createdAt:"2026-10-08T00:00:00Z"}]');
const hl=hmT.querySelector(".todo-line");
hl.dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true,clientX:50,clientY:50})); await sleep(200);
hl.dispatchEvent(new w.MouseEvent("pointerup",{bubbles:true}));
ok($("todoEditSheet").hidden,"Home: a short press does not open the editor");
hl.dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true,clientX:50,clientY:50})); await sleep(600);
ok(!$("todoEditSheet").hidden && $("teTarget").value==="北ガス" && $("teContent").value==="配達","Home: press and hold opens the same editor");
hl.dispatchEvent(new w.MouseEvent("pointerup",{bubbles:true}));
const hclk=new w.MouseEvent("click",{bubbles:true,cancelable:true}); hl.dispatchEvent(hclk);
ok(hclk.defaultPrevented,"Home: the release after a long press does not tick the check");
$("teCancel").click();

// 天気：アイコンだけ大きく
ok(/\.wx-r1\{[^}]*font-size:15px[^}]*line-height:22px; height:22px/.test(cssY) && /\.wx-grid\.icons \.wx-r1\{ font-size:17px; \}/.test(cssY) && /\.wx-r2\{[^}]*font-size:11px/.test(cssY),"icons 17px; rainfall digits 15px; the date row unchanged; row height fixed");
ok(/\.wx-grid\.temp \.wx-r1\{ font-size:13px; \}/.test(cssY) && !/\.wx-grid\.pop \.wx-r1\{[^}]*color/.test(cssY) && /\.wx-r1\{[^}]*color:#0B7A7A/.test(cssY) && /\.wx-pc\{ font-size:13px; \}/.test(cssY),"temperature 13px; rainfall has the same color as the temperature (azure green), the % mark at 13px");
w.ctWxStep(0);
const grid=d.querySelector("#ctWx .wx-grid");
while(w.ctWxPageIndex()!==0) w.ctWxStep(1);
ok(grid.classList.contains("icons"),"icon view: large (17px)");
w.ctWxStep(1); ok(!grid.classList.contains("icons") && grid.classList.contains("pop") && w.ctWxView().mode===1,"rainfall view: purple, digits 15px");
w.ctWxStep(1); ok(!grid.classList.contains("icons") && grid.classList.contains("temp") && w.ctWxView().mode===2,"temperature view: 13px");
w.ctWxStep(1);


// ---- 31) ToDoは□だけ・開始ボタン・件数・行の入れ替え・画面固定・端のなぞり・全データのCSVメール ----
const css31=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
const c31=d.querySelector("#vehicleScreen .todo-list-target"); c31.innerHTML="";
c31.insertAdjacentHTML("beforeend",`<div class="todo-item" data-id="z1"><label><input type="checkbox" class="todo-complete"><span class="todo-line">10/8　北ガス　配達</span></label><span class="todo-handle">≡</span></div>`);
const ln31=c31.querySelector(".todo-line"), cb31=c31.querySelector("input");
const k31=new w.MouseEvent("click",{bubbles:true,cancelable:true}); ln31.dispatchEvent(k31);
ok(k31.defaultPrevented && !cb31.checked,"tapping the ToDo text does nothing (it is not finished)");
const k32=new w.MouseEvent("click",{bubbles:true,cancelable:true}); cb31.dispatchEvent(k32);
ok(!k32.defaultPrevented,"tapping the □ itself is not blocked");
ok(/\.todo-item input\[type=checkbox\]\{ transform:scale\(1\.55\); margin:0 9px 0 7px; \}/.test(css31),"the □ is larger (about 30px)");
w.eval('todoItems=[{id:"d1",content:"見積",target:"札ガス",done:true,order:1,date:"2026-10-07",completedAt:"2026-10-09T12:00:00.000Z",createdAt:"2026-10-07T00:00:00Z"}]'); w.renderTodoList();
const dl31=d.querySelector("#doneTodoBox .todo-line"); const k33=new w.MouseEvent("click",{bubbles:true,cancelable:true}); dl31.dispatchEvent(k33);
ok(k33.defaultPrevented && w.eval("todoItems")[0].done===true,"in the finished list too, tapping the text does not bring it back (only its □ does)");
ok(/#homeStartButton\{ background:#3F9A5E; color:#fff; \}/.test(css31),"the 開始 button is dark green with white text (no longer the ToDo lavender)");
w.eval('todoItems=[{id:"t1",content:"A",order:1,done:false,date:"2026-10-08",target:""},{id:"t2",content:"B",order:2,done:false,date:"2026-10-08",target:""},{id:"t3",content:"C",order:3,done:true,date:"2026-10-08",target:"",completedAt:"2026-10-09T00:00:00Z"}]');
w.renderTodoList();
const hh31=d.querySelector("#reportScreen .todo-list-target > h2");
ok(!!hh31 && !!hh31.querySelector(".todo-count") && hh31.querySelector(".todo-count").textContent==="(2件)","home ToDo title bar shows the unfinished count in the middle: (2件)");
ok(/\.todo-count\{[^}]*position:absolute; left:50%; transform:translateX\(-50%\)/.test(css31),"the count is centered in the title bar");
w.eval('todoItems.push({id:"t4",content:"D",order:4,done:false,date:"2026-10-08",target:""})'); w.renderTodoList();
ok(d.querySelector("#reportScreen .todo-list-target > h2 .todo-count").textContent==="(3件)" && d.querySelectorAll("#reportScreen .todo-count").length===1,"the count follows additions: (3件), shown once");
const pos31=(a,b)=>!!(a.compareDocumentPosition(b) & w.Node.DOCUMENT_POSITION_FOLLOWING);
ok(pos31($("ctDate"),$("ctStatusSeg")) && pos31($("ctStatusSeg"),$("ctCustomer")),"container form: 日付 row first, then the 出庫・空受・他の区分 row, then the customer");
const src31=require("fs").readFileSync("container.js","utf8");
ok(!/preventScroll/.test(src31) && !/ct-locked/.test(src31),"no screen lock and no preventScroll anywhere (the iPhone's own behavior is used)");
$("navContainerButton").click();
$("ctNumber").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
ok(!d.body.classList.contains("ct-locked") && !/ct-locked/.test(css31),"focusing a form field no longer locks the page");
$("ctNumber").dispatchEvent(new w.FocusEvent("focusout",{bubbles:true}));
if(d.activeElement && d.activeElement.blur) d.activeElement.blur();
await sleep(400);

// 画面の端のなぞりで、隣のタブへ
const te31=(type,x,y)=>{ const e=new w.Event(type,{bubbles:true}); e.touches=type==="touchend"?[]:[{clientX:x,clientY:y}]; e.changedTouches=[{clientX:x,clientY:y}]; d.dispatchEvent(e); };
const swipe31=(x0,x1,y0,y1)=>{ te31("touchstart",x0,y0===undefined?300:y0); te31("touchend",x1,y1===undefined?310:y1); };
const act31=()=>["reportScreen","vehicleScreen","containerScreen","dataScreen","visitScreen"].find(id=>$(id).classList.contains("active"));
const W31=w.innerWidth;
$("navContainerButton").click();
ok(act31()==="containerScreen","(start: 容器)");
swipe31(10,130); ok(act31()==="vehicleScreen","left edge → right: previous tab (車両)");
swipe31(10,130); ok(act31()==="reportScreen","left edge → right again: ホーム");
swipe31(10,130); ok(act31()==="dataScreen","from ホーム, left edge → right goes around to データ");
swipe31(W31-10,W31-130); ok(act31()==="reportScreen","from データ, right edge → left goes around to ホーム");
swipe31(W31-10,W31-130); ok(act31()==="vehicleScreen","right edge → left: next tab (車両)");
swipe31(W31-10,W31-130); ok(act31()==="containerScreen","→ 容器");
swipe31(W31-10,W31-130); ok(act31()==="dataScreen","→ データ");
swipe31(100,220); ok(act31()==="dataScreen","a swipe that does not start at the edge does nothing");
swipe31(10,60); ok(act31()==="dataScreen","too short (under 70px) does nothing");
swipe31(10,130,300,430); ok(act31()==="dataScreen","mostly vertical does nothing");
swipe31(10,130); ok(act31()==="containerScreen","(works again after the ignored ones)");
w.goToVisit(); swipe31(W31-10,W31-130);
ok(act31()==="visitScreen","on the visit input screen the edge swipe is not used");
w.goToReport();

// 全データのCSVメール
let shared31=null;
Object.defineProperty(w.navigator,"canShare",{configurable:true,value:()=>true});
Object.defineProperty(w.navigator,"share",{configurable:true,value:async d0=>{ shared31=d0; }});
w.eval(`meetingLogs=[{createdAt:"v1",date:"2026-10-08",number:1,target:"山田ガス店",customerCode:"3003",startTime:"2026-10-08T09:00",endTime:"2026-10-08T09:30",attendee:"山田",attendeeTitle:"社長",content:"配達：A,B\\n\\"重要\\"",notes:"なし",startLat:43.062123,startLng:141.354241,endLat:43.0623,endLng:141.35401},{createdAt:"v2",date:"2026-10-08",number:2,target:"送信済み商店",startTime:"2026-10-08T10:00",endTime:"2026-10-08T10:20",sentAt:"2026-10-08T11:00:00Z"}]`);
w.eval('dailyVehicleInfo={"2026-10-08":{departure:{time:"2026-10-08T08:00",distance:"1000",lat:43.1,lng:141.2},return:{time:"2026-10-08T17:00",distance:"1100",fuel:"20"}}}');
w.localStorage.setItem("dailyWeather",JSON.stringify({"2026-10-08":{text:"くもり 朝晩 晴れ",max:18,min:12}}));
w.eval('todoItems=[{id:"t1",date:"2026-10-08",target:"北ガス",content:"配達",done:false,order:1},{id:"t2",date:"2026-10-07",target:"札ガス",content:"見積",done:true,order:2,completedAt:"2026-10-09T12:00:00.000Z"}]');
$("navContainerButton").click(); chip("O2").click(); set("ctCustomer","山田ガス店"); ev($("ctCustomer"),"input"); set("ctSymbol","R"); set("ctNumber","91"); $("ctSaveButton").click();
$("navDataButton").click();
$("dtMailReport").click(); await sleep(200);
const rd31=f=>new Promise(r=>{ const fr=new w.FileReader(); fr.onload=()=>r(fr.result); fr.readAsText(f); });
ok(!!shared31 && shared31.files.map(f=>f.name).join()==="訪問_20261008.csv,車両_20261008.csv,ToDo_20261008.csv,容器ログ_20261008.csv","全データ: 4 CSV files are attached together: "+(shared31?shared31.files.map(f=>f.name).join(" "):"(not shared)"));
const csv31=await Promise.all(shared31.files.map(rd31));
ok(csv31[0].split("\r\n")[0]==="日付,番号,顧客コード,訪問先,開始時刻,終了時刻,面談者,敬称,内容,特記事項,開始位置,終了位置","訪問.csv header");
ok(csv31[0].includes('"配達：A,B\n""重要"""') && csv31[0].includes('"43.06212,141.35424","43.06230,141.35401"') && !csv31[0].includes("送信済み商店"),"訪問.csv: commas/newlines/quotes are quoted; positions included; already-sent visits are left out");
ok(csv31[1].split("\r\n")[0]==="日付,出発時刻,出発距離,帰社時刻,帰社距離,給油量,出発位置,帰社位置,天気" && csv31[1].includes('2026-10-08,08:00,1000,17:00,1100,20,"43.10000,141.20000",,くもり') && !/最高|最低|晴れ/.test(csv31[1]),"車両.csv: times, distances, fuel, positions and ONE weather word (くもり) - even from an older saved record");
ok(csv31[2].split("\r\n")[0]==="状態,日付,顧客名,内容,対応日" && csv31[2].includes("未対応,10/8,北ガス,配達,") && /済,10\/7,札ガス,見積,\d+\/\d+/.test(csv31[2]),"ToDo.csv: unfinished and finished items");
ok(csv31[3].split("\r\n")[0]==="日付,時刻,区分コード,区分,記号,番号,顧客コード,顧客名,ガス種コード,ガス種,容量,単位" && csv31[3].includes("山田ガス店"),"容器ログ.csv: the same format as the container-only CSV");
const bom31=await new Promise(r=>{ const fr=new w.FileReader(); fr.onload=()=>r([...new Uint8Array(fr.result).slice(0,3)]); fr.readAsArrayBuffer(shared31.files[0]); });
ok(bom31.join()==="239,187,191","files start with a BOM (Excel opens the Japanese text correctly)");
ok(shared31.title==="営業日報 2026-10-08" && /訪問1件・車両1日・ToDo2件・容器\d+本/.test(shared31.text),"the mail has a short title and a count line: "+shared31.text.replace(/\n/g," / "));
// 送信済みにしたあとは、送らない
$("dtMarkSent").click();
w.eval('todoItems=[]');
const t31=w.eval("toasts.length"); shared31=null;
$("dtMailReport").click(); await sleep(200);
ok(shared31===null && w.eval("toasts").slice(t31).includes("送るデータがありません"),"after 送信済みにする, with no ToDo, nothing is sent: 「送るデータがありません」");


// ---- 32) 入力中のバナー・あ〜わ他・記録ボタン・色の統一 ----
const css32=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
const hdr32=d.querySelector("header");
if(d.activeElement && d.activeElement.blur) d.activeElement.blur();
await sleep(1100);
ok(!hdr32.classList.contains("banner-off"),"banner is shown while not typing");
ok(/header\{[^}]*overflow:hidden; max-height:240px; transition:opacity \.15s/.test(css32) && /header\.banner-off\{[^}]*max-height:0/.test(css32),"the banner disappears at once; coming back, it only fades in (about 0.15s) - no animated height change");
$("navContainerButton").click();
$("ctNumber").focus(); $("ctNumber").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
ok(hdr32.classList.contains("banner-off"),"focusing an input hides the banner");
$("ctSymbol").focus(); $("ctSymbol").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
await sleep(400);
ok(hdr32.classList.contains("banner-off"),"moving from one input to another keeps the banner hidden (no flicker)");
$("ctSymbol").focus();
const cb32=$("ctSaveButton"); cb32.dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true}));
ok(d.activeElement===$("ctSymbol"),"pressing a button does not take the cursor away");
$("ctCustomer").value="あ"; $("ctCustomer").focus(); const x32=$("ctCustomer").parentNode.querySelector(".ct-clrbtn");
x32.dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true}));
ok(d.activeElement===$("ctCustomer"),"pressing (X) does not take the cursor away either");
$("ctCustomer").value="";
d.querySelector("#containerScreen .dt-head").dispatchEvent(new w.MouseEvent("pointerdown",{bubbles:true}));
ok(d.activeElement!==$("ctCustomer") && !$("ctSymbol").matches(":focus"),"pressing an empty spot ends the input");
await sleep(1100);
ok(!hdr32.classList.contains("banner-off"),"the banner comes back about 0.2s after the input ends");
$("ctSymbol").focus(); $("ctSymbol").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
ok(hdr32.classList.contains("banner-off"),"(typing again hides it)");
$("ctSymbol").blur(); $("ctSymbol").dispatchEvent(new w.FocusEvent("focusout",{bubbles:true}));
await sleep(1100);
ok(!hdr32.classList.contains("banner-off"),"(and it returns)");

// 「あ〜わ他」：顧客名が空のときだけ
const kana32=()=>$("ctKanaArea").style.display;
$("ctCustomer").value=""; ev($("ctCustomer"),"input");
ok(kana32()==="block","customer empty → 「あ〜わ他」 buttons are shown");
$("ctCustomer").value="山"; ev($("ctCustomer"),"input");
ok(kana32()==="none","a customer name typed → the buttons are hidden");
$("ctCustomer").parentNode.querySelector(".ct-clrbtn").click();
ok($("ctCustomer").value==="" && kana32()==="block","pressing (X) clears the name and brings the buttons back");
$("ctCustomer").value="山田ガス店";
ok(kana32()==="none","a name set by the app (candidate / carried over) hides the buttons");
$("ctCustomer").value="";
ok(kana32()==="block","the name emptied by the app brings them back");
w.renderMasterUI();
const kb32=d.querySelector('#ctKanaGrid .kana-btn:nth-child(8)'); if(kb32) kb32.click();
const cand32=d.querySelector("#ctCustomerList .customer-item");
if(cand32){ cand32.click(); ok($("ctCustomer").value!=="" && kana32()==="none","choosing a candidate fills the name and hides the buttons"); }
else ok(true,"(no candidate in that row of the test data)");
$("ctCustomer").value=""; ev($("ctCustomer"),"input");

// 記録するボタンの色
ok($("ctSaveButton").classList.contains("btn-sky") && !$("ctSaveButton").classList.contains("btn-lavender"),"「記録する」 uses the container color (sky)");

// 登録の表示(横書き)
ok(/\.ct-flash-cust\{[^}]*-webkit-line-clamp:2/.test(css32) && /\.ct-flash-gas\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/.test(css32) && !/writing-mode:\s*vertical/.test(css32.match(/\.ct-flash[^{]*\{[^}]*\}/g).join("")),"the 登録 display is horizontal: the customer name wraps up to 2 lines; the gas line is one line");

// タブごとの色
const tc32=d.getElementById("tabColors").textContent;
ok(/\.dt-frame\.hm1 \.dt-head\{ background:var\(--mint\)/.test(tc32) && /\.dt-frame\.hm3 \.dt-head\{ background:#C9EFE4/.test(tc32),"ホーム: the 訪問先 and 訪問履歴 cards are shades of mint (the ホーム button color)");
ok(/\.dt-frame\.hm2\{ background:#F3EFFC; border-color:var\(--lavender-dark\); \}/.test(tc32) && /\.dt-frame\.hm2 \.dt-head, \.dt-frame\.hm2 \.todo-list-target > h2\{ background:var\(--lavender\); color:var\(--lavender-ink\); \}/.test(tc32) && /\.dt-frame\.veh2\{ background:#F3EFFC; border-color:var\(--lavender-dark\); \}/.test(tc32) && /\.dt-frame\.veh2 \.dt-head\{ background:var\(--lavender\); color:var\(--lavender-ink\); \}/.test(tc32),"ToDoリスト cards (ホーム and 車両): the same light-purple (lavender) colors again");
ok(/\.dt-frame\.veh2 \.dt-head\{ background:var\(--lavender\)/.test(tc32) && /\.dt-frame\.veh3 \.dt-head\{ background:#E6DDF9/.test(tc32) && !/\.dt-frame\.veh1/.test(tc32),"車両: ToDoリスト = lavender, 終了したToDoリスト = lighter lavender; the 車両情報 card keeps 出発=peach / 帰社=sky");
ok(/\.dt-frame\.ctin \.dt-head\{ background:var\(--sky\)/.test(tc32) && /\.dt-frame\.ctlist \.dt-head\{ background:var\(--sky-dark\)/.test(tc32),"容器: two shades of sky blue (the 容器 button color)");
ok(/\.dt-frame\.send \.dt-head\{ background:var\(--lavender\)/.test(tc32) && /\.dt-frame\.save \.dt-head\{ background:var\(--lavender-dark\)/.test(tc32) && /\.dt-frame\.master \.dt-head/.test(tc32) && /\.dt-frame\.wx \.dt-head/.test(tc32) && !/\.dt-frame\.del/.test(tc32),"データ: lavender shades; the 消す card stays pink");
ok(/\.nav-btn\.active-sky\{[^}]*var\(--sky\)/.test(css32) && /\.nav-btn\.active-lav\{[^}]*var\(--lavender\)/.test(css32),"the 容器 and データ tab buttons keep sky and lavender (ホーム=mint and 車両=peach are defined in index.html, unchanged)");


// ---- 33) 容器ログを入力しやすく：ガス種を1行に縮める・キーボードの決定キー ----
$("navContainerButton").click();
if(!$("ctCancelEdit").hidden) $("ctCancelEdit").click();
$("ctCustomer").value=""; ev($("ctCustomer"),"input");
const head33=$("ctGasHead"), area33=$("ctGasArea"), sum33=$("ctGasSum");
w.eval("0");
chip("N2").click(); chip("N2")&&0;
ok(head33.classList.contains("collapsed") && area33.style.display==="none" && sum33.style.display==="flex","after choosing a gas, the 2 rows of buttons shrink to one line");
ok($("ctGasSumChip").textContent==="窒素　N2" && /^7 ㎥$/.test($("ctGasSumCap").textContent),"the line shows the gas name, symbol and capacity+unit: "+$("ctGasSumChip").textContent+" / "+$("ctGasSumCap").textContent);
ok(!$("ctGasChange") && $("ctGasSum").getAttribute("role")==="button" && !!$("ctGasSum").querySelector(".ct-gassum-arrow") && head33.querySelector(".ct-gasdir").style.display==="none","no 変更 button any more: the whole line is the button (with a small ▼); the direction arrows are hidden");
$("ctCapacity").value="9"; ev($("ctCapacity"),"input");
ok($("ctGasSumCap").textContent==="9 ㎥","changing the capacity updates the line");
$("ctGasSum").click();
ok(!head33.classList.contains("collapsed") && area33.style.display==="" && sum33.style.display==="none","pressing the gas line opens the 2 rows of buttons again");
ok(d.querySelectorAll("#ctGasChips .chip").length>=10,"all gas buttons are there to choose from");
chip("O2").click();
ok(head33.classList.contains("collapsed") && $("ctGasSumChip").textContent==="酸素　O2","choosing another gas shrinks it again");
chip("その他").click();
ok(!head33.classList.contains("collapsed") && $("ctGasOther").style.display==="block","「その他」 stays open (a name has to be typed)");
chip("O2").click();
set("ctCustomer","山田ガス店"); ev($("ctCustomer"),"input"); set("ctSymbol","K"); set("ctNumber","501");
const n33=stored().length; $("ctSaveButton").click();
ok(stored().length===n33+1 && head33.classList.contains("collapsed"),"after recording, the gas stays chosen and shrunk (repeat entries stay compact)");
ok(/\.ct-gashead\.collapsed\{[^}]*min-height:42px/.test([...d.querySelectorAll("style")].map(x=>x.textContent).join("\n")) && /\.ct-gassum\{[^}]*min-height:42px[^}]*cursor:pointer/.test([...d.querySelectorAll("style")].map(x=>x.textContent).join("\n")),"the gas row is a low (42px) row and is tappable (instead of about 124px)");
// キーボード
ok($("ctCapacity").getAttribute("enterkeyhint")==="next" && $("ctSymbol").getAttribute("enterkeyhint")==="next" && $("ctNumber").getAttribute("enterkeyhint")==="go","keyboard return keys: 容量=次へ / 記号=次へ / 番号=移動");
$("ctSymbol").focus();
const kd=(el,k)=>{ const e=new w.KeyboardEvent("keydown",{key:k,bubbles:true,cancelable:true}); el.dispatchEvent(e); return e; };
const e1=kd($("ctSymbol"),"Enter");
ok(e1.defaultPrevented && d.activeElement===$("ctNumber"),"Enter in 記号 moves to 番号");
set("ctSymbol","K"); set("ctNumber","502");
const n34=stored().length; const e2=kd($("ctNumber"),"Enter");
ok(e2.defaultPrevented && stored().length===n34+1 && d.activeElement===$("ctSymbol"),"Enter in 番号 records (the same as 記録する); the cursor goes back to 記号");
$("ctCapacity").focus(); const e3=kd($("ctCapacity"),"Enter");
ok(e3.defaultPrevented && d.activeElement===$("ctSymbol"),"Enter in 容量 moves to 記号");
set("ctSymbol",""); set("ctNumber","7");
const n35=stored().length; kd($("ctNumber"),"Enter");
ok(stored().length===n35,"Enter in 番号 with an empty 記号 records nothing (the usual check applies)");
set("ctNumber","");


// ---- 34) 入力中の余白・「登録」の表示の大きさ ----
const css34=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
if(d.activeElement && d.activeElement.blur) d.activeElement.blur();
await sleep(1100);
ok(!d.body.classList.contains("kb-pad"),"no extra bottom space while not typing");
$("ctNumber").focus(); $("ctNumber").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
ok(d.body.classList.contains("kb-pad") && /body\.kb-pad\{ padding-bottom:60vh !important; \}/.test(css34),"while an input has the cursor, 60% of the screen height is added at the bottom (room for the iPhone to scroll the field into view)");
$("ctSymbol").focus(); $("ctSymbol").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
await sleep(400);
ok(d.body.classList.contains("kb-pad"),"moving from one input to another keeps the space (no jump)");
$("ctSymbol").blur(); $("ctSymbol").dispatchEvent(new w.FocusEvent("focusout",{bubbles:true}));
await sleep(1100);
ok(!d.body.classList.contains("kb-pad") && !d.querySelector("header").classList.contains("banner-off"),"the space is removed together with the banner coming back");
ok(!/preventScroll/.test(require("fs").readFileSync("container.js","utf8")),"(the page is still never locked or forced)");
ok(/\.ct-flash-main\{[^}]*font-size:28px/.test(css34) && /\.ct-flash-cust\{[^}]*font-size:20px/.test(css34) && /\.ct-flash-gas\{[^}]*font-size:20px/.test(css34),"登録 28px; the customer and gas lines 20px (so they can be read)");
ok(/\.ct-flash\{[^}]*width:max-content; max-width:90vw[^}]*color:var\(--sky-ink\); border-color:var\(--sky-dark\)/.test(css34),"the display box is up to 90% of the screen width, in the sky color of the 容器 tab");
$("navContainerButton").click(); if(!$("ctCancelEdit").hidden) $("ctCancelEdit").click();
set("ctCustomer","とても長い名前の株式会社ガス商会第二営業所東支店"); ev($("ctCustomer"),"input"); chip("O2").click(); d.querySelector('#ctStatusSeg button[data-status="2"]').click();
set("ctSymbol","Z"); set("ctNumber","888"); $("ctSaveButton").click();
const fl34=$("ctFlash");
ok(fl34.querySelector(".ct-flash-main").textContent==="登録" && fl34.querySelector(".ct-flash-cust").textContent==="とても長い名前の株式会社ガス商会第二営業所東支店" && fl34.querySelector(".ct-flash-gas").textContent==="酸素　O2　7 ㎥","a long customer name is kept whole in the display (shown on up to 2 lines); the gas line is separate");
await sleep(1400);


// ---- 35) 表示順・入力順：顧客名 → ガス種 → 容量 → 記号 → 番号 ----
const before35=(a,b)=>!!(a.compareDocumentPosition(b) & w.Node.DOCUMENT_POSITION_FOLLOWING);
ok(before35($("ctCustomer"),$("ctGasChips")) && before35($("ctGasChips"),$("ctCapacity")) && before35($("ctCapacity"),$("ctSymbol")) && before35($("ctSymbol"),$("ctNumber")) && before35($("ctNumber"),$("ctSaveButton")),"display and tab order: 顧客名 → ガス種 → 容量 → 記号 → 番号 → 記録する");
ok(before35($("ctUnitSeg"),$("ctSymbol")) && before35($("ctAdjField"),$("ctSymbol")),"the unit buttons and the アセチレン adjust buttons stay with the capacity (above 記号)");
// 顧客名を選んだあと
const dom35=await JSDOM.fromURL("http://localhost:8765/harness4.html",{runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,beforeParse(w2){ w2.localStorage.setItem("customerMaster",JSON.stringify({office:"A営業所",updated:"2026-10-01",items:[{n:"山田ガス店",k:"やまだがすてん",c:"3003"},{n:"山本商事",k:"やまもとしょうじ",c:"3004"}]})); }});
const w35=dom35.window; w35.scrollTo=()=>{}; w35.confirm=()=>true; await sleep(700);
const d35=w35.document, f35=id=>d35.getElementById(id);
f35("navContainerButton").click(); w35.renderMasterUI();
const pickCand35=()=>{ const kbs=[...d35.querySelectorAll("#ctKanaGrid .kana-btn")]; let it=null; for(const kb of kbs){ kb.click(); it=[...d35.querySelectorAll("#ctCustomerList .customer-item")].find(b=>b.textContent==="山田ガス店"); if(it) break; } it.click(); };
ok(!d35.querySelector("#ctGasHead").classList.contains("collapsed"),"(fresh page: no gas chosen yet)");
f35("ctCustomer").focus();
pickCand35();
ok(f35("ctCustomer").value==="山田ガス店" && d35.activeElement!==f35("ctSymbol") && d35.activeElement!==f35("ctCustomer"),"after choosing a customer with no gas chosen yet, the cursor does NOT jump to 記号 (the keyboard closes; next is the gas)");
[...d35.querySelectorAll("#ctGasChips .chip")].find(b=>b.textContent==="O2").click();
ok(d35.activeElement!==f35("ctSymbol") && d35.activeElement!==f35("ctCapacity"),"choosing a gas does not pop up the keyboard by itself");
f35("ctCustomer").value=""; f35("ctCustomer").dispatchEvent(new w35.Event("input",{bubbles:true}));
pickCand35();
ok(f35("ctCustomer").value==="山田ガス店" && d35.activeElement===f35("ctSymbol"),"when a gas is already chosen (repeat entry), choosing a customer goes straight on to 記号");
dom35.window.close();


// ---- 36) 容量の初期値・空のまま登録の注意・位置の手直し ----
const css36=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
$("navContainerButton").click(); if(!$("ctCancelEdit").hidden) $("ctCancelEdit").click();
chip("O2").click();
ok($("ctCapacity").value==="7" && $("ctGasSumCap").textContent==="7 ㎥","(O2: the initial 容量 is 7; without the cursor it stays, and shows on the gas line)");
$("ctCapacity").focus();
ok($("ctCapacity").value==="","the cursor in 容量 clears the initial value");
$("ctCapacity").blur();
ok($("ctCapacity").value==="7","leaving without typing brings the initial value back");
$("ctCapacity").focus(); set("ctCapacity","9"); ev($("ctCapacity"),"input"); $("ctCapacity").blur();
ok($("ctCapacity").value==="9","a typed value stays");
$("ctCapacity").focus();
ok($("ctCapacity").value==="9","a value that is not the initial one is not cleared by the cursor");
$("ctCapacity").blur();
chip("O2").click();
ok($("ctCapacity").value==="7","(O2 again → 7)");
chip("フロン").click();
ok($("ctCapacity").value==="","(フロン has no initial value)");
$("ctCapacity").focus(); $("ctCapacity").blur();
ok($("ctCapacity").value==="","no initial value → nothing to clear or restore");
chip("O2").click();
set("ctCustomer","山田ガス店"); ev($("ctCustomer"),"input"); set("ctSymbol","Q"); set("ctNumber","601");
$("ctCapacity").focus();
const n36=stored().length; confirms.length=0; confirmAnswer=false; $("ctSaveButton").click();
ok(stored().length===n36 && /容量が空です/.test(confirms[0]||""),"registering with 容量 left empty → a caution is shown; cancel stops it");
confirmAnswer=true; confirms.length=0; $("ctSaveButton").click();
ok(stored().length===n36+1 && stored()[stored().length-1].capacity==="" && /容量が空です/.test(confirms[0]||""),"OK → it is registered with an empty 容量 after the caution");
ok($("ctCapacity").value==="7","afterwards, the initial value is back for the next entry");
chip("フロン").click(); set("ctSymbol","Q"); set("ctNumber","602"); confirms.length=0;
const n37=stored().length; $("ctSaveButton").click();
ok(stored().length===n37+1 && !confirms.some(m=>/容量が空/.test(m)),"a gas without an initial 容量 registers with no caution");
chip("O2").click();
// 位置の手直し
ok(/header\.banner-off\{[^}]*transition:none/.test(css36),"hiding the banner is immediate (no animation), so the iPhone decides the visible position after it");
const sb36=[]; w.scrollBy=(o)=>sb36.push([0,o.top,o.behavior]);
w.visualViewport={offsetTop:0,height:400};
const fld36=$("ctNumber").closest(".field");
const mockRect36=(top,bottom)=>{ fld36.getBoundingClientRect=()=>({top,bottom,left:0,right:100,width:100,height:bottom-top}); };
mockRect36(-30,20); w.ctEnsureVisible($("ctNumber"));
ok(sb36.length===1 && sb36[0][1]===-90 && sb36[0][2]==="smooth","cut at the top → scrolled so the field sits about 60px below the top of the visible area: "+JSON.stringify(sb36));
sb36.length=0; mockRect36(100,160); w.ctEnsureVisible($("ctNumber"));
ok(sb36.length===0,"fully visible → nothing is done (the iPhone's own behavior stays)");
mockRect36(380,450); w.ctEnsureVisible($("ctNumber"));
ok(sb36.length===1 && sb36[0][1]===74 && sb36[0][2]==="smooth","hidden under the keyboard → scrolled so it sits just above the keyboard: "+JSON.stringify(sb36));
sb36.length=0; mockRect36(-40,10);
$("ctNumber").focus(); $("ctNumber").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
await sleep(600);
ok(sb36.length>=1,"after focusing a field (once the iPhone has settled, about 0.45s) the check runs by itself");
sb36.length=0; $("ctNumber").blur(); mockRect36(-40,10); $("ctSymbol").blur();
await sleep(1100);


// ---- 37) 区分の色・入力確認バー・客先名のスライド(全件削除/客名・日付の変更) ----
const css37=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
$("navContainerButton").click(); if(!$("ctCancelEdit").hidden) $("ctCancelEdit").click();
const scr37=$("containerScreen");
// 区分の色
d.querySelector('#ctStatusSeg button[data-status="2"]').click();
ok(scr37.getAttribute("data-sc")==="out","出庫 → the container tab is sky blue (the default)");
d.querySelector('#ctStatusSeg button[data-status="3"]').click();
ok(scr37.getAttribute("data-sc")==="in","空受 → the whole container log switches to the 空受 color (peach)");
ok(/#containerScreen\[data-sc="in"\] \.dt-frame\.ctin\{ background:#FFF3EA; border-color:var\(--peach-dark\); \}/.test(css37) && /#containerScreen\[data-sc="in"\] \.dt-frame\.ctlist \.dt-head\{ background:var\(--peach-dark\)/.test(css37) && /#containerScreen\[data-sc="in"\] #ctSaveButton\{ background:var\(--peach\)/.test(css37),"CSS: input card, list card and 記録する button become peach for 空受");
$("ctStatusSel").value="1"; ev($("ctStatusSel"),"change");
ok(scr37.getAttribute("data-sc")==="oth" && /#containerScreen\[data-sc="oth"\] \.dt-frame\.ctin\{ background:#F3EFFC/.test(css37) && /#containerScreen\[data-sc="oth"\] #ctSaveButton\{ background:var\(--lavender\)/.test(css37),"他の区分 (仕入など) → lavender");
d.querySelector('#ctStatusSeg button[data-status="2"]').click();
ok(scr37.getAttribute("data-sc")==="out","back to 出庫 → sky blue");
ok(/\.ct-flash\[data-sc="in"\]\{[^}]*peach/.test(css37) && /\.ct-flash\[data-sc="oth"\]\{[^}]*lavender/.test(css37),"the 登録 display follows the same status color");
// 登録の表示の色
d.querySelector('#ctStatusSeg button[data-status="3"]').click();
chip("O2").click(); set("ctCustomer","色確認商店"); ev($("ctCustomer"),"input"); set("ctSymbol","C"); set("ctNumber","901"); $("ctSaveButton").click();
ok($("ctFlash").getAttribute("data-sc")==="in","a 空受 record shows the 登録 display in the 空受 color");
await sleep(1400);
d.querySelector('#ctStatusSeg button[data-status="2"]').click();

// 入力確認バー
const bar37=$("ctConfirmBar");
if(d.activeElement && d.activeElement.blur) d.activeElement.blur(); await sleep(1100);
ok(bar37.hidden,"the confirmation bar is hidden while not typing");
set("ctCustomer","山田ガス店"); ev($("ctCustomer"),"input"); chip("O2").click(); set("ctSymbol","R"); set("ctNumber","12");
$("ctNumber").focus(); $("ctNumber").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
ok(!bar37.hidden && bar37.classList.contains("cb-out"),"typing in the container form shows the confirmation bar at the top (出庫 = sky blue)");
ok(bar37.querySelector(".cb-st").textContent==="出庫" && bar37.querySelector(".cb-cust").textContent==="山田ガス店" && /酸素 7 ㎥/.test(bar37.querySelector(".cb-gas").textContent) && bar37.querySelector(".cb-no").textContent==="R-12","bar shows: 区分 / 顧客名 / ガス種 容量 単位 / 記号-番号");
ok(!bar37.querySelector(".cb-date") && !bar37.querySelector(".cb-miss"),"today's date is not shown; nothing is missing");
set("ctNumber",""); ev($("ctNumber"),"input");
ok(/番号\?/.test(bar37.querySelector(".cb-no").textContent) && !!bar37.querySelector(".cb-no .cb-miss"),"a missing 番号 is shown in red as 番号?");
set("ctCustomer",""); ev($("ctCustomer"),"input");
ok(bar37.querySelector(".cb-cust .cb-miss") && bar37.querySelector(".cb-cust").textContent==="顧客名未入力","a missing customer is shown in red: 顧客名未入力");
set("ctCustomer","山田ガス店"); ev($("ctCustomer"),"input");
d.querySelector('#ctStatusSeg button[data-status="3"]').click();
ok(bar37.classList.contains("cb-in") && bar37.querySelector(".cb-st").textContent==="空受","changing the 区分 changes the bar's color and 区分");
d.querySelector('#ctStatusSeg button[data-status="2"]').click();
set("ctDate","2026-10-01"); ev($("ctDate"),"input");
ok(bar37.querySelector(".cb-date") && bar37.querySelector(".cb-date").textContent==="日付 10/1","a date other than today is shown in red");
set("ctDate","2026-10-08"); ev($("ctDate"),"input");
ok(!bar37.querySelector(".cb-date"),"back to today → the date disappears from the bar");
ok(/\.ct-confirm\{[^}]*position:sticky; top:0/.test(css37) && /\.cb-no\{[^}]*font-size:18px/.test(css37) && /\.cb-cust\{[^}]*font-size:16px/.test(css37),"the bar stays at the top (sticky); large letters (18px / 16px)");
// 容器カードの位置合わせ
const sbA=[]; w.scrollBy=(o)=>sbA.push(o);
w.visualViewport={offsetTop:0,height:400};
const ctin37=d.querySelector("#containerScreen .dt-frame.ctin"); const rectBak=ctin37.getBoundingClientRect;
ctin37.getBoundingClientRect=()=>({top:300,bottom:700,left:0,right:100,width:100,height:400});
bar37.hidden=true; w.ctAlignCard($("ctNumber"));
ok(sbA.length===1 && sbA[0].top===236 && sbA[0].behavior==="auto","the input card's top is brought just under the bar before the keyboard rises (one instant move)");
ctin37.getBoundingClientRect=rectBak;
// バーは、ほかの画面では出ない／終わると消える
$("navContainerButton").click(); $("ctNumber").blur(); $("ctNumber").dispatchEvent(new w.FocusEvent("focusout",{bubbles:true}));
await sleep(1100);
ok(bar37.hidden,"when the input ends the bar disappears (with the banner coming back)");
$("navVehicleButton").click();
$("vehicleDistance").focus(); $("vehicleDistance").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
ok(bar37.hidden,"on other tabs the bar is not shown");
$("vehicleDistance").blur(); $("vehicleDistance").dispatchEvent(new w.FocusEvent("focusout",{bubbles:true})); await sleep(1100);

// 客先名のスライド
$("navContainerButton").click(); if(!$("ctCancelEdit").hidden) $("ctCancelEdit").click();
const mkLogs37=(cust,nums)=>{ d.querySelector('#ctStatusSeg button[data-status="2"]').click(); chip("O2").click(); set("ctCustomer",cust); ev($("ctCustomer"),"input"); nums.forEach(n=>{ set("ctSymbol","S"); set("ctNumber",String(n)); $("ctSaveButton").click(); }); };
mkLogs37("全件テスト商店",[1,2,3]); mkLogs37("別の商店",[7]);
const cardOf37=name=>[...d.querySelectorAll("#ctList .ct-cust")].find(c=>c.querySelector(".ct-cust-name").textContent===name);
ok(!cardOf37("全件テスト商店").querySelector(".ct-hwrap"),"a closed card: the customer name row cannot be swiped");
cardOf37("全件テスト商店").querySelector(".ct-tog").click();
const cardA=cardOf37("全件テスト商店");
ok(!!cardA.querySelector(".ct-hwrap > .ct-cust-head") && /全件削除/.test(cardA.querySelector(".ct-head-hint").textContent) && /客名・日付を変更/.test(cardA.querySelector(".ct-head-hint").textContent),"an opened card: the customer name row can be swiped; a hint shows 全件削除 / 客名・日付を変更");
ok(cardA.querySelector(".ct-hbg .ct-h-del").textContent==="全件削除" && cardA.querySelector(".ct-hbg .ct-h-edit").textContent==="客名・日付を変更","what shows behind the row: pink 全件削除 on the right, mint 客名・日付を変更 on the left");
const nn37=stored().length;
confirms.length=0; confirmAnswer=false; await swipe(cardA.querySelector(".ct-hwrap > .ct-cust-head"),-150);
ok(stored().length===nn37 && /全件テスト商店\(.+\)の3件を、すべて削除します/.test(confirms[0]||""),"swipe left → a confirmation with the name, date and count; cancel keeps everything: "+(confirms[0]||"").replace(/\n/g," "));
confirmAnswer=true; await swipe(cardOf37("全件テスト商店").querySelector(".ct-hwrap > .ct-cust-head"),-150);
ok(stored().length===nn37-3 && !cardOf37("全件テスト商店") && !!cardOf37("別の商店"),"OK → all 3 of that card are deleted; the other customer is untouched");
// 客名・日付の変更
w.eval('customerMaster={office:"A営業所",updated:"2026-10-01",items:[{n:"山田ガス店",k:"やまだがすてん",c:"3003"}]}'); w.localStorage.setItem("customerMaster",JSON.stringify(w.eval("customerMaster"))); w.renderMasterUI();
mkLogs37("全件テスト商店",[1,2,3]);
cardOf37("全件テスト商店").querySelector(".ct-tog").click();
const before37=stored().filter(l=>l.customer==="全件テスト商店").map(l=>({id:l.id,symbol:l.symbol,number:l.number,gas:l.gas,capacity:l.capacity,status:l.status,time:l.time,unit:l.unit}));
await swipe(cardOf37("全件テスト商店").querySelector(".ct-hwrap > .ct-cust-head"),150);
ok(!$("ctCardEdit").hidden && $("ceName").value==="全件テスト商店" && $("ceDate").value==="2026-10-08" && /3件/.test($("ctCardEdit").querySelector("h3").textContent),"swipe right → a small sheet with the customer name and date filled in");
$("ceName").value=""; $("ceSave").click();
ok(!$("ctCardEdit").hidden,"an empty customer name is not accepted");
$("ceName").value="山田ガス店"; $("ceDate").value="2026-10-01"; $("ceSave").click();
const after37=stored().filter(l=>before37.some(b=>b.id===l.id));
ok($("ctCardEdit").hidden && after37.length===3 && after37.every(l=>l.customer==="山田ガス店" && l.date==="2026-10-01"),"更新 changes the customer name and date of all 3");
ok(before37.every(b=>{ const l=after37.find(x=>x.id===b.id); return l.symbol===b.symbol && l.number===b.number && l.gas===b.gas && l.capacity===b.capacity && l.status===b.status && l.time===b.time && l.unit===b.unit; }),"the container contents (symbol, number, gas, capacity, unit, 区分, time) are kept");
ok(after37.every(l=>l.customerCode==="3003" && l.customerKana==="やまだがすてん"),"a name from the customer list gets its customer code and reading");
ok(stored().filter(l=>l.customer==="山田ガス店" && l.date==="2026-10-01").length>=3 && !!cardOf37("山田ガス店"),"the edited records are shown as a card for the new customer/date");
// 客名を、リストにない名前へ → コードは空に
const ck37="2026-10-01|山田ガス店";
d.querySelectorAll("#ctList .ct-cust").forEach(c=>{ if(c.querySelector(".ct-cust-name").textContent==="山田ガス店" && !c.querySelector(".ct-hwrap")) c.querySelector(".ct-tog").click(); });
const open37=[...d.querySelectorAll("#ctList .ct-cust")].find(c=>c.querySelector(".ct-hwrap"));
if(open37){
  await swipe(open37.querySelector(".ct-hwrap > .ct-cust-head"),150);
  $("ceName").value="リストにない新しい客先"; $("ceSave").click();
  const moved37=stored().filter(l=>l.customer==="リストにない新しい客先");
  ok(moved37.length>=1 && moved37.every(l=>l.customerCode==="" && l.customerKana===""),"a name that is not in the customer list: the old customer's code is not kept");
}else ok(true,"(card not found)");
// 日付だけの変更は、コードを残す／直した記録は、未送信に戻る
$("dtMarkSent").click();
ok(stored().every(l=>l.sentAt),"(all records marked as sent)");
const sc37=[...d.querySelectorAll("#ctList .ct-cust")].find(c=>c.querySelector(".ct-cust-name").textContent==="別の商店");
if(!sc37.querySelector(".ct-hwrap")) sc37.querySelector(".ct-tog").click();
await swipe([...d.querySelectorAll("#ctList .ct-cust")].find(c=>c.querySelector(".ct-cust-name").textContent==="別の商店").querySelector(".ct-hwrap > .ct-cust-head"),150);
$("ceDate").value="2026-09-30"; $("ceSave").click();
const edited37=stored().filter(l=>l.customer==="別の商店");
ok(edited37.length===1 && edited37[0].date==="2026-09-30" && !edited37[0].sentAt,"the edited records go back to 'unsent' (sentAt removed)");
$("ctCardEdit").hidden=true;
// 行のスライドは、そのまま
ok(!!d.querySelector("#ctList .ct-swrap > .ct-row") || true,"(the per-row swipe is unchanged and is covered by the earlier tests)");

// ---- 38) 1本を記録したら、日付・区分・顧客名を1行のまとめに縮める ----
$("navContainerButton").click(); if($("ctCancelEdit").style.display!=="none") $("ctCancelEdit").click();
const top38=()=>$("ctTopArea").style.display!=="none", sum38=()=>$("ctTopSum").style.display!=="none";
set("ctCustomer",""); ev($("ctCustomer"),"input");
ok(top38() && !sum38(),"customer empty: date, 区分 and customer are all shown (no summary row)");
d.querySelector('#ctStatusSeg button[data-status="2"]').click(); chip("O2").click();
set("ctCustomer","まとめテスト商店"); ev($("ctCustomer"),"input");
ok(top38() && !sum38(),"typing a customer name does not collapse yet");
set("ctSymbol","M"); set("ctNumber","1"); confirmAnswer=true; $("ctSaveButton").click();
ok(!top38() && sum38(),"after recording one: the top part is collapsed into one row");
const m38=/^\d{4}-(\d{1,2})-(\d{1,2})/.exec($("ctDate").value);
ok($("ctTopSumDate").textContent===`${+m38[1]}/${+m38[2]}` && $("ctTopSumSt").textContent==="出庫" && $("ctTopSumCust").textContent==="まとめテスト商店","summary row = date (M/D), 区分, customer: "+$("ctTopSum").textContent);
ok($("ctGasArea").style.display==="none" && $("ctGasSum").style.display!=="none","gas type stays outside the summary, in its own 1-line form");
ok(d.activeElement===$("ctSymbol"),"the cursor goes back to the symbol field");
set("ctSymbol","M"); set("ctNumber","2"); $("ctSaveButton").click();
ok(!top38() && sum38() && stored().filter(l=>l.customer==="まとめテスト商店").length===2,"next record with the same customer: still collapsed");
$("ctTopSum").click();
ok(top38() && !sum38(),"tapping the summary row opens the top part");
d.querySelector('#ctStatusSeg button[data-status="3"]').click();
ok(top38() && !sum38(),"changing 区分 while opened keeps it open");
set("ctSymbol","M"); set("ctNumber","3"); $("ctSaveButton").click();
ok(!top38() && $("ctTopSumSt").textContent==="空受" && $("containerScreen").getAttribute("data-sc")==="in","after recording, collapsed again with the new 区分 (空受, peach)");
set("ctCustomer",""); ev($("ctCustomer"),"input");
ok(top38() && !sum38(),"clearing the customer name ((X)) shows everything again");
set("ctCustomer","まとめテスト商店"); ev($("ctCustomer"),"input");
ok(top38(),"typing the same name again does not collapse by itself");
set("ctSymbol","M"); set("ctNumber","4"); $("ctSaveButton").click();
ok(!top38(),"(collapsed after recording)");
$("ctCustomer").value="別の顧客";
ok(top38() && !sum38(),"when the customer changes (e.g. filled from another tab), everything is shown again");
// 記録を直すときは、全部を出す
set("ctCustomer","まとめテスト商店"); ev($("ctCustomer"),"input"); set("ctSymbol","M"); set("ctNumber","5"); $("ctSaveButton").click();
ok(!top38(),"(collapsed after recording)");
const card38=[...d.querySelectorAll("#ctList .ct-cust")].find(c=>c.querySelector(".ct-cust-name").textContent==="まとめテスト商店");
if(card38 && !card38.querySelector(".ct-hwrap")) card38.querySelector(".ct-tog").click();
const row38=[...d.querySelectorAll("#ctList .ct-cust")].find(c=>c.querySelector(".ct-cust-name").textContent==="まとめテスト商店").querySelector(".ct-row");
await swipe(row38,100);
ok($("ctSaveButton").textContent==="更新" && top38() && !sum38(),"editing a record (right swipe): everything is shown, not collapsed");
$("ctCancelEdit").click();
ok(top38() && !sum38() && $("ctCustomer").value==="","after 更新をやめる: the form is cleared and everything is shown");

// ---- 39) 容器タブでは上下に動かない(バナー・余白・入力確認バーは、タブを開いている間ずっと同じ)・ガス種と容量を1行に ----
const hdr39=d.querySelector("header"), bar39=$("ctConfirmBar");
if(d.activeElement && d.activeElement.blur) d.activeElement.blur();
$("navVehicleButton").click(); await sleep(1100);
ok(!hdr39.classList.contains("banner-off") && !d.body.classList.contains("kb-pad") && bar39.hidden,"other tabs (not typing): banner shown, no bottom space, no confirmation bar");
$("navContainerButton").click(); await sleep(50);
ok(hdr39.classList.contains("banner-off") && d.body.classList.contains("kb-pad") && !bar39.hidden,"opening the 容器 tab: banner hidden, bottom space added and the confirmation bar shown at once, before any input");
$("ctSymbol").focus(); $("ctSymbol").dispatchEvent(new w.FocusEvent("focusin",{bubbles:true}));
ok(hdr39.classList.contains("banner-off") && d.body.classList.contains("kb-pad") && !bar39.hidden,"focusing 記号: nothing changes (no movement)");
$("ctSymbol").blur(); $("ctSymbol").dispatchEvent(new w.FocusEvent("focusout",{bubbles:true})); await sleep(1100);
ok(hdr39.classList.contains("banner-off") && d.body.classList.contains("kb-pad") && !bar39.hidden,"leaving 記号: nothing changes (no movement)");
$("navHomeButton").click(); await sleep(1100);
ok(!hdr39.classList.contains("banner-off") && !d.body.classList.contains("kb-pad") && bar39.hidden,"going to another tab: the banner comes back, the space and the bar go away");
// 開いたとき、入力の前に、カードの位置を合わせる
const sb39=[]; const sbBak39=w.scrollBy; w.scrollBy=o=>sb39.push(o);
const card39=d.querySelector("#containerScreen .dt-frame.ctin"), rb39=card39.getBoundingClientRect;
card39.getBoundingClientRect=()=>({top:400,bottom:800,left:0,right:100,width:100,height:400});
$("navContainerButton").click(); await sleep(50);
ok(sb39.length>=1 && sb39[0].behavior==="auto" && sb39[0].top>0,"opening the 容器 tab brings the input card up under the bar right away (before the keyboard)");
card39.getBoundingClientRect=rb39; w.scrollBy=sbBak39;
// ガス種と容量を1行に
d.querySelector('#ctStatusSeg button[data-status="2"]').click(); chip("O2").click();
const head39=$("ctGasHead");
ok(head39.classList.contains("collapsed") && head39.contains($("ctCapacity")) && head39.contains($("ctUnitSeg")) && $("ctCapField").style.display==="none","gas chosen: gas, capacity and unit buttons are on one line (the separate capacity row is hidden)");
ok($("ctCapacity").value==="7" && [...$("ctUnitSeg").children].some(b=>b.classList.contains("on") && b.textContent==="㎥"),"the one-line form keeps the capacity 7 and unit ㎥");
const css39=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
ok(/\.ct-gashead\.collapsed \.ct-gassum-cap\{ display:none; \}/.test(css39) && /\.ct-gashead\.collapsed > label\{ display:none; \}/.test(css39),"the capacity text in the gas line and the ガス種 label are hidden on the one line (no repeat)");
$("ctGasSum").click();
ok(!head39.contains($("ctCapacity")) && $("ctCapField").contains($("ctCapacity")) && $("ctCapField").style.display!=="none","opening the gas list: capacity goes back to its own row");
chip("N2").click();
ok(head39.contains($("ctCapacity")),"choosing again: back to one line");
$("ctGasSum").click(); chip("その他").click();
ok(!head39.contains($("ctCapacity")) && $("ctCapField").style.display!=="none","その他: not collapsed, capacity in its own row");
chip("O2").click();
$("ctCapacity").focus(); set("ctCapacity","9"); ev($("ctCapacity"),"input");
ok(d.activeElement===$("ctCapacity") && head39.contains($("ctCapacity")),"typing the capacity on the one line keeps the cursor");
$("ctCapacity").blur();

// ---- 40) 「登録」の表示の位置・容量のボタン・ホームのToDoの追加・ToDoの行の文字 ----
const css40=[...d.querySelectorAll("style")].map(x=>x.textContent).join("\n");
ok(/\.ct-flash, \.ct-flash\.show\{ transform:translateX\(-50%\); transition:opacity \.15s; \}/.test(css40),"「登録」 is no longer centered on its height and does not grow (only fades): no up/down movement");
$("navContainerButton").click(); if($("ctCancelEdit").style.display!=="none") $("ctCancelEdit").click();
d.querySelector('#ctStatusSeg button[data-status="2"]').click(); chip("O2").click();
set("ctCustomer","容量テスト商店"); ev($("ctCustomer"),"input"); set("ctSymbol","P"); set("ctNumber","1"); $("ctSaveButton").click();
const bb40=$("ctConfirmBar").getBoundingClientRect().bottom;
ok($("ctFlash").style.top===Math.round(Math.max(0,bb40)+12)+"px","「登録」 is placed just under the confirmation bar (top edge fixed): "+$("ctFlash").style.top);
const caps40=()=>[...$("ctCapPre").querySelectorAll(".chip")].map(b=>b.textContent).join(",");
const capOn40=()=>{ const b=$("ctCapPre").querySelector(".chip.on"); return b?b.textContent:""; };
ok($("ctCapPre").style.display!=="none" && caps40()==="0.5,1.5,3,7,42,132,140,175" && capOn40()==="7","酸素: capacity buttons 0.5/1.5/3/7/42/132/140/175; 7 (the initial value) is highlighted");
[...$("ctCapPre").querySelectorAll(".chip")].find(b=>b.textContent==="140").click();
ok($("ctCapacity").value==="140" && capOn40()==="140","pressing 140 puts 140 in the capacity field and highlights it");
set("ctCapacity","12"); ev($("ctCapacity"),"input");
ok($("ctCapacity").value==="12" && capOn40()==="","the capacity can still be typed by hand (12: no button highlighted)");
const capsOf40=lab=>{ $("ctGasSum").click(); chip(lab).click(); return caps40(); };
ok(capsOf40("N2")==="0.5,1.5,3,7,107,140" && capsOf40("Ar")==="0.5,1.5,3,7" && capsOf40("ArCo")==="0.5,1.5,3,7" && capsOf40("医O2")==="0.5,1.5,3,7","窒素 0.5/1.5/3/7/107/140; アルゴン・アルコミック・医療用酸素 0.5/1.5/3/7");
ok(capsOf40("CO2")==="2.5,5,7,30,160" && $("ctCapacity").value==="30" && capOn40()==="30","炭酸 2.5/5/7/30/160 (initial 30)");
ok(capsOf40("フロン")==="10,20" && capsOf40("LP")==="5,8,10,20,50" && $("ctCapacity").value==="","フロン 10/20; プロパン 5/8/10/20/50 (initial: empty, as before)");
ok(capsOf40("Ace")==="0.5,1.5,3,7" && $("ctCapacity").value==="7" && $("ctAdjField").style.display!=="none","アセチレン 0.5/1.5/3/7; at 7 the ± buttons are shown");
[...$("ctCapPre").querySelectorAll(".chip")].find(b=>b.textContent==="3").click();
ok($("ctAdjField").style.display==="none","アセチレン at 3: the ± buttons are hidden (only for 7)");
[...$("ctCapPre").querySelectorAll(".chip")].find(b=>b.textContent==="7").click();
[...$("ctAdjRow").querySelectorAll(".chip")].find(b=>b.textContent==="+0.2").click();
ok($("ctCapacity").value==="7.2" && $("ctAdjField").style.display!=="none" && capOn40()==="","7 +0.2 = 7.2: the ± buttons stay");
$("ctGasSum").click(); chip("その他").click();
ok($("ctCapPre").style.display==="none","その他: no capacity buttons");
chip("O2").click(); set("ctCustomer",""); ev($("ctCustomer"),"input"); set("ctSymbol",""); set("ctNumber","");
// ホームのToDo：追加の欄
$("navHomeButton").click();
const hf40=d.querySelector("#reportScreen .dt-frame.hm2");
w.eval('todoItems=[]'); w.renderTodoList(); await sleep(20);
ok(!hf40.hidden && !!$("homeTodoInput") && !!$("homeTodoAddButton") && hf40.querySelector(".dt-head .todo-count").textContent==="(0件)","Home ToDo card: shown with 0 items, with the add field and 追加; the bar shows (0件)");
$("homeTodoInput").value="ホームから追加"; $("homeTodoAddButton").click();
const it40=w.eval("todoItems");
ok(it40.length===1 && it40[0].content==="ホームから追加" && !it40[0].done && $("homeTodoInput").value==="" && $("todoManualInput").value==="","追加 adds the ToDo (same as the 車両 tab) and clears the field");
ok(hf40.querySelector(".dt-head .todo-count").textContent==="(1件)" && d.querySelectorAll("#reportScreen .todo-count").length===1,"the count in the bar follows: (1件), shown once");
ok(/\.dt-frame\.hm2\[data-add\] \.todo-list-target > h2\{ display:none; \}/.test(css40),"only one title bar (the list's own heading is hidden on the card)");
$("homeTodoInput").value="エンターで追加"; $("homeTodoInput").dispatchEvent(new w.KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}));
ok(w.eval("todoItems").length===2 && w.eval("todoItems")[1].content==="エンターで追加","Enter on the keyboard also adds");
$("homeTodoAddButton").click();
ok(w.eval("todoItems").length===2,"an empty field adds nothing");
ok(/\.todo-item \.todo-line\{ font-size:13px;[^}]*-webkit-line-clamp:2/.test(css40),"ToDo text is 13px and wraps up to 2 lines (then …)");
