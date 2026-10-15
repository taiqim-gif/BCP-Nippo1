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
