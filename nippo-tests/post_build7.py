t=open("smoke8.js",encoding="utf-8").read()
def rep(a,b,n=1):
    global t
    assert t.count(a)==n,(t.count(a),a[:90])
    t=t.replace(a,b)
rep('ok($("dtMailReport").innerHTML==="全データをメール送信<br>(日報・車両・ToDo・容器)","button 1 (2 lines): "+$("dtMailReport").innerHTML);','ok($("dtMailReport").innerHTML==="全データをメール送信<br>(CSV添付)","button 1 (2 lines): "+$("dtMailReport").innerHTML);')
rep('ok($("dtMailReport").innerHTML==="全データをメール送信<br>(日報・車両・ToDo・容器)","button 1 line 2: (日報・車両・ToDo・容器)");','ok($("dtMailReport").innerHTML==="全データをメール送信<br>(CSV添付)","button 1 line 2: (CSV添付)");')
rep('$("dtMailReport").click();\nok(w.__mailClicks===1,"日報メール送信 → triggers the existing mail button");','ok(true,"(the 全データ mail is now the CSV mail; see section 31)");')
rep('ok($("ctFlash").classList.contains("show") && $("ctFlash").textContent==="登録","「登録」 shown big right after recording");','ok($("ctFlash").classList.contains("show") && $("ctFlash").querySelector(".ct-flash-main").textContent==="登録" && $("ctFlash").querySelector(".ct-flash-cust").textContent==="△△工業" && $("ctFlash").querySelector(".ct-flash-gas").textContent==="酸素　O2　7 ㎥","「登録」 shown right after recording, with the customer name and the gas / capacity / unit below it (horizontal)");')
rep('ok(!$("ctFlash").classList.contains("show"),"「登録」 disappears after ~0.8s");','ok($("ctFlash").classList.contains("show"),"「登録」 is still shown at ~0.9s (it stays about 1.2s)");\nawait sleep(500);\nok(!$("ctFlash").classList.contains("show"),"「登録」 disappears after ~1.2s");')
rep('ok(/\\.ct-flash\\{[^}]*font-size:64px/.test(css2),"「登録」 is large");','ok(/\\.ct-flash-main\\{[^}]*font-size:28px/.test(css2) && /\\.ct-flash\\{[^}]*writing-mode:horizontal-tb/.test(css2),"「登録」 is large and horizontal");')
rep('before35($("ctCustomer"),$("ctGasChips")) && before35($("ctGasChips"),$("ctCapacity"))','before35($("ctCustomer"),$("ctGasHead")) && before35($("ctGasHead"),$("ctCapacity"))')
# 40) ToDo：□を小さく(1.2倍)・ホームは0件でもカードを出す(追加の欄)・件数はカードの帯に
rep('ok(/\\.todo-item input\\[type=checkbox\\]\\{ transform:scale\\(1\\.55\\); margin:0 9px 0 7px; \\}/.test(css31),"the □ is larger (about 30px)");','ok(/\\.todo-item input\\[type=checkbox\\]\\{ transform:scale\\(1\\.2\\); margin:0 5px 0 3px; \\}/.test(css31),"the □ is a little larger (1.2x), smaller than before so the text has more room");')
rep('ok(hf[1].hidden,"ToDoリスト card is hidden while there is no ToDo");','ok(!hf[1].hidden && hf[1].contains($("homeTodoInput")),"ToDoリスト card is shown even with no ToDo (so the add field can be used)");')
rep('const hh31=d.querySelector("#reportScreen .todo-list-target > h2");\nok(!!hh31 && !!hh31.querySelector(".todo-count") && hh31.querySelector(".todo-count").textContent==="(2件)"','const hh31=d.querySelector("#reportScreen .dt-frame.hm2 > .dt-head");\nok(!!hh31 && !!hh31.querySelector(".todo-count") && hh31.querySelector(".todo-count").textContent==="(2件)"')
rep('ok(d.querySelector("#reportScreen .todo-list-target > h2 .todo-count").textContent==="(3件)"','ok(d.querySelector("#reportScreen .dt-frame.hm2 > .dt-head .todo-count").textContent==="(3件)"')
# 41) 容器タブ：記号・番号・記録するを、上のカード(固定)へ。縮める動きは、やめる
rep('ok(lab("ctSymbol") && lab("ctSymbol").textContent==="記号(英数字)" && lab("ctNumber") && lab("ctNumber").textContent==="番号(数字)","container: 記号/番号 labels restored");','ok($("ctSymbol").getAttribute("aria-label")==="記号(英数字)" && $("ctNumber").getAttribute("aria-label")==="番号(数字)" && !!$("ctSymbol").closest("#ctConfirmBar"),"container: 記号/番号 are in the top card (named 記号(英数字)/番号(数字))");')
rep('$("ctSymbol").placeholder==="例：AB1" && $("ctNumber").placeholder==="例：12345","placeholders: 顧客名/容量, 例：AB1/例：12345");','$("ctSymbol").placeholder==="記号" && $("ctNumber").placeholder==="番号","placeholders: 顧客名/容量, 記号/番号");')
rep('ok(lab("ctNumber").parentNode===$("ctNumKb").parentNode && lab("ctNumber").parentNode.classList.contains("ct-lbrow"),"ABC button on the same row as the 番号 label");','ok(!!$("ctNumKb").closest("#ctConfirmBar .cb-l2"),"ABC button is on the 2nd row of the top card");')
rep('ok(d.querySelectorAll("#containerScreen .ct-lbrow").length===2 && $("ctSymbol").previousElementSibling.classList.contains("ct-lbrow") && $("ctNumber").previousElementSibling.classList.contains("ct-lbrow"),"記号 and 番号 labels are in same-height rows (aligned inputs)");','ok($("ctSymbol").parentNode===$("ctNumber").parentNode && $("ctSymbol").parentNode.classList.contains("cb-l3"),"記号 and 番号 are side by side on one row of the top card (aligned inputs)");')
rep('ok(before35($("ctCustomer"),$("ctGasHead")) && before35($("ctGasHead"),$("ctCapacity")) && before35($("ctCapacity"),$("ctSymbol")) && before35($("ctSymbol"),$("ctNumber")) && before35($("ctNumber"),$("ctSaveButton")),"display and tab order: 顧客名 → ガス種 → 容量 → 記号 → 番号 → 記録する");','ok(before35($("ctCustomer"),$("ctGasHead")) && before35($("ctGasHead"),$("ctCapacity")) && before35($("ctSymbol"),$("ctNumber")) && before35($("ctNumber"),$("ctSaveButton")) && before35($("ctConfirmBar"),$("containerScreen")),"order: the top card (記号 → 番号 → 記録する) above; the lower part 顧客名 → ガス種 → 容量");')
rep('ok(before35($("ctUnitSeg"),$("ctSymbol")) && before35($("ctAdjField"),$("ctSymbol")),"the unit buttons and the アセチレン adjust buttons stay with the capacity (above 記号)");','ok(before35($("ctCapacity"),$("ctUnitSeg")) && before35($("ctUnitSeg"),$("ctAdjField")),"the unit buttons and the アセチレン adjust buttons stay with the capacity");')
# 42) 下のカードは「選択」(項目ごとに出す)。変更中・追加中は、上のカードに出す
rep('$("ctTitle").textContent==="容器ログ(変更中)","right swipe → 変更 state: 更新 / 更新をやめる");','$("ctConfirmBar").querySelector(".cb-tag").textContent==="変更中","right swipe → 変更 state: 更新 / 更新をやめる (変更中 on the top card)");')
rep('ok($("ctTitle").textContent==="容器ログ(追加中)" && $("ctCustomer").value==="〇〇商店","＋追加 starts adding for that customer");','ok($("ctConfirmBar").querySelector(".cb-tag").textContent==="追加中" && $("ctCustomer").value==="〇〇商店","＋追加 starts adding for that customer (追加中 on the top card)");')
rep('ok(/容器ログ/.test(d.querySelector("#containerScreen .dt-head").textContent),"容器 tab keeps its own 「容器ログ」 heading");','ok(/^選択/.test(d.querySelector("#containerScreen .dt-head").textContent) && /容器ログ/.test(d.querySelector("#containerScreen .dt-frame.ctlist .dt-head").textContent),"容器 tab: the input card is 「選択」, the list keeps its 「容器ログ」 heading");')
# v15) 送る枠の作り直し:「まだ送っていない分を送る」+「送れたら押す：送信済みにする」/「○月分をまとめて送る」。容器だけのボタンはなくした
rep(r'''ok($("dtMailReport").innerHTML==="全データをメール送信<br>(CSV添付)","button 1 (2 lines): "+$("dtMailReport").innerHTML);
ok($("dtMailCsv").innerHTML==="容器だけメール送信<br>(CSV添付)","button 2 (2 lines): "+$("dtMailCsv").innerHTML);
ok($("dtCsv").innerHTML==="容器だけスマホ保存<br>(CSV保存)","button 3 (2 lines): "+$("dtCsv").innerHTML);
ok($("dtMailReport").parentNode.querySelector(".dt-desc").textContent==="未送信の全データを送る","button 1 description: "+$("dtMailReport").parentNode.querySelector(".dt-desc").textContent);
ok($("dtMarkSent").textContent==="送信済みにする" &&''', r'''ok($("dtMailReport").innerHTML==="まだ送っていない分を送る<br>(CSV・バックアップ添付)","button 1 (2 lines): "+$("dtMailReport").innerHTML);
ok(!$("dtMailCsv") && !$("dtCsv"),"the container-only buttons are gone (v15)");
ok(/^訪問 \d+件・車両 \d+日・容器 \d+本・ToDo \d+件$/.test($("dtMailReportDesc").textContent),"button 1 description: the counts to send: "+$("dtMailReportDesc").textContent);
ok($("dtMarkSent").textContent==="送れたら押す：送信済みにする" &&''')
rep(r'''ok($("dtMailCsvDesc").textContent===`未送信 ${ct0}本` && $("dtCsvDesc").textContent===`全件 ${ct0}本を保存`,"short descriptions: "+$("dtMailCsvDesc").textContent+" / "+$("dtCsvDesc").textContent);''',
    r'''ok($("dtMailReportDesc").textContent.includes(`容器 ${ct0}本`),"the description has the unsent container count: "+$("dtMailReportDesc").textContent);''')
