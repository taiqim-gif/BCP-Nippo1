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
open("smoke8.js","w",encoding="utf-8").write(t)
print("post7")
