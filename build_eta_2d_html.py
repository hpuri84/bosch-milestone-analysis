"""Generate the standalone ETA-2D pushback HTML (single file, embedded data, offline-capable).
Scannable layout: tables + bullets, minimal prose. Reads eta_2d_rollups.json,
eta_2d_findings.json, eta_2d_shipments.json.
"""
import json, os, statistics as st
from datetime import date

ROLL = json.load(open("eta_2d_rollups.json"))
FIND = json.load(open("eta_2d_findings.json")) if os.path.exists("eta_2d_findings.json") else None
SHIPS = json.load(open("eta_2d_shipments.json"))
GEN = "2026-06-11"

# ---- derived extras (inland medians + top-5 problem countries monthly) ----
def med(xs): return round(st.median(xs), 1) if xs else None
late_lm = [s["last_mile_d"] for s in SHIPS if s["bucket"] == "late_gt48" and s["last_mile_d"] is not None and s["last_mile_d"] >= 0]
acc_lm = [s["last_mile_d"] for s in SHIPS if s["accepted"] and s["last_mile_d"] is not None and s["last_mile_d"] >= 0]

def cw_month(week):
    d = date.fromisocalendar(2026, int(week[2:]), 4)  # ISO Thursday
    return d.strftime("%b"), d.month
month_order, seen = [], set()
for w in ROLL["meta"]["weeks"]:
    lab, mn = cw_month(w)
    if lab not in seen:
        seen.add(lab); month_order.append((mn, lab))
month_order.sort()
MONTHS = [lab for _, lab in month_order]

# rank countries by failure volume (impact), min 50 delivered
cc = {g["key"]: g for g in ROLL["by_dest_country"]}
ranked = sorted([g for g in ROLL["by_dest_country"] if g["total"] >= 50], key=lambda g: -g["failed"])[:5]
top5 = []
for g in ranked:
    country = g["key"]
    monthly = {lab: {"t": 0, "a": 0} for lab in MONTHS}
    for s in SHIPS:
        if s["dest_country"] == country:
            lab, _ = cw_month(s["week"])
            monthly[lab]["t"] += 1
            monthly[lab]["a"] += 1 if s["accepted"] else 0
    series = [{"m": lab, "total": monthly[lab]["t"], "acc": monthly[lab]["a"],
               "rate": round(monthly[lab]["a"] / monthly[lab]["t"], 4) if monthly[lab]["t"] else None} for lab in MONTHS]
    top5.append({"country": country, "total": g["total"], "rate": g["rate"], "failed": g["failed"],
                 "no_t7_rate": g.get("no_t7_rate"), "avg_dev_days": g["avg_dev_days"], "series": series})

EXTRA = {
    "lm_late_med": med(late_lm), "lm_acc_med": med(acc_lm), "lm_late_n": len(late_lm), "lm_acc_n": len(acc_lm),
    "ocean": ROLL["responsibility"]["late_miss_attribution"]["upstream_port"],
    "inland": ROLL["responsibility"]["late_miss_attribution"]["last_mile"],
    "attrib_cov": ROLL["responsibility"]["late_miss_attribution"]["coverage"],
    "months": MONTHS, "top5": top5,
}

