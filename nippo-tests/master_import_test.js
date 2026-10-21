// 客先名リストの取り込みの確認(本物の index.html と customer_list_tool.html を使う)
// ・暗号の部分が、アプリとツールで同じ文字列か
// ・ツールの暗号で作ったファイルを、アプリの「ファイルから取り込む」で読めるか(往復)
// ・間違ったキー、壊れたファイルのときに、正しい知らせが出るか
// ・「ネットから取得」が残っていないか
// データは架空のもの。使い方: node master_import_test.js(run_tests.py からも呼ばれる)
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { webcrypto } = require("crypto");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const appHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const toolHtml = fs.readFileSync(path.join(ROOT, "customer_list_tool.html"), "utf8");
const swJs = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

let fails = 0;
function check(name, ok, info){
  console.log((ok ? "PASS " : "FAIL ") + "取り込み: " + name + (ok || info === undefined ? "" : " / " + info));
  if(!ok) fails++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 暗号の部分を取り出す(Windows の作業場所では改行が CRLF になることがあるので、改行はそろえて比べる)
function cryptoBlock(html){
  const m = html.replace(/\r\n/g, "\n").match(/\/\* ===CRYPTO-BEGIN=== \*\/[\s\S]*?\/\* ===CRYPTO-END=== \*\//);
  return m ? m[0] : null;
}
const appCrypto = cryptoBlock(appHtml), toolCrypto = cryptoBlock(toolHtml);
check("アプリに暗号の部分がある", !!appCrypto);
check("ツールに暗号の部分がある", !!toolCrypto);
check("暗号の部分がアプリとツールで同じ文字列", appCrypto === toolCrypto);

// 「ネットから取得」が残っていないか
check("index.html に「ネットから取得」のボタンがない", !appHtml.includes("masterGoButton") && !appHtml.includes("ネットから取得"));
check("index.html に master フォルダから取る処理がない", !appHtml.includes("fetch(`master/"));
check("sw.js に master フォルダの扱いがない", !swJs.includes("/master/"));
check("ツールに「サーバーに置く場合の名前」がない", !toolHtml.includes("サーバーに置く場合の名前"));

// ツール側の暗号の関数(本物の文字列をそのまま動かす)
const toolCtx = { crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array };
vm.createContext(toolCtx);
vm.runInContext(toolCrypto + "\nthis.deriveMaster = deriveMaster; this.encryptMaster = encryptMaster;", toolCtx);

const KEY = "ABCD-EFGH-JKLM-NPQR-STUV";
const payload = { v:1, office:"架空営業所", updated:"2026-10-21", items:[
  { c:"T0001", n:"架空商店", k:"カクウショウテン" },
  { c:"T0002", n:"ためし工業", k:"タメシコウギョウ" },
  { c:"T0003", n:"見本ガス", k:"ミホンガス" }
]};

(async () => {
  const { aesKey } = await toolCtx.deriveMaster(KEY);
  const encBytes = await toolCtx.encryptMaster(aesKey, payload);

  // 本物の index.html を開く(container.js は読み込まない)
  const dom = new JSDOM(appHtml, {
    runScripts: "dangerously",
    url: "https://example.test/index.html",
    beforeParse(win){
      Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
      win.TextEncoder = TextEncoder;
      win.TextDecoder = TextDecoder;
      win.confirm = () => true;
      win.alert = () => {};
      win.scrollTo = () => {};
      win.HTMLElement.prototype.scrollIntoView = function(){};
    }
  });
  const win = dom.window, doc = win.document;
  await sleep(300);

  check("取り込みの欄のボタンが「ファイルから取り込む」だけ",
    doc.querySelectorAll("#masterKeyBox .master-actions button").length === 1 && !!doc.getElementById("masterFileButton"));

  // ファイルを選んだことにして、取り込みを動かす
  async function importFile(key, bytes){
    doc.getElementById("masterKeyInput").value = key;
    const input = doc.getElementById("masterFile");
    const file = new win.File([bytes], "架空営業所_客先名リスト.enc");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new win.Event("change"));
    for(let i = 0; i < 100; i++){
      await sleep(100);
      if(!doc.getElementById("masterFileButton").disabled) break;
    }
    return doc.getElementById("masterMessage").textContent;
  }

  // 間違ったキー
  let msg = await importFile("WRONG-KEY-WRONG-KEY-WRON", encBytes);
  check("間違ったキーでは「キーが違うか…」と知らせる", msg.includes("キーが違うか"), msg);
  check("間違ったキーでは保存しない", win.localStorage.getItem("customerMaster") === null);

  // 壊れたファイル(途中の1バイトを変える)
  const broken = new Uint8Array(encBytes); broken[20] ^= 0xFF;
  msg = await importFile(KEY, broken);
  check("壊れたファイルでは「キーが違うか…」と知らせる", msg.includes("キーが違うか"), msg);
  check("壊れたファイルでは保存しない", win.localStorage.getItem("customerMaster") === null);

  // 短すぎるファイル
  msg = await importFile(KEY, new Uint8Array(10));
  check("短すぎるファイルでは「キーが違うか…」と知らせる", msg.includes("キーが違うか"), msg);

  // 正しいキー(書き方が違っても同じキーとして扱う:小文字・ハイフンなし・全角)
  msg = await importFile("ａｂｃｄefghjklmnpqrstuv", encBytes);
  let saved = null;
  try{ saved = JSON.parse(win.localStorage.getItem("customerMaster")); }catch(e){}
  check("正しいキーで取り込める(ツール → アプリの往復)", !!saved && Array.isArray(saved.items) && saved.items.length === 3, msg);
  check("取り込んだ中身がツールで入れたものと同じ",
    !!saved && saved.office === "架空営業所" && JSON.stringify(saved.items) === JSON.stringify(payload.items));
  check("取り込んだあと、営業所キーの欄は空(キーを残さない)", doc.getElementById("masterKeyInput").value === "");
  check("営業所キーをスマホに保存していない",
    !Object.keys(win.localStorage).some(k => (win.localStorage.getItem(k) || "").includes("ABCDEFGH")));

  // ツールで CSV を読んで、暗号化ファイルを作る(本物の customer_list_tool.html を動かす)
  async function toolMake(csv){
    const tdom = new JSDOM(toolHtml, {
      runScripts: "dangerously",
      url: "https://example.test/customer_list_tool.html",
      beforeParse(tw){
        Object.defineProperty(tw, "crypto", { value: webcrypto, configurable: true });
        tw.TextEncoder = TextEncoder;
        tw.TextDecoder = TextDecoder;
      }
    });
    const tw = tdom.window;
    tw.loadCsvFromBuffer(new TextEncoder().encode(csv).buffer);
    tw.eval("keyInputs").forEach(input => { input.value = KEY; });
    tw.document.getElementById("makeBtn").click();
    for(let i = 0; i < 100 && tw.eval("madeFiles").length === 0; i++) await sleep(100);
    const res = { info: tw.document.getElementById("csvInfo").textContent,
      hiddenCell: (tw.document.querySelector("#officeRows tr td:nth-child(4)") || {}).textContent,
      file: tw.eval("madeFiles")[0] };
    tw.close();
    return res;
  }
  const t5 = await toolMake("営業所,顧客コード,客先名,略名カナ,非表示\n架空営業所,T0001,架空商店,カクウショウテン,1\n架空営業所,T0002,ためし工業,タメシコウギョウ,0\n架空営業所,T0003,見本ガス,ミホンガス,True\n");
  check("ツール: 5列目「非表示」を読み、件数を出す", /非表示 2件/.test(t5.info) && t5.hiddenCell === "2件", t5.info + " / " + t5.hiddenCell);
  check("ツール: 非表示の列のある CSV から、ファイルを作れる", !!t5.file);
  win.localStorage.clear();
  msg = await importFile(KEY, t5.file.bytes);
  try{ saved = JSON.parse(win.localStorage.getItem("customerMaster")); }catch(e){ saved = null; }
  check("ツール → アプリ: 非表示の印(h:1)が、T0001 と T0003 にだけ付いて届く",
    !!saved && saved.items.filter(i => i.h === 1).map(i => i.c).join() === "T0001,T0003" && saved.items.length === 3, msg);
  const t4 = await toolMake("営業所,顧客コード,客先名,ふりがな\n架空営業所,T0001,架空商店,カクウショウテン\n");
  check("ツール: 4列の CSV も今までどおり読める(非表示の列はなし)", /「非表示」の列はありません/.test(t4.info) && t4.hiddenCell === "－" && !!t4.file, t4.info);
  {
    const { aesKey } = await toolCtx.deriveMaster(KEY);
    const appCtx = { crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, JSON };
    vm.createContext(appCtx);
    vm.runInContext(appCrypto + "\nthis.decryptMaster = decryptMaster;", appCtx);
    const p4 = await appCtx.decryptMaster(aesKey, t4.file.bytes.buffer);
    const p5 = await appCtx.decryptMaster(aesKey, t5.file.bytes.buffer);
    check("ツール: 非表示の列があるときだけ、ファイルに hidden:1 が付く", p5.hidden === 1 && p4.hidden === undefined && !p4.items.some(i => "h" in i));
  }

  // ツールの「すべてダウンロード」：保存先を選び、「客先名リスト_日付」のフォルダに全部を入れる
  // (ブラウザのフォルダ選びの代わりに、メモリの中の作りものの「フォルダ」を使う)
  function fakeDir(existing){
    const entries = new Map();
    (existing || []).forEach(n => entries.set(n, { kind:"directory", h: fakeDir() }));
    const err = (name) => { const e = new Error(name); e.name = name; return e; };
    return { entries,
      async getDirectoryHandle(name, opt){
        const e = entries.get(name);
        if(e){ if(e.kind !== "directory") throw err("TypeMismatchError"); return e.h; }
        if(opt && opt.create){ const d = fakeDir(); entries.set(name, { kind:"directory", h:d }); return d; }
        throw err("NotFoundError");
      },
      async getFileHandle(name){
        const file = { data:null };
        entries.set(name, { kind:"file", file });
        return { async createWritable(){ return { async write(b){ file.data = new Uint8Array(b); }, async close(){} }; } };
      }
    };
  }
  {
    let anchorClicks = 0;
    const tdom = new JSDOM(toolHtml, {
      runScripts: "dangerously",
      url: "https://example.test/customer_list_tool.html",
      beforeParse(tw){
        Object.defineProperty(tw, "crypto", { value: webcrypto, configurable: true });
        tw.TextEncoder = TextEncoder;
        tw.TextDecoder = TextDecoder;
        tw.showDirectoryPicker = async () => { throw Object.assign(new Error("abort"), { name:"AbortError" }); };
        tw.URL.createObjectURL = () => "blob:test";
        tw.URL.revokeObjectURL = () => {};
        tw.HTMLAnchorElement.prototype.click = function(){ anchorClicks++; };
      }
    });
    const tw = tdom.window, td = tw.document;
    tw.loadCsvFromBuffer(new TextEncoder().encode("営業所,顧客コード,客先名,ふりがな\n架空営業所,T0001,架空商店,カクウ\n見本担当,T0002,見本ガス,ミホン\n").buffer);
    let i = 0; tw.eval("keyInputs").forEach(input => { input.value = KEY + (i++ ? "-ZZZZ" : ""); });
    td.getElementById("makeBtn").click();
    for(let n = 0; n < 150 && tw.eval("madeFiles").length < 2; n++) await sleep(100);
    const allBtn = [...td.querySelectorAll("#results button")].find(b => b.textContent === "すべてダウンロード");
    const allMsg = () => allBtn.nextElementSibling.textContent;
    const waitMsg = async () => { for(let n = 0; n < 50 && !allMsg(); n++) await sleep(50); return allMsg(); };
    check("ツール: 保存先を選べるブラウザでは、フォルダに保存する案内が出る", /客先名リスト_日付/.test(td.getElementById("results").textContent));

    // 1) 保存先を選ぶ画面で「キャンセル」
    allBtn.click();
    check("ツール: 保存先の選択をやめると、何も保存せず「保存をやめました」", /保存をやめました/.test(await waitMsg()) && anchorClicks === 0, allMsg());

    // 2) 同じ名前のフォルダがすでにあるとき → _2 を作って、そこに全部
    const today = tw.eval("todayStr()");
    const root = fakeDir([`客先名リスト_${today}`]);
    tw.showDirectoryPicker = async () => root;
    allBtn.nextElementSibling.textContent = "";
    allBtn.click();
    const m2 = await waitMsg();
    const made = root.entries.get(`客先名リスト_${today}_2`);
    const names = made ? [...made.h.entries.keys()].sort().join() : "";
    check("ツール: 選んだ場所に「客先名リスト_日付」のフォルダを作る(同じ名前があれば _2)", !!made && root.entries.size === 2 && /2個のファイルを保存しました/.test(m2), m2);
    check("ツール: フォルダの中に、全部の暗号化ファイルが入る(キーの一覧は入れない)", names === "架空営業所_客先名リスト.enc,見本担当_客先名リスト.enc", names);
    {
      const { aesKey } = await toolCtx.deriveMaster(KEY);
      const appCtx = { crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, JSON };
      vm.createContext(appCtx);
      vm.runInContext(appCrypto + "\nthis.decryptMaster = decryptMaster;", appCtx);
      let p = null;
      try{ p = await appCtx.decryptMaster(aesKey, made.h.entries.get("架空営業所_客先名リスト.enc").file.data.buffer); }catch(e){}
      check("ツール: フォルダに保存したファイルを、アプリの暗号で読める", !!p && p.office === "架空営業所" && p.items.length === 1);
    }

    // 3) フォルダを選べないブラウザ → 今までどおり1つずつダウンロード
    delete tw.showDirectoryPicker;
    allBtn.click();
    for(let n = 0; n < 30 && anchorClicks < 2; n++) await sleep(100);
    check("ツール: フォルダを選べないブラウザでは、今までどおり1つずつダウンロード", anchorClicks === 2, anchorClicks);
    tw.close();
  }

  win.close();
  console.log(fails === 0 ? "取り込みの確認: すべて合格" : `取り込みの確認: 不合格 ${fails}件`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.log("FAIL 取り込み: 確認の途中で止まった / " + e.message); process.exit(1); });