rep(r'''toasts0=w.eval("toasts.length"); $("dtMailCsv").click(); await sleep(60);
ok(w.eval("toasts").slice(toasts0).includes("未送信の容器はありません"),"mail CSV with nothing unsent → message");''', r'''ok(true,"(the container-only mail is gone in v15)");''')
rep(r'''$("dtMailCsv").click(); await sleep(60);
ok(shared.length===1 && /^容器ログ_\d{8}\.csv$/.test(shared[0][0]) && /csv/.test(shared[0][1]),"mail CSV: shared as a csv file (attach via share sheet): "+shared[0]);
$("dtCsv").click(); await sleep(60);
ok(shared.length===2 && /^容器ログ全件_\d{8}\.csv$/.test(shared[1][0]),"CSV export (all): "+shared[1][0]);
$("dtBackup").click(); await sleep(60);
ok(shared.length===3 && /バックアップ/.test(shared[2][0]) &&''', r'''$("dtMailReport").click(); await sleep(60);
ok(shared.length===1 && /^日報_\d{8}\.csv$/.test(shared[0][0]) && /csv/.test(shared[0][1]),"mail: shared as one csv file (attach via share sheet): "+shared[0]);
ok(!!w.localStorage.getItem("lastBackupAt"),"the mail also counts as a backup (the backup is attached)");
w.localStorage.removeItem("lastBackupAt");
$("dtBackup").click(); await sleep(60);
ok(shared.length===2 && /バックアップ/.test(shared[1][0]) &&''')
rep(r'''dl2.length=0; $("dtMailCsv").click(); await sleep(80);
ok(dl2.length===1 && /^容器ログ_/.test(dl2[0]),"no share sheet: file is downloaded, mail draft opens");''', r'''dl2.length=0; $("dtMailReport").click(); await sleep(80);
ok(dl2.length===2 && /^日報_/.test(dl2[0]) && /^営業日報バックアップ_/.test(dl2[1]),"no share sheet: the CSV and the backup are downloaded, mail draft opens: "+dl2.join());''')
rep(r'''ok($("dtMailReport").innerHTML==="全データをメール送信<br>(CSV添付)","button 1 line 2: (CSV添付)");
ok($("dtCsv").innerHTML==="容器だけスマホ保存<br>(CSV保存)","button 3: 容器だけスマホ保存 / (CSV保存)");
ok($("dtMailCsv").innerHTML==="容器だけメール送信<br>(CSV添付)","button 2: 容器だけメール送信 / (CSV添付)");''', r'''ok($("dtMailReport").innerHTML==="まだ送っていない分を送る<br>(CSV・バックアップ添付)","button 1 line 2: (CSV・バックアップ添付)");''')
# v15) 1つのCSV(区切りの行 [訪問] [車両] [ToDo] [容器])とバックアップを添付する
rep(r'''const rd31=f=>new Promise(r=>{ const fr=new w.FileReader(); fr.onload=()=>r(fr.result); fr.readAsText(f); });
ok(!!shared31 && shared31.files.map(f=>f.name).join()==="訪問_20261008.csv,車両_20261008.csv,ToDo_20261008.csv,容器ログ_20261008.csv","全データ: 4 CSV files are attached together: "+(shared31?shared31.files.map(f=>f.name).join(" "):"(not shared)"));
const csv31=await Promise.all(shared31.files.map(rd31));''', r'''const rd31=f=>new Promise(r=>{ const fr=new w.FileReader(); fr.onload=()=>r(fr.result); fr.readAsText(f); });
// 1つのCSVから、区切りの行 [名前] の表だけを取り出す
const sec31=(txt,lab)=>{ const L=String(txt).replace(/^﻿/,"").split("\r\n"); const i=L.indexOf("["+lab+"]"); if(i<0) return ""; let j=i+1; while(j<L.length && !/^\[(訪問|車両|ToDo|容器)\]$/.test(L[j])) j++; return L.slice(i+1,j).join("\r\n"); };
ok(!!shared31 && shared31.files.map(f=>f.name).join()==="日報_20261008.csv,営業日報バックアップ_20261008.json","1 CSV and the backup are attached together: "+(shared31?shared31.files.map(f=>f.name).join(" "):"(not shared)"));
const all31=await rd31(shared31.files[0]);
ok(all31.split("\r\n").filter(x=>/^\[.+\]$/.test(x)).join()==="[訪問],[車両],[ToDo],[容器]","the CSV has the 4 section lines in order");
const csv31=["訪問","車両","ToDo","容器"].map(x=>sec31(all31,x));
ok(shared31.files[1].type==="application/json" && /"app":"eigyo-nippo"/.test(await rd31(shared31.files[1])),"the backup (.json) is the same as 「バックアップ保存」");''')
rep(r'''const names50=shared50?shared50.files.map(f=>f.name).join():"";
ok(/^訪問_佐藤_\d{8}\.csv,ToDo_佐藤_\d{8}\.csv(,容器ログ_佐藤_\d{8}\.csv)?$/.test(names50) && /佐藤/.test(shared50.title),"file names and the title have the name: "+names50+" / "+(shared50&&shared50.title));
const csv50=await Promise.all(shared50.files.map(rd31));''', r'''const names50=shared50?shared50.files.map(f=>f.name).join():"";
ok(/^日報_佐藤_\d{8}\.csv,営業日報バックアップ_\d{8}\.json$/.test(names50) && /佐藤/.test(shared50.title),"file names and the title have the name: "+names50+" / "+(shared50&&shared50.title));
const all50=await rd31(shared50.files[0]);
const csv50=[sec31(all50,"訪問"),sec31(all50,"ToDo")];
ok(!all50.includes("[車両]"),"tables with no rows are left out");''')
# v15) 月分:1つのCSV(容器も)+バックアップ。送れたら、その月の分をスマホから消す
rep(r'''ok(new RegExp(`^訪問_佐藤_${pm50.replace("-","")}月分\.csv,車両_佐藤_${pm50.replace("-","")}月分\.csv,ToDo_佐藤_${pm50.replace("-","")}月分\.csv$`).test(mnames) && /運転日報/.test(shared50.title),"the monthly send attaches 3 CSVs (all of last month): "+mnames);''',
    r'''ok(new RegExp(`^日報_佐藤_${pm50.replace("-","")}月分\.csv,営業日報バックアップ_\\d{8}\\.json$`).test(mnames) && /運転日報/.test(shared50.title),"the monthly send attaches 1 CSV and the backup (all of last month): "+mnames);''')
