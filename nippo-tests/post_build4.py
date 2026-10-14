h=open("harness4.html",encoding="utf-8").read()
def hrep(a,b):
    global h
    assert h.count(a)==1,(h.count(a),a[:70])
    h=h.replace(a,b)
hrep(r'{createdAt:"v1",date:"2026-10-08",target:"A"}', r'{createdAt:"v1",date:"2026-10-08",target:"A",startLat:43.062123,startLng:141.354241,endLat:43.0623,endLng:141.35401}')
hrep(r'"2026-10-07":{departure:{time:"2026-10-07T08:00"},return:{time:"2026-10-07T17:00"}}', r'"2026-10-07":{departure:{time:"2026-10-07T08:00",lat:43.06001,lng:141.351},return:{time:"2026-10-07T17:00",lat:43.06215,lng:141.35398}}')
old=r'function buildReportMail(){return {subject:"営業日報",body:"営業日報 V:"+meetingLogs.length+" D:"+Object.keys(dailyVehicleInfo).length+"\n\n"};}'
new=r'''function buildReportMail(){ let b="営業日報 V:"+meetingLogs.length+" D:"+Object.keys(dailyVehicleInfo).length+"\n\n"; Object.keys(dailyVehicleInfo).forEach(d=>{ const v=dailyVehicleInfo[d]; b+="日付："+d+"\n【車両情報】\n給油量："+((v.return&&v.return.fuel)||"")+"\n\n"; }); meetingLogs.forEach((l,i)=>{ b+="【訪問先 "+(i+1)+"】\n訪問先："+(l.target||"")+"\n特記事項："+(l.notes||"")+"\n\n"; }); return {subject:"営業日報",body:b}; }'''
hrep(old,new)
hrep('function goToVisit(){','''function formatMonthDay(s){ const m=/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/.exec(s||""); return m?parseInt(m[2],10)+"/"+parseInt(m[3],10):""; }
function formatDoneSuffix(iso){ const d=new Date(iso); return isNaN(d.getTime())?"(済)":"("+(d.getMonth()+1)+"/"+d.getDate()+" 済)"; }
function renderReportScreen(){ window.__reportRendered=(window.__reportRendered||0)+1; }
const HONORIFIC_OPTIONS=["社長","工場長","専務","常務","部長","課長"];
(function(){ const dd=document.getElementById("honorificDropdown"), inp=document.getElementById("meetingPersonTitle"); HONORIFIC_OPTIONS.forEach(o=>{ const b=document.createElement("button"); b.type="button"; b.className="honorific-option"; b.textContent=o; b.addEventListener("click",()=>{ inp.value=o; }); dd.appendChild(b); }); })();
function goToVehicle(){ showScreen("vehicle"); updateNav("vehicle"); }
document.getElementById("navHomeButton").addEventListener("click",()=>{ currentVisit=null; goToReport(); });
document.getElementById("navVehicleButton").addEventListener("click",()=>{ currentVisit=null; goToVehicle(); });
function formatTimeOnly(v){ if(!v) return ""; const p=String(v).split("T"); return p.length<2 ? v : p[1].slice(0,5); }
function sortByTodoOrder(a,b){ return (Number(a.order)||0)-(Number(b.order)||0) || (a.createdAt||"").localeCompare(b.createdAt||""); }
function formatCompletedDay(iso){ const d=new Date(iso); return isNaN(d.getTime())?"":(d.getMonth()+1)+"/"+d.getDate(); }
function getTodayVehicle(){ const t=getToday(); if(!dailyVehicleInfo[t]) dailyVehicleInfo[t]={departure:{time:"",distance:""},return:{time:"",distance:"",fuel:""},status:"before"}; return dailyVehicleInfo[t]; }
function getLatestPastReturnDistance(ex){ return "OLD"; }
function renderVehicleScreen(){ getTodayVehicle(); window.__renderCalls=(window.__renderCalls||0)+1; }
function saveTodos(){ localStorage.setItem("todoItems",JSON.stringify(todoItems)); }
function goToVisit(){''')
open("harness4.html","w",encoding="utf-8").write(h)

t=open("smoke8.js",encoding="utf-8").read()
def rep(a,b):
    global t
    assert t.count(a)==1,(t.count(a),a[:90])
    t=t.replace(a,b)
rep('ok(inl("editStartTime") && inl("editEndTime") && inl("meetingPersonTitle") && !inl("vehicleDistance"),"inline labels: 開始/終了/敬称 (走行距離 is a normal label again)");','ok($("editStartTime").parentNode.classList.contains("ct-timebox") && $("editEndTime").parentNode.classList.contains("ct-timebox") && inl("meetingPersonTitle") && !inl("vehicleDistance"),"time boxes: 開始/終了; inline label: 敬称 (走行距離 is a normal label again)");')
rep('ok(parseInt($("editStartTime").style.paddingLeft)>30,"inline label padding set: "+$("editStartTime").style.paddingLeft);','ok($("editStartTime").parentNode.querySelector(".ct-inlab").textContent==="開始","time box label set");')
rep('ok(parseInt($("editStartTime").style.paddingLeft)<=40 && parseInt($("visitStartTimeInput").style.paddingLeft)<=40 && $("editStartTime").style.textAlign==="left","time fields: small left padding (narrow)");','ok($("visitStartTimeInput").parentNode.classList.contains("ct-timebox"),"訪問中 start-time is a small box too");')
rep('ok($("ctTime").style.paddingLeft==="38px","container edit-time field uses the same narrow padding");','ok($("ctTime").parentNode.classList.contains("ct-timebox"),"container edit-time field uses the same small box");')
rep('ok(parseInt(ta.style.height)<=Math.ceil(20+(w.innerHeight-14)*0.65)+1 && parseInt(ta.style.height)>60,"capped by what fits on the screen ("+ta.style.height+")");','ok(parseInt(ta.style.height)>60 && parseInt(ta.style.height)<=400,"capped at 10 rows, not by the screen ("+ta.style.height+")");')
open("smoke8.js","w",encoding="utf-8").write(t)
print("post4")