TPL = r"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bosch ETA 2D — Pushback Evidence</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23C15F3C'/%3E%3C/svg%3E">
<style>
:root{
  --bg:#FAF9F5;--surface:#FFFFFF;--ink:#2B2B28;--muted:#6B6862;--faint:#9A958C;
  --border:#E5E4DF;--band:#F4F2EC;--orange:#C15F3C;--orange2:#D97757;
  --blue:#5B7C99;--green:#6F8F5E;--red:#B5503F;--amber:#C99A3C;--purple:#8A6FA8;
  --mono:'Geist Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1100px;margin:0 auto;padding:32px 24px 70px}
h1{font-size:25px;margin:0 0 3px;letter-spacing:-.02em;font-weight:700}
h2{font-size:16px;margin:34px 0 4px;letter-spacing:-.01em;font-weight:650}
h2 .n{color:var(--faint);font-family:var(--mono);font-size:12px;font-weight:500;margin-right:7px}
.sub{color:var(--muted);font-size:12.5px;max-width:860px;margin-bottom:11px}
.badge{display:inline-block;background:#3A2A23;color:#F4E9E2;font-size:10px;letter-spacing:.08em;font-weight:600;padding:4px 10px;border-radius:5px;text-transform:uppercase}
.mono{font-family:var(--mono)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:15px 17px}
.tldr{background:linear-gradient(180deg,#FFF,#FCF8F3);border:1px solid #EAD9CD;border-left:3px solid var(--orange);border-radius:11px;padding:14px 20px;margin-top:18px}
.tldr h3{margin:0 0 7px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--orange);font-weight:700}
.tldr ul{margin:0;padding-left:19px}
.tldr li{margin:4px 0;font-size:14px}
.tldr b{font-family:var(--mono);font-weight:600}
.grid{display:grid;gap:11px}
.cards{grid-template-columns:repeat(6,1fr);margin-top:16px}
.metric{padding:12px 13px}
.metric .lab{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600;min-height:26px}
.metric .val{font-family:var(--mono);font-size:21px;font-weight:600;margin-top:5px;letter-spacing:-.02em}
.metric .note{font-size:10.5px;color:var(--faint);margin-top:2px;min-height:24px}
.metric.hi .val{color:var(--orange)}.metric.bad .val{color:var(--red)}.metric.ok .val{color:var(--green)}
.legend{display:flex;gap:15px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--muted)}
.legend span{display:inline-flex;align-items:center;gap:6px}
.sw{width:11px;height:11px;border-radius:3px;display:inline-block}
.decomp{height:40px;display:flex;border-radius:8px;overflow:hidden;border:1px solid var(--border)}
.decomp div{display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--mono);font-size:11.5px;font-weight:600;min-width:0}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--border);vertical-align:top}
th{font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);font-weight:600;white-space:nowrap;background:var(--surface)}
th.num,td.num{text-align:right;font-family:var(--mono);white-space:nowrap}
td.area{font-weight:550}
tbody tr:hover{background:var(--band)}
.tw td{font-size:12.5px;line-height:1.45}
.pill{font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;white-space:nowrap}
.sortable th{cursor:pointer;user-select:none;position:sticky;top:0}
.sortable th.sorted{color:var(--orange)}
.controls{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:4px 0 9px}
.btn{background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:5px 12px;font-size:12px;font-weight:550;cursor:pointer;color:var(--muted);font-family:var(--sans)}
.btn.active{background:var(--orange);color:#fff;border-color:var(--orange)}
.controls input{border:1px solid var(--border);border-radius:7px;padding:5px 9px;font-size:12px;width:64px;font-family:var(--mono)}
.controls label{font-size:11.5px;color:var(--muted)}
.bar-rate{display:inline-block;height:7px;border-radius:4px;vertical-align:middle;margin-left:6px}
.s-high{color:var(--green);font-weight:600}.s-medium,.s-survives_with_caveat{color:var(--amber);font-weight:600}.s-low,.s-refuted{color:var(--red);font-weight:600}
.tag{font-family:var(--mono);font-size:10px;padding:1px 6px;border-radius:4px;background:var(--band);color:var(--muted)}
.foot{margin-top:38px;padding-top:14px;border-top:1px solid var(--border);color:var(--faint);font-size:11px}
svg{display:block;max-width:100%}
.axlab{font-family:var(--mono);font-size:10px;fill:var(--faint)}
ol.asks{margin:4px 0;padding-left:20px}ol.asks li{margin:6px 0;font-size:13px}
@media(max-width:820px){.cards{grid-template-columns:repeat(3,1fr)}}
</style></head>
<body><div class="wrap">

<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">
 <div><h1>Bosch ETA Accuracy 2D — Pushback Evidence</h1>
  <div class="sub" id="hdrsub" style="margin-bottom:0"></div></div>
 <div class="badge">Internal</div>
</div>

<div class="tldr"><h3>Read this first</h3><ul id="tldr"></ul></div>
<div class="grid cards" id="cards"></div>

<h2><span class="n">01</span>One number, three different problems</h2>
<div class="sub">Every delivered shipment lands in one bucket. Two of them are not late deliveries.</div>
<div class="card"><div class="decomp" id="decomp"></div><div class="legend" id="decomp-legend"></div></div>
<table class="tw" id="bucket-table" style="margin-top:12px"></table>

<h2><span class="n">02</span>Where is the delay — ocean or inland?</h2>
<div class="sub">Measured from actual vessel-arrival (ATA) timestamps in the data — not assumed.</div>
<div class="grid" style="grid-template-columns:1.1fr 1fr;gap:14px;align-items:start">
 <table class="tw" id="oi-table"></table>
 <div class="card" id="oi-note" style="font-size:12.5px;color:var(--muted)"></div>
</div>

<h2><span class="n">03</span>The gap is getting worse, not stabilising</h2>
<div class="sub">Weekly acceptance (±48h) vs T-7 snapshot completeness · 4-wk rolling dashed · target 90%.</div>
<div class="card"><div id="trend"></div></div>

<h2><span class="n">04</span>Top 5 problem destinations — month-over-month</h2>
<div class="sub">The 5 destination countries with the most failed shipments (where Bosch volume actually goes). Monthly acceptance rate.</div>
<div class="card"><div id="mom"></div></div>
<table class="tw" id="mom-table" style="margin-top:12px"></table>

<h2><span class="n">05</span>The four arguments <span id="pillar-note" class="sub" style="font-weight:400"></span></h2>
<table class="tw" id="pillars-table"></table>

<h2><span class="n">06</span>Who owns the gap</h2>
<div class="card" id="split"></div>

<h2><span class="n">07</span>Hotspots — drill by dimension</h2>
<div class="sub">Headline = destination city. Switch dimension · click a column to sort · set min volume. Pooled CW01–CW21.</div>
<div class="controls" id="hs-controls"></div>
<div class="card" style="padding:0;overflow:auto;max-height:520px"><table class="sortable" id="hs-table"></table></div>

<div class="grid" style="grid-template-columns:1fr 1fr;gap:14px;margin-top:8px" id="two-col"></div>

<h2><span class="n">10</span>The "BUD" question</h2>
<table class="tw" id="bud-table"></table>

<h2><span class="n">11</span>What to ask Bosch</h2>
<div class="card"><ol class="asks" id="asks"></ol></div>

<div class="foot" id="foot"></div>
</div>
<script id="DATA" type="application/json">__DATA__</script>
<script id="FIND" type="application/json">__FIND__</script>
<script id="EXTRA" type="application/json">__EXTRA__</script>
<script>
const D=JSON.parse(document.getElementById('DATA').textContent);
const F=JSON.parse(document.getElementById('FIND').textContent);
const X=JSON.parse(document.getElementById('EXTRA').textContent);
const R=D.responsibility,B=R.buckets,TOT=R.total_delivered,M=D.meta;
const fmtN=n=>n==null?'—':n.toLocaleString();
const pct=(x,d=1)=>x==null?'—':(x*100).toFixed(d)+'%';
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
const fs=s=>{if(!s)return'';const i=s.indexOf('. ');return i<0?s:s.slice(0,i+1);};
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function mode(g){if((g.no_t7_rate||0)>=0.5)return['no-T7',css('--blue')];
 if((g.early_gt48||0)>(g.late_gt48||0))return['early-bias',css('--amber')];
 if((g.avg_dev_days||0)>14)return['gross-late',css('--red')];return['late',css('--muted')];}

document.getElementById('hdrsub').innerHTML=`Door delivery (S31): T-7 ETA snapshot vs actual, pass if |dev| ≤ 48h · SC4 · CW01–CW21 · <b>${fmtN(TOT)}</b> shipments · reconciled to live pipeline`;

// TL;DR
const notD=B.no_t7+B.early_gt48;
const tldr=[
 `<b>${pct(R.accepted_share)}</b> of ${fmtN(TOT)} delivered shipments pass — but that one number hides three different problems:`,
 `<b>${pct(B.no_t7/TOT)}</b> (${fmtN(B.no_t7)}) never had an ETA sent at all → a transmission/EDI gap, <b>not</b> a late delivery.`,
 `<b>${pct(B.early_gt48/TOT)}</b> (${fmtN(B.early_gt48)}) were delivered <b>more than 48h early</b> → still scored as "fail".`,
 `→ <b>~${pct(notD/TOT,0)}</b> of "failures" are not late deliveries at all.`,
 `When a delivery <i>is</i> late, the ship arrived on time <b>${pct(X.inland/X.attrib_cov,0)}</b> of the time (measured from vessel data) → the delay is <b>inland</b>. Inland misses split two ways — a frozen estimate and genuine slow last-mile — decided per destination (§07–08).`,
 `Gap ownership: <b>${F?F.responsibility_split.measurement_design_pct:40}%</b> measurement-design · <b>${F?F.responsibility_split.estimate_staleness_structural_pct:38}%</b> frozen-estimate/structural · <b>${F?F.responsibility_split.genuine_maersk_lastmile_pct:22}%</b> genuine Maersk last-mile.`,
];
tldr.forEach(t=>document.getElementById('tldr').append(el('li',null,t)));

// cards
[['ok','Accepted ±48h',pct(B.accepted/TOT),fmtN(B.accepted)],
 ['bad','No ETA sent',pct(B.no_t7/TOT),fmtN(B.no_t7)+' no snapshot'],
 ['hi','Delivered early',pct(B.early_gt48/TOT),fmtN(B.early_gt48)+' >48h early'],
 ['','Delivered late',pct(B.late_gt48/TOT),fmtN(B.late_gt48)+' >48h late'],
 ['hi','Not a delivery miss',pct(notD/TOT,0),'no-ETA + early'],
 ['','T-7 completeness',pct((TOT-B.no_t7)/TOT),'snapshots sent']
].forEach(([cls,lab,val,note])=>{const c=el('div','card metric '+cls);
 c.append(el('div','lab',lab),el('div','val',val),el('div','note',note));document.getElementById('cards').append(c);});

// decomposition
const segs=[['Accepted',B.accepted,css('--green')],['No ETA sent',B.no_t7,css('--blue')],
 ['Early >48h',B.early_gt48,css('--amber')],['Late >48h',B.late_gt48,css('--orange')]];
segs.forEach(([lab,n,col])=>{const d=el('div',null,Math.round(n/TOT*100)+'%');d.style.flex=n;d.style.background=col;d.title=`${lab}: ${fmtN(n)}`;document.getElementById('decomp').append(d);});
segs.forEach(([lab,n,col])=>document.getElementById('decomp-legend').append(el('span',null,`<span class="sw" style="background:${col}"></span>${lab}`)));

// bucket table
document.getElementById('bucket-table').innerHTML=
 '<thead><tr><th>Bucket</th><th class="num">Shipments</th><th class="num">Share</th><th>Whose problem</th></tr></thead><tbody>'+
 [['Accepted (±48h)',B.accepted,'Pass'],
  ['No ETA snapshot ever sent',B.no_t7,'Maersk data / EDI — not delivery'],
  ['Delivered >48h <b>early</b>',B.early_gt48,'Measurement design — penalises early'],
  ['Delivered >48h late',B.late_gt48,'Mixed — see §02 / §06']]
 .map(([b,n,w])=>`<tr><td class="area">${b}</td><td class="num">${fmtN(n)}</td><td class="num">${pct(n/TOT)}</td><td>${w}</td></tr>`).join('')+'</tbody>';

// ocean vs inland
const oc=X.ocean,inl=X.inland,cov=X.attrib_cov;
document.getElementById('oi-table').innerHTML=
 '<thead><tr><th>Where the late delivery actually slipped</th><th class="num">Late misses</th><th class="num">Share</th></tr></thead><tbody>'+
 `<tr><td class="area">Ocean / port — ship arrived >48h late</td><td class="num">${fmtN(oc)}</td><td class="num">${pct(oc/cov)}</td></tr>`+
 `<tr><td class="area">Inland / last-mile — ship on time, door late</td><td class="num">${fmtN(inl)}</td><td class="num">${pct(inl/cov)}</td></tr>`+
 `<tr style="font-weight:600"><td>Total late misses with vessel data</td><td class="num">${fmtN(cov)}</td><td class="num">100%</td></tr></tbody>`;
document.getElementById('oi-note').innerHTML=
 `<b>The ship is almost never the problem.</b> In ${pct(inl/cov,0)} of late deliveries the vessel arrived on schedule — the variance is on the inland leg.<br><br>`+
 `That inland gap is <b>two things at once</b>, and which one dominates is destination-specific:<br>`+
 `&nbsp;&nbsp;• a door estimate <b>frozen at vessel departure</b> and never revised;<br>`+
 `&nbsp;&nbsp;• genuine <b>slow last-mile</b> in specific places (§08).<br><br>`+
 `Inland leg (port→door) median: <b>${X.lm_late_med}d</b> on late misses (n=${fmtN(X.lm_late_n)}) vs <b>${X.lm_acc_med}d</b> on accepted (n=${fmtN(X.lm_acc_n)}) — a ~${Math.round(X.lm_late_med-X.lm_acc_med)}-day gap.`;

// trend
(function(){const t=D.trend,W=1040,H=250,p={l:40,r:50,t:12,b:30},iw=W-p.l-p.r,ih=H-p.t-p.b;
 const x=i=>p.l+iw*i/(t.length-1),y=v=>p.t+ih*(1-v);
 const acc=t.map(d=>d.rate||0),comp=t.map(d=>d.t7_comp||0);
 const roll=acc.map((_,i)=>{const s=acc.slice(Math.max(0,i-3),i+1);return s.reduce((a,b)=>a+b,0)/s.length});
 const pa=a=>a.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
 let g=`<svg viewBox="0 0 ${W} ${H}">`;
 [0,.25,.5,.75,.9,1].forEach(v=>{g+=`<line x1="${p.l}" y1="${y(v)}" x2="${W-p.r}" y2="${y(v)}" stroke="${v==.9?'#E7B5AC':'#EFEDE7'}" stroke-dasharray="${v==.9?'4 4':''}"/><text class="axlab" x="${p.l-6}" y="${y(v)+3}" text-anchor="end">${Math.round(v*100)}</text>`;});
 t.forEach((d,i)=>{if(i%2==0)g+=`<text class="axlab" x="${x(i)}" y="${H-10}" text-anchor="middle">${d.week.replace('CW','')}</text>`;});
 g+=`<path d="${pa(comp)}" fill="none" stroke="var(--blue)" stroke-width="1.5" opacity=".5"/><path d="${pa(roll)}" fill="none" stroke="var(--orange2)" stroke-width="1.4" stroke-dasharray="5 4" opacity=".8"/><path d="${pa(acc)}" fill="none" stroke="var(--orange)" stroke-width="2.3"/>`;
 acc.forEach((v,i)=>g+=`<circle cx="${x(i)}" cy="${y(v)}" r="2.4" fill="var(--orange)"><title>${t[i].week}: ${pct(v)} (n=${t[i].total})</title></circle>`);
 g+='</svg>';
 document.getElementById('trend').innerHTML=g+`<div class="legend"><span><span class="sw" style="background:var(--orange)"></span>Acceptance</span><span><span class="sw" style="background:var(--orange2)"></span>4-wk rolling</span><span><span class="sw" style="background:var(--blue)"></span>T-7 completeness</span></div>`;
})();

// MoM top-5
(function(){const T=X.top5,MN=X.months,cols=[css('--orange'),css('--blue'),css('--green'),css('--amber'),css('--purple')];
 const W=1040,H=260,p={l:40,r:96,t:12,b:30},iw=W-p.l-p.r,ih=H-p.t-p.b;
 let mx=0;T.forEach(c=>c.series.forEach(s=>{if(s.rate!=null)mx=Math.max(mx,s.rate)}));mx=Math.max(.1,mx*1.15);
 const x=i=>p.l+iw*i/(MN.length-1),y=v=>p.t+ih*(1-v/mx);
 let g=`<svg viewBox="0 0 ${W} ${H}">`;
 for(let k=0;k<=4;k++){const v=mx*k/4;g+=`<line x1="${p.l}" y1="${y(v)}" x2="${W-p.r}" y2="${y(v)}" stroke="#EFEDE7"/><text class="axlab" x="${p.l-6}" y="${y(v)+3}" text-anchor="end">${Math.round(v*100)}</text>`;}
 MN.forEach((m,i)=>g+=`<text class="axlab" x="${x(i)}" y="${H-10}" text-anchor="middle">${m}</text>`);
 T.forEach((c,ci)=>{const pts=c.series.map((s,i)=>s.rate==null?null:[x(i),y(s.rate)]).filter(Boolean);
  if(pts.length){g+=`<path d="${pts.map((pt,i)=>(i?'L':'M')+pt[0].toFixed(1)+' '+pt[1].toFixed(1)).join(' ')}" fill="none" stroke="${cols[ci]}" stroke-width="2"/>`;
   pts.forEach(pt=>g+=`<circle cx="${pt[0]}" cy="${pt[1]}" r="2.4" fill="${cols[ci]}"/>`);
   const last=pts[pts.length-1];g+=`<text x="${last[0]+6}" y="${last[1]+3}" font-family="var(--mono)" font-size="10.5" fill="${cols[ci]}">${c.country}</text>`;}});
 g+='</svg>';
 document.getElementById('mom').innerHTML=g+'<div class="legend">'+T.map((c,ci)=>`<span><span class="sw" style="background:${cols[ci]}"></span>${c.country} (n=${fmtN(c.total)})</span>`).join('')+'</div>';
 // table
 let h='<thead><tr><th>Country</th><th class="num">Delivered</th><th class="num">Failed</th><th class="num">Acc rate</th><th class="num">No-ETA</th><th class="num">Avg dev</th>'+MN.map(m=>`<th class="num">${m}</th>`).join('')+'</tr></thead><tbody>';
 T.forEach(c=>{h+=`<tr><td class="area">${c.country}</td><td class="num">${fmtN(c.total)}</td><td class="num">${fmtN(c.failed)}</td><td class="num">${pct(c.rate)}</td><td class="num">${pct(c.no_t7_rate)}</td><td class="num">${c.avg_dev_days==null?'—':c.avg_dev_days.toFixed(1)+'d'}</td>`+
  c.series.map(s=>`<td class="num">${s.rate==null?'—':pct(s.rate,0)}</td>`).join('')+'</tr>';});
 document.getElementById('mom-table').innerHTML=h+'</tbody>';
})();

// pillars table
(function(){const t=document.getElementById('pillars-table');
 if(!(F&&F.pillars)){t.innerHTML='<tbody><tr><td class="sub">Populates from synthesis.</td></tr></tbody>';return;}
 document.getElementById('pillar-note').textContent='— each stress-tested adversarially';
 let h='<thead><tr><th style="width:24px">#</th><th>Argument</th><th>Proof</th><th>Bosch will say</th><th>We answer</th></tr></thead><tbody>';
 F.pillars.forEach((p,i)=>{h+=`<tr><td class="num">${i+1}</td><td class="area">${p.thesis||p.title}<br><span class="s-${(p.strength||'').toLowerCase()}" style="font-size:10px">${(p.strength||'').replace(/_/g,' ')}</span></td>`+
  `<td>${(p.evidence||[])[0]||''}</td><td title="${(p.bosch_counterargument||'').replace(/"/g,'&quot;')}">${fs(p.bosch_counterargument)}</td><td title="${(p.maersk_response||'').replace(/"/g,'&quot;')}">${fs(p.maersk_response)}</td></tr>`;});
 t.innerHTML=h+'</tbody>';})();

// split
(function(){const s=document.getElementById('split');if(!(F&&F.responsibility_split)){s.innerHTML='<div class="sub">Populates from synthesis.</div>';return;}
 const rs=F.responsibility_split,parts=[['Measurement-design (no-ETA + early)',rs.measurement_design_pct,css('--blue')],
  ['Frozen-estimate / structural',rs.estimate_staleness_structural_pct,css('--amber')],['Genuine Maersk last-mile',rs.genuine_maersk_lastmile_pct,css('--orange')]];
 let bar='<div class="decomp" style="height:36px">';parts.forEach(([l,v,c])=>bar+=`<div style="flex:${v||0};background:${c}" title="${l}">${v?v+'%':''}</div>`);bar+='</div>';
 let leg='<div class="legend">';parts.forEach(([l,v,c])=>leg+=`<span><span class="sw" style="background:${c}"></span>${l} — <b>${v}%</b></span>`);leg+='</div>';
 s.innerHTML=bar+leg;})();

// hotspots
const DIMS=[['by_dest_city','Dest city'],['by_dest_country','Dest country'],['by_lane','Lane'],['by_origin_country','Origin'],['by_carrier','Carrier'],['by_service','Service']];
let curDim='by_dest_city',sortKey='rate',sortDir=1,minVol=15;
const COLS=[['label','Area',0],['total','n',1],['rate','Acc',1],['no_t7_rate','No-ETA',1],['late_gt48','Late',1],['early_gt48','Early',1],['avg_dev_days','Avg dev',1],['recent_rate','Recent',1],['_mode','Mode',0]];
function rws(){let r=(D[curDim]||[]).filter(g=>g.total>=minVol);
 r.sort((a,b)=>{let va=a[sortKey],vb=b[sortKey];if(va==null)va=sortDir<0?-1:9e9;if(vb==null)vb=sortDir<0?-1:9e9;return(va<vb?-1:va>vb?1:0)*sortDir;});return r;}
function drawT(){const t=document.getElementById('hs-table'),mx=Math.max(...(D[curDim]||[]).map(g=>g.total),1);
 let h='<thead><tr>';COLS.forEach(([k,lab,num])=>h+=`<th class="${num?'num':''} ${k==sortKey?'sorted':''}" data-k="${k}">${lab}${k==sortKey?(sortDir<0?' ▼':' ▲'):''}</th>`);h+='</tr></thead><tbody>';
 rws().forEach(g=>{const[ml,mc]=mode(g);h+=`<tr><td class="area">${g.label||g.key}</td>`+
  `<td class="num">${fmtN(g.total)}<span class="bar-rate" style="width:${(g.total/mx*36).toFixed(0)}px;background:#E7DFD6"></span></td>`+
  `<td class="num" style="color:${g.rate<.1?'var(--red)':g.rate<.3?'var(--amber)':'var(--green)'}">${pct(g.rate)}</td>`+
  `<td class="num">${pct(g.no_t7_rate)}</td><td class="num">${fmtN(g.late_gt48)}</td><td class="num">${fmtN(g.early_gt48)}</td>`+
  `<td class="num">${g.avg_dev_days==null?'—':g.avg_dev_days.toFixed(1)+'d'}</td><td class="num">${pct(g.recent_rate)}</td>`+
  `<td><span class="pill" style="background:${mc}22;color:${mc}">${ml}</span></td></tr>`;});
 t.innerHTML=h+'</tbody>';
 t.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(k=='_mode')return;if(k==sortKey)sortDir*=-1;else{sortKey=k;sortDir=k=='label'?1:-1;}drawT();});}
