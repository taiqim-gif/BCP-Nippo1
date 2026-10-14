h=open("harness4.html",encoding="utf-8").read()
def hrep(a,b):
    global h
    assert h.count(a)==1,(h.count(a),a[:70])
    h=h.replace(a,b)
# 車両：出発・帰社のモード切り替えボタン(色は、ボタン自身の色を読む)
hrep('<div class="field"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;"><label for="vehicleDistance"','<div><button class="mode-switch-btn" style="background:rgb(204,235,222)">出発</button><button class="mode-switch-btn" style="background:rgb(255,214,194)">帰社</button></div><div class="field"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;"><label for="vehicleDistance"')
# ホーム：ToDoの置き場と、訪問履歴
hrep('<h2 class="h2-flex"><span>訪問履歴（','<div class="todo-list-target" data-hide-empty="1"></div>\n  <h2 class="h2-flex"><span>訪問履歴（')
open("harness4.html","w",encoding="utf-8").write(h)
print("post6")
