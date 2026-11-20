// v25:「あ〜わ」のボタンを押すたびに絞り込む確認(本物の index.html + container.js を使う)
// 1回目=行全部、2回目=2文字目から下(い〜お)、…、最後の次は行全部に戻る。濁点・小さい字は元の字と同じに扱う
// データは架空のもの。使い方: node kana_tap_test.js(run_tests.py からも呼ばれる)
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const containerJs = fs.readFileSync(path.join(ROOT, "container.js"), "utf8");
const appHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
  .replace('<script src="container.js"></script>', () => "<script>" + containerJs.replace(/<\/script>/g, "<\\/script>") + "</script>");

let fails = 0;
function check(name, ok, info){
  console.log((ok ? "PASS " : "FAIL ") + "かな: " + name + (ok || info === undefined ? "" : " / " + info));
  if(!ok) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const master = { office:"架空営業所", updated:"2026-11-20", items:[
  { c:"K01", n:"あおば商店", k:"アオバショウテン" },
  { c:"K02", n:"いずみ工業", k:"イズミコウギョウ" },
  { c:"K03", n:"うみの屋",   k:"ウミノヤ" },
  { c:"K04", n:"ヴィラ見本", k:"ヴィラミホン" },
  { c:"K05", n:"えだ産業",   k:"エダサンギョウ" },
  { c:"K06", n:"おかガス",   k:"オカガス" },
  { c:"K07", n:"かわ電機",   k:"カワデンキ" },
  { c:"K08", n:"ぎんが製作", k:"ギンガセイサク" },
  { c:"K09", n:"ごとう店",   k:"ゴトウテン" },
  { c:"K10", n:"やま酸素",   k:"ヤマサンソ" },
  { c:"K11", n:"ゆき工房",   k:"ユキコウボウ" },
  { c:"K12", n:"よし運送",   k:"ヨシウンソウ" }
]};

(async () => {
  const dom = new JSDOM(appHtml, {
    runScripts: "dangerously",
    url: "https://example.test/index.html",
    beforeParse(win){
      win.localStorage.setItem("customerMaster", JSON.stringify(master));
      win.confirm = () => true;
      win.alert = () => {};
      win.scrollTo = () => {};
      win.HTMLElement.prototype.scrollIntoView = function(){};
      win.matchMedia = win.matchMedia || (() => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
      win.fetch = () => Promise.reject(new Error("offline"));
    }
  });
  const win = dom.window, doc = win.document;
  await sleep(500);

  // 中の決まり(行と段階)
  const m = win.ctKanaStepMatch, nx = win.ctKanaNext;
  check("1回目(行全部)は あ〜お が全部入る", ["アオバ","イズミ","ウミ","エダ","オカ"].every(k => m(k, "あ", 0)));
  check("2回目は い〜お(あは入らない)", !m("アオバ","あ",1) && ["イズミ","ウミ","エダ","オカ"].every(k => m(k,"あ",1)));
  check("3回目は う〜お", !m("イズミ","あ",2) && m("ウミ","あ",2) && m("オカ","あ",2));
  check("5回目は お だけ", !m("エダ","あ",4) && m("オカ","あ",4));
  check("ゔ は う と同じ", m("ヴィラ","あ",2) && !m("ヴィラ","あ",3));
  check("が・ご は か・こ と同じ(か行の段階)", m("ギンガ","か",1) && !m("ギンガ","か",2) && m("ゴトウ","か",4));
  check("ぁ は あ と同じ", m("ァイ","あ",0) && !m("ァイ","あ",1));
  check("や行は や→ゆ→よ", m("ユキ","や",1) && !m("ヤマ","や",1) && m("ヨシ","や",2) && !m("ユキ","や",2));
  check("押す順: 同じ行は次の段階、お の次は行全部に戻る",
    JSON.stringify(nx("あ",3,"あ")) === '{"row":"あ","step":4}' && JSON.stringify(nx("あ",4,"あ")) === '{"row":"あ","step":0}');
  check("押す順: 別の行は行全部から", JSON.stringify(nx("あ",3,"か")) === '{"row":"か","step":0}');
  check("押す順: や行は3つで1周", JSON.stringify(nx("や",2,"や")) === '{"row":"や","step":0}');
  check("「他」は押し直しで外す", nx("他",0,"他").row === null);

  // ホームの訪問先
  const grid = doc.getElementById("kanaGrid"), list = doc.getElementById("customerList");
  const btnA = () => [...grid.querySelectorAll(".kana-btn")][0];
  const names = () => [...list.querySelectorAll(".customer-item")].map(b => b.textContent);
  check("ホーム: かなのボタンが出ている", !!btnA() && doc.getElementById("kanaArea").style.display === "block");
  btnA().click();
  check("ホーム 1回目: あ行全部", names().slice().sort().join() === ["あおば商店","いずみ工業","うみの屋","ヴィラ見本","えだ産業","おかガス"].sort().join(), names().join());
  btnA().click();
  check("ホーム 2回目: い〜お", names().slice().sort().join() === ["いずみ工業","うみの屋","ヴィラ見本","えだ産業","おかガス"].sort().join() && btnA().textContent === "い〜", names().join() + " / " + btnA().textContent);
  btnA().click();
  check("ホーム 3回目: う〜お", names().length === 4 && names().includes("うみの屋") && !names().includes("いずみ工業") && btnA().textContent === "う〜");
  btnA().click(); btnA().click();
  check("ホーム 5回目: お だけ", names().join() === "おかガス" && btnA().textContent === "お〜");
  btnA().click();
  check("ホーム 6回目: あ行全部に戻る", names().length === 6 && btnA().textContent === "あ" && btnA().classList.contains("active"));
  const btnKa = [...grid.querySelectorAll(".kana-btn")][1];
  btnKa.click();
  check("ホーム: 別の行(か)を押すと、か行全部・あ の表示は戻る", names().join() === "かわ電機,ぎんが製作,ごとう店" && btnA().textContent === "あ");
  [...list.querySelectorAll(".customer-item")][0].click();
  check("ホーム: 候補を押すと訪問先に入る", doc.getElementById("homeVisitTarget").value === "かわ電機");

  // 容器タブの顧客名
  if(doc.getElementById("navContainerButton")) doc.getElementById("navContainerButton").click();
  await sleep(200);
  const cg = doc.getElementById("ctKanaGrid"), cl = doc.getElementById("ctCustomerList");
  const cA = () => [...cg.querySelectorAll(".kana-btn")][0];
  const cnames = () => [...cl.querySelectorAll(".customer-item")].map(b => b.textContent);
  check("容器: かなのボタンがある", !!cA());
  cA().click();
  check("容器 1回目: あ行全部", cnames().length === 6, cnames().join());
  cA().click();
  check("容器 2回目: い〜お", cnames().length === 5 && !cnames().includes("あおば商店") && cA().textContent === "い〜");
  cA().click(); cA().click(); cA().click();
  check("容器 5回目: お だけ", cnames().join() === "おかガス");
  cA().click();
  check("容器 6回目: あ行全部に戻る", cnames().length === 6 && cA().textContent === "あ");

  // v27:顧客の管理も同じしくみ。外すのは「全件」
  doc.getElementById("navDataButton").click(); await sleep(100);
  doc.getElementById("dtCustManage").click(); await sleep(100);
  const mg = () => doc.getElementById("cmKana");
  const mA = () => [...mg().querySelectorAll(".kana-btn")][0];
  const mAll = () => doc.getElementById("cmKanaAll");
  const mnames = () => [...doc.querySelectorAll("#cmList .cm-row .cm-name")].map(x => x.textContent);
  check("管理: 「全件」ボタンがあり、最初は全件(押されている)", !!mAll() && mAll().classList.contains("active") && mnames().length === 12, mnames().length);
  mA().click();
  check("管理 1回目: あ行全部", mnames().length === 6 && !mAll().classList.contains("active"));
  mA().click();
  check("管理 2回目: い〜お", mnames().length === 5 && !mnames().includes("あおば商店") && mA().textContent === "い〜");
  mA().click(); mA().click(); mA().click();
  check("管理 5回目: お だけ", mnames().join() === "おかガス");
  mA().click();
  check("管理 6回目: あ行全部に戻る", mnames().length === 6 && mA().textContent === "あ");
  mAll().click();
  check("管理: 「全件」で絞り込みを外す", mnames().length === 12 && mAll().classList.contains("active") && !mA().classList.contains("active"));
  // 1件を2段に(名前は上の段に横いっぱい)
  const css = [...doc.querySelectorAll("style")].map(x => x.textContent).join(" ");
  check("管理: 行は折り返し、名前は上の段いっぱい", /\.cm-row\{[^}]*flex-wrap:wrap/.test(css) && /\.cm-name\{[^}]*flex:1 1 100%/.test(css));

  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("FAIL かな: エラー " + (e && e.stack || e)); process.exit(1); });
