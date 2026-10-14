t=open("smoke8.js",encoding="utf-8").read()
def rep(a,b):
    global t
    assert t.count(a)==1,(t.count(a),a[:80])
    t=t.replace(a,b)
rep('ok($("dtMailReport").innerHTML==="日報メール送信<br>(日報・車両・容器ログ)","button 1 (2 lines): "+$("dtMailReport").innerHTML);','ok($("dtMailReport").innerHTML==="全データをメール送信<br>(日報・車両・ToDoリスト・容器ログ)","button 1 (2 lines): "+$("dtMailReport").innerHTML);')
rep('ok($("dtCsv").innerHTML==="CSVで書き出す<br>(容器ログだけ全件)","button 3 (2 lines): "+$("dtCsv").innerHTML);','ok($("dtCsv").innerHTML==="容器ログだけスマホ保存<br>(CSVファイルを保存)","button 3 (2 lines): "+$("dtCsv").innerHTML);\nok($("dtMailReport").parentNode.querySelector(".dt-desc").textContent==="未送信の全データを送る","button 1 description: "+$("dtMailReport").parentNode.querySelector(".dt-desc").textContent);')
rep('ok(/← 削除/.test(d.querySelector("#ctList .ct-swipe-hint").textContent) && /変更 →/.test(d.querySelector("#ctList .ct-swipe-hint").textContent),"swipe hint shown");','ok(/←削除/.test(d.querySelector("#ctList .ct-swipe-hint").textContent) && /変更→/.test(d.querySelector("#ctList .ct-swipe-hint").textContent),"swipe hint shown: "+d.querySelector("#ctList .ct-swipe-hint").textContent);')
open("smoke8.js","w",encoding="utf-8").write(t)
print("post2")
