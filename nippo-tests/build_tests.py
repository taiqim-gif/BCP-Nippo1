h=open("harness3.html",encoding="utf-8").read()
def hrep(a,b):
    global h
    assert h.count(a)==1,(h.count(a),a[:60])
    h=h.replace(a,b)
hrep('<div id="masterKeyBox">','<div class="master-bar"><span id="masterStatus">客先名リスト：未取得</span></div>\n    <div id="masterKeyBox">')
hrep('<div class="footer-actions">','<h2 class="h2-flex"><span>訪問履歴（<span id="visitCount">0</span>件）</span></h2>\n  <div id="visitList"><div class="visit-card">（株）テスト商店</div></div>\n  <div class="footer-actions">')
hrep('<div id="toast"></div>','<div class="dial-hint">中心ほど細かく、外側ほど大きく変化</div>\n<div id="toast"></div>')
hrep('let meetingLogs=[1], dailyVehicleInfo={a:1}, todoItems=[1];','''let meetingLogs=[{createdAt:"v1",date:"2026-10-08",target:"A"},{createdAt:"v2",date:"2026-10-08",target:"B"}];
let dailyVehicleInfo={"2026-10-07":{departure:{time:"2026-10-07T08:00"},return:{time:"2026-10-07T17:00"}},"2026-10-08":{departure:{time:"2026-10-08T08:00"},return:{time:""}}};
let todoItems=[{id:"t1",done:false},{id:"t2",done:true}];
function vehicleHasData(v){return !!(v&&((v.departure&&v.departure.time)||(v.return&&(v.return.time||v.return.fuel))));}
function saveLogs(){localStorage.setItem("meetingLogs",JSON.stringify(meetingLogs));}
function saveVehicle(){localStorage.setItem("dailyVehicleInfo",JSON.stringify(dailyVehicleInfo));}
window.__mailClicks=0; document.getElementById("mailButton").addEventListener("click",()=>window.__mailClicks++);''')
hrep('function buildReportMail(){return {subject:"営業日報",body:"営業日報\\n\\n"};}','function buildReportMail(){return {subject:"営業日報",body:"営業日報 V:"+meetingLogs.length+" D:"+Object.keys(dailyVehicleInfo).length+"\\n\\n"};}')
open("harness4.html","w",encoding="utf-8").write(h)

t=open("smoke7.js",encoding="utf-8").read().replace("harness3.html","harness4.html")
def rep(a,b):
    global t
    assert t.count(a)==1,(t.count(a),a[:80])
    t=t.replace(a,b)
rep('ok(inl("editStartTime") && inl("editEndTime") && inl("vehicleDistance") && inl("meetingPersonTitle"),"inline labels: 開始/終了/走行距離/敬称");',
    'ok(inl("editStartTime") && inl("editEndTime") && inl("meetingPersonTitle") && !inl("vehicleDistance"),"inline labels: 開始/終了/敬称 (走行距離 is a normal label again)");\nconst dl=d.querySelector(\'label[for="vehicleDistance"]\');\nok(dl && dl.textContent==="走行距離" && dl.style.display!=="none" && !dl.closest(".ct-inwrap"),"走行距離: label above the field, visible");\nok(d.querySelector(".dial-hint").textContent==="中心  細かい　外側 大きい","dial hint text: "+d.querySelector(".dial-hint").textContent);')
rep('/ｱｾﾁﾚﾝ 1本\\(7\\.2\\)/.test(lines[0])','/アセチ 1本\\(7\\.2\\)/.test(lines[0])')
rep('"出庫: ｱｾﾁﾚﾝ 1本(7.2) 酸素 3本(21) フロン 1本 (no parens)"','"出庫: アセチ 1本(7.2) 酸素 3本(21) フロン 1本 (no parens)"')
rep('lines[0].indexOf("ｱｾﾁﾚﾝ")<lines[0].indexOf("酸素")','lines[0].indexOf("アセチ")<lines[0].indexOf("酸素")')
rep('!/ｱｾﾁﾚﾝ/.test(lines[1])','!/アセチ/.test(lines[1])')
rep('col(".ct-d3").join()==="ｱｾﾁﾚﾝ,酸素,酸素,酸素,フロン,酸素"','col(".ct-d3").join()==="アセチ,酸素,酸素,酸素,フロン,酸素"')
rep('col(".ct-d4").join()==="7.2kg,7㎥,7㎥,7㎥,,7㎥"','col(".ct-d4").join()==="7.2,7,7,7,,7"')
rep('"capacity column: "','"capacity column (numbers only, no unit): "')
rep('ok(/\\.ct-swrap > \\.ct-row\\.ct-drow\\{[^}]*padding:9px 0 9px 1em/.test(css) && /\\.ct-dhead\\{ padding:9px 0 3px;/.test(css),"rows indented 1 character relative to the 区分 header");',
    'ok(/\\.ct-swrap > \\.ct-row\\.ct-drow\\{[^}]*padding:9px 0;/.test(css) && !/ct-drow\\{[^}]*1em/.test(css),"明細 rows are left-aligned (no indent), same left edge as the 区分 header");')
rep('$("ctFilterDate").placeholder==="入力しない"','$("ctFilterDate").placeholder==="日付検索"')
a=t.index('const sz=(sel,px)=>'); b=t.index('// 並び替えても')
t=t[:a]+'''ok(/\\.ct-cust-name\\{[^}]*var\\(--fs-name/.test(css2) && /\\.ct-cust-sum\\{[^}]*var\\(--fs-sum/.test(css2) && /\\.ct-sum-line\\{[^}]*var\\(--fs-line/.test(css2) && /\\.ct-badge\\{[^}]*var\\(--fs-badge/.test(css2),"card text sizes are driven by variables (name/total/summary/badge)");
ok(/\\.ct-add\\{[^}]*var\\(--fs-btn/.test(css2) && /\\.ct-tog\\{[^}]*var\\(--fs-btn/.test(css2) && /\\.ct-drow\\{[^}]*var\\(--fs-row/.test(css2) && /\\.ct-swipe-hint\\{[^}]*var\\(--fs-hint/.test(css2) && /\\.ct-swbg\\{[^}]*var\\(--fs-swipe/.test(css2),"buttons / detail rows / hint / swipe labels use variables");
'''+t[b:]

for a_,b_ in [("容器ログ（変更中）","容器ログ(変更中)"),("容器ログ（追加中）","容器ログ(追加中)"),("記号（英数字）","記号(英数字)"),("番号（数字）","番号(数字)"),("給油量（L）","給油量(L)"),("条件に合う容器ログはありません（空受のみ・顧客「山田」）","条件に合う容器ログはありません(空受のみ・顧客「山田」)")]:
    t=t.replace(a_,b_)
extra=open("extra_tests.js",encoding="utf-8").read()
t=t.replace('console.log(fails?("FAILS: "+fails):"ALL PASS");',extra+'console.log(fails?("FAILS: "+fails):"ALL PASS");')
t=t.replace("const sleep=ms=>","let toasts0=0;\nconst sleep=ms=>")
open("smoke8.js","w",encoding="utf-8").write(t)
print("built")
