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
# 39) 容器タブの間は、バナー・余白・入力確認バーを出し入れしない。ガス種・容量を1行に
rep('ok(!hdr32.classList.contains("banner-off"),"the banner comes back about 0.2s after the input ends");','ok(hdr32.classList.contains("banner-off"),"on the 容器 tab the banner stays hidden after the input ends (no up/down movement)");')
rep('ok(!hdr32.classList.contains("banner-off"),"(and it returns)");','ok(hdr32.classList.contains("banner-off"),"(on the 容器 tab it still stays hidden)");')
rep('ok(!d.body.classList.contains("kb-pad"),"no extra bottom space while not typing");','ok(d.body.classList.contains("kb-pad"),"on the 容器 tab the bottom space is kept even while not typing (no jump)");')
rep('ok(!d.body.classList.contains("kb-pad") && !d.querySelector("header").classList.contains("banner-off"),"the space is removed together with the banner coming back");','ok(d.body.classList.contains("kb-pad") && d.querySelector("header").classList.contains("banner-off"),"on the 容器 tab the space and the hidden banner stay after the input ends");')
rep('ok(bar37.hidden,"the confirmation bar is hidden while not typing");','ok(!bar37.hidden,"on the 容器 tab the confirmation bar is shown even while not typing");')
rep('ok(bar37.hidden,"when the input ends the bar disappears (with the banner coming back)");','ok(!bar37.hidden,"on the 容器 tab the bar stays after the input ends (no up/down movement)");')
rep('before35($("ctCustomer"),$("ctGasChips")) && before35($("ctGasChips"),$("ctCapacity"))','before35($("ctCustomer"),$("ctGasSum")) && before35($("ctGasSum"),$("ctCapacity"))')
# 40) ToDo：□を小さく(1.2倍)・ホームは0件でもカードを出す(追加の欄)・件数はカードの帯に
rep('ok(/\\.todo-item input\\[type=checkbox\\]\\{ transform:scale\\(1\\.55\\); margin:0 9px 0 7px; \\}/.test(css31),"the □ is larger (about 30px)");','ok(/\\.todo-item input\\[type=checkbox\\]\\{ transform:scale\\(1\\.2\\); margin:0 5px 0 3px; \\}/.test(css31),"the □ is a little larger (1.2x), smaller than before so the text has more room");')
rep('ok(hf[1].hidden,"ToDoリスト card is hidden while there is no ToDo");','ok(!hf[1].hidden && hf[1].contains($("homeTodoInput")),"ToDoリスト card is shown even with no ToDo (so the add field can be used)");')
rep('const hh31=d.querySelector("#reportScreen .todo-list-target > h2");\nok(!!hh31 && !!hh31.querySelector(".todo-count") && hh31.querySelector(".todo-count").textContent==="(2件)"','const hh31=d.querySelector("#reportScreen .dt-frame.hm2 > .dt-head");\nok(!!hh31 && !!hh31.querySelector(".todo-count") && hh31.querySelector(".todo-count").textContent==="(2件)"')
rep('ok(d.querySelector("#reportScreen .todo-list-target > h2 .todo-count").textContent==="(3件)"','ok(d.querySelector("#reportScreen .dt-frame.hm2 > .dt-head .todo-count").textContent==="(3件)"')
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
