# harness4.html / smoke8.js を、新しい画面・機能に合わせて仕上げる
h=open("harness4.html",encoding="utf-8").read()
def hrep(a,b):
    global h
    assert h.count(a)==1,(h.count(a),a[:60])
    h=h.replace(a,b)
hrep('<section id="vehicleScreen" class="screen">','<section id="vehicleScreen" class="screen">\n  <h2>車両情報</h2>\n  <div class="card"><div style="display:flex;justify-content:space-between;"><strong id="vehicleModeLabel">出発</strong><span class="status-pill" id="vehicleStatusPill">未出発</span></div></div>')
hrep('</section>\n</main>','  <h2 class="h2-flex"><span>TODOリスト</span><span class="h2-note">消す=コピー可</span></h2>\n  <div class="todo-list-target"></div>\n</section>\n</main>')
hrep('<div class="field"><label for="meetingContent">内容</label><textarea id="meetingContent"></textarea></div>','<div class="field"><label for="meetingContent">内容</label><textarea id="meetingContent"></textarea></div>\n  <div class="field" id="visitStatusField"><div style="display:flex;"><span class="status-pill on">訪問中</span></div><label for="visitStartTimeInput">開始時刻</label><input type="time" id="visitStartTimeInput"></div>\n  <div class="field"><label for="meetingNotes">特記事項</label><textarea id="meetingNotes"></textarea></div>\n  <div id="meetingCard" style="display:block"><button id="endButton">記録終了</button></div>')
hrep('function deleteData(){','function goToVisit(){ showScreen("visit"); updateNav("visit"); }\nfunction setMasterMessage(t,e){ window.__lastMsg=t; }\nfunction renderMasterUI(){ document.getElementById("masterStatus").textContent = customerMaster ? "客先名リスト："+(customerMaster.office||"")+" "+customerMaster.items.length+"件" : "客先名リスト：未取得"; }\nfunction renderTodoList(){ document.querySelectorAll(".todo-list-target").forEach(c=>{ c.innerHTML=\'<h2 class="h2-flex"><span>TODOリスト</span><span class="h2-note">消す=コピー可</span></h2>\'; }); }\nfunction deleteData(){')
open("harness4.html","w",encoding="utf-8").write(h)

t=open("smoke8.js",encoding="utf-8").read()
a='resources:"usable",pretendToBeVisual:true});'
assert t.count(a)==1,t.count(a)
seed='{office:"A営業所",updated:"2026-10-01",items:[{n:"〇〇商店",k:"あまる",c:"1001"},{n:"△△工業",k:"かさん",c:"2002"},{n:"山田ガス店",k:"やまだがすてん",c:"3003"}]}'
t=t.replace(a,'resources:"usable",pretendToBeVisual:true,beforeParse(w){ w.localStorage.setItem("customerMaster",JSON.stringify('+seed+')); }});')
old='lab("ctNumber").parentNode.style.display==="flex"'
assert t.count(old)==1
t=t.replace(old,'lab("ctNumber").parentNode.classList.contains("ct-lbrow")')
open("smoke8.js","w",encoding="utf-8").write(t)
print("post-built")