rep(r'''confirmAnswer=true;
bnH.querySelector(".ct-monthly-send").click(); await sleep(600);
ok(w.localStorage.getItem("monthlyReportSent")===pm50 && bnH.hidden && bnV.hidden,"'OK' hides the notice until the next month");
$("navDataButton").click();
ok(/訪問 1・車両 1/.test($("dtMailMonthDesc").textContent),"データ → 先月分をメール送信 shows the counts: "+$("dtMailMonthDesc").textContent);''', r'''$("navDataButton").click();
ok(/訪問 1・車両 1・容器 \d+・ToDo 1/.test($("dtMailMonthDesc").textContent) && /スマホから消します/.test($("dtMailMonthDesc").textContent),"データ → the monthly button shows the counts: "+$("dtMailMonthDesc").textContent);
ok($("dtMailMonth").innerHTML===`${pmLabel}分をまとめて送る<br>(CSV・バックアップ添付)`,"the monthly button has the month name: "+$("dtMailMonth").innerHTML);
confirmAnswer=true; const c50c=confirms.length;
bnH.querySelector(".ct-monthly-send").click(); await sleep(600);
ok(w.localStorage.getItem("monthlyReportSent")===pm50 && bnH.hidden && bnV.hidden,"'OK' hides the notice until the next month");
ok(/スマホから消します/.test(confirms[c50c+1]||"") && /訪問 1件・車両 1日・容器 \d+本・済ToDo 1件/.test(confirms[c50c+1]||""),"then it asks to delete the month, with the counts: "+(confirms[c50c+1]||"").split("\n").slice(0,2).join(" / "));
ok(w.eval("meetingLogs.length")===0 && w.eval(`Object.keys(dailyVehicleInfo).filter(k=>k.startsWith("${pm50}")).length`)===0 && !/z1/.test(w.localStorage.getItem("todoArchive")||""),"'OK' deletes the month (visits, vehicle days, the finished ToDo in the auto-save)");''')
rep(r'''shared50=null; $("dtBackup").click(); await sleep(300);''', r'''w.localStorage.setItem("todoArchive",JSON.stringify([{id:"z1",done:true}]));
shared50=null; $("dtBackup").click(); await sleep(300);''')
open("smoke8.js","w",encoding="utf-8").write(t)
print("post7")