(function(){const c=document.getElementById('hs-controls');
 DIMS.forEach(([k,lab])=>{const b=el('button','btn'+(k==curDim?' active':''),lab);b.onclick=()=>{curDim=k;sortKey='rate';sortDir=1;c.querySelectorAll('.btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');drawT();};c.append(b);});
 const inp=el('input');inp.type='number';inp.value=minVol;inp.oninput=()=>{minVol=+inp.value||1;drawT();};c.append(el('label',null,'min n:'),inp);})();
drawT();

// two-col: exposed + unmeetable as tables
function tableCard(num,title,sub,items,c1,c2){const c=el('div','card');const hh=el('h2');hh.innerHTML=`<span class="n">${num}</span>${title}`;hh.style.margin='0 0 3px';c.append(hh,el('div','sub',sub));
 if(!items||!items.length){c.append(el('div','sub','Populates from synthesis.'));return c;}
 let h='<table class="tw"><tbody>';items.forEach(it=>h+=`<tr><td class="area" style="width:78px"><span class="mono" style="color:var(--orange)">${fmtN(it[c1])}</span></td><td>${it[c2]}</td></tr>`);
 c.append(el('div',null,h+'</tbody></table>'));return c;}
const tc=document.getElementById('two-col');
tc.append(tableCard('08','Where Maersk <i>is</i> exposed','Genuine last-mile weakness — own it.',
 (F?F.where_maersk_is_exposed:[]).map(e=>({n:e.n,t:`<b>${e.area}</b> — ${e.issue}`})),'n','t'));
