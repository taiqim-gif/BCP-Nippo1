t=open("smoke8.js",encoding="utf-8").read()
def rep(a,b):
    global t
    assert t.count(a)==1,(t.count(a),a[:90])
    t=t.replace(a,b)
rep(r"/\.done-item \.line-done\{[^}]*line-through[^}]*#D64545/.test(cssT) && /\.done-item \.done-suffix\{[^}]*#D64545/.test(cssT)", r"/\.done-item \.line-done\{[^}]*line-through/.test(cssT) && /\.done-item \.done-suffix\{[^}]*rgba\(214,69,69/.test(cssT)")
open("smoke8.js","w",encoding="utf-8").write(t)
print("post5")