h=open("harness4.html",encoding="utf-8").read()
a='<section id="vehicleScreen" class="screen">'
assert h.count(a)==1
h=h.replace(a,a+'\n  <div class="card"><div class="field"><input type="text" id="todoManualInput"></div><button id="todoAddButton">追加</button></div>')
b='</script>\n<script src="container.js"></script>'
assert h.count(b)==1
h=h.replace(b,'document.getElementById("todoAddButton").addEventListener("click",()=>{const i=document.getElementById("todoManualInput");const t=i.value.trim();if(!t)return;todoItems.push({id:"m"+Date.now(),date:getToday(),target:"",content:t,done:false,source:"manual",order:9999});i.value="";if(typeof renderTodoList==="function")renderTodoList();});\n'+b)
open("harness4.html","w",encoding="utf-8").write(h)

# 確認用の画面に、顧客リストの取り込みの最後の処理(saveMasterData)を足す(本物の index.html と同じ働き)
h=open("harness4.html",encoding="utf-8").read()
b='</script>\n<script src="container.js"></script>'
assert h.count(b)==1
h=h.replace(b,'function saveMasterData(data){ customerMaster={office:data.office||"",updated:data.updated||"",items:data.items}; localStorage.setItem("customerMaster",JSON.stringify(customerMaster)); if(typeof renderMasterUI==="function") renderMasterUI(); showToast("客先名リストを取り込みました"); }\n'+b)
open("harness4.html","w",encoding="utf-8").write(h)

# 確認用の画面に、ホームの訪問先の候補の一覧(#customerList)を足す(本物の index.html と同じ部品)
h=open("harness4.html",encoding="utf-8").read()
a='<input type="text" id="homeVisitTarget" placeholder="例：〇〇商店"></div>'
assert h.count(a)==1, h.count(a)
h=h.replace(a,a+'<div class="customer-list" id="customerList" style="display:none;"></div>')
open("harness4.html","w",encoding="utf-8").write(h)