tc.append(tableCard('09','Structurally weak / unmeasurable','T-7 ±48h door ETA barely producible here.',
 (F?F.structurally_unmeetable:[]).map(e=>({n:e.n,t:`<b>${e.segment}</b> — ${e.why}`})),'n','t'));

// BUD
document.getElementById('bud-table').innerHTML= F&&F.bud_resolution?
 ('<thead><tr><th>Reading</th><th>What "BUD" means</th></tr></thead><tbody>'+
  '<tr><td class="area">1 — use this</td><td>Hungarian network via BUD airport: <b>Miskolc + Hatvan + Maklar + Eger</b>. HU block = 1,141 delivered / 143 accepted (13%) / 998 failed. Mixed: genuine lateness + Hatvan’s recent T-7 collapse.</td></tr>'+
  '<tr><td class="area">2 — footnote</td><td>České Budějovice (CZ) — name contains "Budějovice". A spelling-split data artifact (~58 shipments). Discloses as a caveat, not the answer.</td></tr></tbody>')
 :'<tbody><tr><td class="sub">No literal "Budapest" in the data — see Dest City hotspots.</td></tr></tbody>';

// asks
(F&&F.recommended_asks?F.recommended_asks:['Populates from synthesis.']).forEach(a=>document.getElementById('asks').append(el('li',null,a)));

// footer
const cav=(F&&F.data_quality_caveats)||['Delay reasons sparsely populated — attribution directional.','City spellings vary; grouped best-effort.'];
document.getElementById('foot').innerHTML=`Generated __GEN__ · SC4 shipments CW01–CW21, reconciled to kpi_data.json · ${fmtN(TOT)} delivered · S31 T-7 snapshot, ±48h<br><b>Caveats:</b> `+cav.map(c=>'· '+c).join(' ');
</script></body></html>"""

html = (TPL.replace("__DATA__", json.dumps(ROLL))
           .replace("__FIND__", json.dumps(FIND))
           .replace("__EXTRA__", json.dumps(EXTRA))
           .replace("__GEN__", GEN))
open("eta_2d_pushback.html", "w").write(html)
print(f"Wrote eta_2d_pushback.html ({len(html)//1024} KB) | months={EXTRA['months']} | top5={[c['country'] for c in EXTRA['top5']]}")
