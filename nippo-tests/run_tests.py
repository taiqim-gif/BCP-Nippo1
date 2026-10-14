# -*- coding: utf-8 -*-
"""営業日報アプリ(container.js)の自動確認を、まとめて実行する。

使い方(このフォルダで):
    python run_tests.py            ... 親フォルダ(../container.js)か、このフォルダの container.js を確認する
    python run_tests.py 別の場所/container.js

必要なもの: Python 3 と Node.js(jsdom は、初回に自動で入る)
結果: 最後に「ALL PASS」と出れば、すべて合格。FAIL の行があれば、その項目が不合格。
所要時間: 約2〜3分(待ち時間のある確認を含む)
"""
import functools, http.server, os, shutil, socketserver, subprocess, sys, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

# 確認する container.js を決める
cands = [sys.argv[1]] if len(sys.argv) > 1 else [os.path.join(HERE, "..", "container.js"), os.path.join(HERE, "container.js")]
src = next((p for p in cands if os.path.exists(p)), None)
if not src:
    sys.exit("container.js が見つかりません。親フォルダか、このフォルダに置いてください。")
if os.path.abspath(src) != os.path.join(HERE, "container.js"):
    shutil.copyfile(src, os.path.join(HERE, "container.js"))
print("確認する container.js:", os.path.abspath(src))

# jsdom を入れる(初回だけ)
if not os.path.isdir(os.path.join(HERE, "node_modules", "jsdom")):
    print("jsdom を入れています(初回だけ)...")
    subprocess.check_call(["npm", "install", "--no-audit", "--no-fund"], shell=(os.name == "nt"))

# 確認用の画面(harness4.html)と、確認の台本(smoke8.js)を作る。順番が大事
for s in ["build_tests.py", "post_build.py", "post_build2.py", "post_build3.py", "post_build4.py",
          "post_build6.py", "post_build5.py", "post_build7.py"]:
    subprocess.check_call([sys.executable, s], stdout=subprocess.DEVNULL)

# 確認用の小さなサーバー(8765番)を、背景で動かす
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", 8765), functools.partial(Quiet, directory=HERE))
threading.Thread(target=srv.serve_forever, daemon=True).start()
time.sleep(0.5)

try:
    out = subprocess.run(["node", "smoke8.js"], capture_output=True, text=True, encoding="utf-8", errors="replace", shell=(os.name == "nt"))
finally:
    srv.shutdown()

text = (out.stdout or "") + (out.stderr or "")
open(os.path.join(HERE, "smoke8.out"), "w", encoding="utf-8").write(text)
lines = text.splitlines()
print("合格の項目数:", sum(1 for l in lines if l.startswith("PASS ")))
bad = [l for l in lines if l.startswith("FAIL") or "Error" in l]
for l in bad: print(l[:300])
print("ALL PASS" if out.returncode == 0 and not bad else "不合格があります(smoke8.out に全部の結果があります)")
sys.exit(0 if out.returncode == 0 and not bad else 1)
