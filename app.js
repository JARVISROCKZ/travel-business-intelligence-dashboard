const DATA = RAW_DATA;
const INR = n => '₹' + Math.round(n).toLocaleString('en-IN');
const INRc = n => {
  n = Math.round(n);
  if (Math.abs(n) >= 10000000) return '₹' + (n/10000000).toFixed(2) + ' Cr';
  if (Math.abs(n) >= 100000) return '₹' + (n/100000).toFixed(2) + ' L';
  return '₹' + n.toLocaleString('en-IN');
};
const pct = n => n.toFixed(1) + '%';
const PALETTE = ['#E2A542','#1C7C74','#D9634B','#4C7EA8','#8E6BAE','#5B6472','#C6862A','#2E9E93'];

/* ---------------- Chart engine (pure SVG, no deps) ---------------- */

function svgEl(w,h,extra){ return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="xMidYMid meet" ${extra||''}>`; }

// Horizontal bar list (HTML, not svg) — used for ranked lists
function hBarList(container, rows, opts){
  opts = opts||{};
  const max = Math.max(...rows.map(r=>r.value)) || 1;
  const color = opts.color || 'var(--amber)';
  let html = '';
  rows.forEach(r=>{
    const w = Math.max(2, (r.value/max*100));
    html += `<div class="barrow">
      <div class="lbl" title="${r.label}">${r.label}</div>
      <div class="track"><div class="fill" style="width:${w}%; background:${r.color||color}"></div></div>
      <div class="val">${r.display||r.value}</div>
    </div>`;
  });
  container.innerHTML = html;
}

// Vertical column chart (SVG)
function columnChart(container, rows, opts){
  opts = opts || {};
  const W = opts.width||520, H = opts.height||220;
  const padL=44, padB=34, padT=14, padR=14;
  const cw = W-padL-padR, ch = H-padT-padB;
  const max = Math.max(...rows.map(r=>r.value), 1) * 1.15;
  const bw = cw/rows.length;
  let bars='', labels='', grid='';
  for(let i=0;i<=4;i++){
    const y = padT + ch - (ch*i/4);
    grid += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#E9E4D6" stroke-width="1"/>`;
    grid += `<text class="axis-label" x="${padL-6}" y="${y+3}" text-anchor="end">${opts.fmtY ? opts.fmtY(max*i/4) : Math.round(max*i/4)}</text>`;
  }
  rows.forEach((r,i)=>{
    const bh = (r.value/max)*ch;
    const x = padL + i*bw + bw*0.18;
    const bwid = bw*0.64;
    const y = padT+ch-bh;
    bars += `<rect x="${x}" y="${y}" width="${bwid}" height="${bh}" rx="3" fill="${r.color||opts.color||'var(--amber)'}"><title>${r.label}: ${r.display||r.value}</title></rect>`;
    labels += `<text class="axis-label" x="${x+bwid/2}" y="${H-10}" text-anchor="middle">${r.label}</text>`;
  });
  container.innerHTML = svgEl(W,H) + grid + bars + labels + '</svg>';
}

// Line/area chart for trend, supports multiple series sharing one x
function lineChart(container, xs, series, opts){
  opts = opts||{};
  const W = opts.width||760, H = opts.height||220;
  const padL=54, padB=30, padT=16, padR=20;
  const cw=W-padL-padR, ch=H-padT-padB;
  const allVals = series.flatMap(s=>s.values);
  const maxV = Math.max(...allVals)*1.15;
  const minV = 0;
  const stepX = cw/(xs.length-1||1);
  let grid='', axisX='';
  for(let i=0;i<=4;i++){
    const y = padT + ch - (ch*i/4);
    grid += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#E9E4D6" stroke-width="1"/>`;
    grid += `<text class="axis-label" x="${padL-8}" y="${y+3}" text-anchor="end">${opts.fmtY ? opts.fmtY(maxV*i/4) : Math.round(maxV*i/4)}</text>`;
  }
  xs.forEach((x,i)=>{
    if(i % (opts.xEvery||1) === 0){
      axisX += `<text class="axis-label" x="${padL+i*stepX}" y="${H-8}" text-anchor="middle">${x}</text>`;
    }
  });
  let paths='';
  series.forEach(s=>{
    let d='', area='';
    s.values.forEach((v,i)=>{
      const px = padL+i*stepX;
      const py = padT + ch - ((v-minV)/(maxV-minV||1))*ch;
      d += (i===0?'M':'L')+px+','+py+' ';
    });
    area = d + `L${padL+cw},${padT+ch} L${padL},${padT+ch} Z`;
    if(s.area) paths += `<path d="${area}" fill="${s.color}" opacity="0.12"/>`;
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4"/>`;
    s.values.forEach((v,i)=>{
      const px = padL+i*stepX;
      const py = padT + ch - ((v-minV)/(maxV-minV||1))*ch;
      paths += `<circle cx="${px}" cy="${py}" r="3" fill="${s.color}"><title>${xs[i]}: ${s.fmt?s.fmt(v):v}</title></circle>`;
    });
  });
  container.innerHTML = svgEl(W,H) + grid + paths + axisX + '</svg>';
}

// Donut chart
function donutChart(container, rows, opts){
  opts = opts||{};
  const size = opts.size||180, r=size*0.38, cx=size/2, cy=size/2, rw=opts.thickness||22;
  const total = rows.reduce((a,b)=>a+b.value,0)||1;
  let angle=-90, paths='';
  rows.forEach((row,i)=>{
    const frac = row.value/total;
    const start = angle;
    const end = angle + frac*360;
    angle = end;
    const large = (end-start)>180?1:0;
    const toXY = (a,rad)=>{
      const rad2 = (a*Math.PI/180);
      return [cx+rad*Math.cos(rad2), cy+rad*Math.sin(rad2)];
    };
    const [x1,y1] = toXY(start, r);
    const [x2,y2] = toXY(end, r);
    const col = row.color || PALETTE[i%PALETTE.length];
    paths += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="${rw}"><title>${row.label}: ${row.value} (${(frac*100).toFixed(1)}%)</title></path>`;
  });
  let center = opts.center ? `<text x="${cx}" y="${cy-3}" text-anchor="middle" font-family="var(--mono)" font-size="18" font-weight="700" fill="var(--ink)">${opts.center}</text><text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="9.5" fill="var(--text-soft)">${opts.centerSub||''}</text>` : '';
  container.innerHTML = `<div style="display:flex; align-items:center; gap:18px; flex-wrap:wrap;">
    ${svgEl(size,size)}${paths}${center}</svg>
    <div class="legend" style="flex-direction:column; gap:7px; margin-top:0;">
      ${rows.map((row,i)=>`<div><span class="dot" style="background:${row.color||PALETTE[i%PALETTE.length]}"></span>${row.label} — <strong>${row.display||row.value}</strong></div>`).join('')}
    </div>
  </div>`;
}

/* ================= PAGE DEFINITIONS ================= */
const PAGES = [
  {code:'01·OVW', title:'Executive Overview', id:'overview'},
  {code:'02·SLS', title:'Sales & Revenue', id:'sales'},
  {code:'03·DST', title:'Destination & Peak Travel', id:'destinations'},
  {code:'04·VSA', title:'Visa & Documentation Ops', id:'visa'},
  {code:'05·CUS', title:'Customer Insights', id:'customers'},
  {code:'06·PAY', title:'Payments & Collections', id:'payments'},
  {code:'07·FLH', title:'Flights & Hotels', id:'flighthotels'},
];

function buildNav(){
  const nav = document.getElementById('nav');
  nav.innerHTML = PAGES.map(p=>`<button class="navitem" data-id="${p.id}"><span class="code">${p.code}</span><span>${p.title}</span></button>`).join('');
  nav.querySelectorAll('.navitem').forEach(btn=>{
    btn.addEventListener('click', ()=> showPage(btn.dataset.id));
  });
}

function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.navitem').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelector(`.navitem[data-id="${id}"]`).classList.add('active');
  window.scrollTo(0,0);
}

function head(eyebrow, title, sub, stamp){
  return `<div class="pagehead">
    <div>
      <div class="eyebrow">${eyebrow}</div>
      <h2>${title}</h2>
      <p>${sub}</p>
    </div>
    <div class="stamp">${stamp}</div>
  </div>`;
}

function buildMain(){
  const main = document.getElementById('main');
  main.innerHTML = PAGES.map(p=>`<section class="page" id="page-${p.id}"></section>`).join('');
  renderOverview();
  renderSales();
  renderDestinations();
  renderVisa();
  renderCustomers();
  renderPayments();
  renderFlightsHotels();
}

/* ---------- 1. EXECUTIVE OVERVIEW ---------- */
function renderOverview(){
  const k = DATA.kpi;
  const el = document.getElementById('page-overview');
  el.innerHTML = `
    ${head('Gate 01 · The 10-second health check','Executive Overview','Trip-level performance across all confirmed and cancelled bookings, Jan 2023 – Dec 2025.', 'BOARDING · ALL ROUTES')}
    <div class="kpirow">
      <div class="kpi"><div class="label">Total Revenue</div><div class="value">${INRc(k.totalRevenue)}</div><div class="delta">${k.totalBookings} bookings logged</div></div>
      <div class="kpi teal"><div class="label">Total Profit</div><div class="value">${INRc(k.totalProfit)}</div><div class="delta">on ${INRc(k.totalCost)} cost base</div></div>
      <div class="kpi teal"><div class="label">Overall Margin</div><div class="value">${pct(k.marginPct)}</div><div class="delta">of gross revenue</div></div>
      <div class="kpi sky"><div class="label">Avg Deal Size</div><div class="value">${INRc(k.avgDealSize)}</div><div class="delta">per booking</div></div>
      <div class="kpi"><div class="label">Confirmed / Cancelled</div><div class="value">${k.confirmed} / ${k.cancelled}</div><div class="delta">${pct(k.cancelled/k.totalBookings*100)} cancellation rate</div></div>
      <div class="kpi coral"><div class="label">Avg Rating</div><div class="value">${k.avgRating} / 5</div><div class="delta">${k.repeatCustomers} repeat customers</div></div>
    </div>

    <div class="grid cols-2">
      <div class="card span2">
        <h3>Revenue &amp; Profit Trend</h3>
        <div class="cardsub">Monthly booking-date revenue vs. profit, full dataset window</div>
        <div id="chart-trend"></div>
        <div class="legend"><span><span class="dot" style="background:var(--amber)"></span>Revenue</span><span><span class="dot" style="background:var(--teal)"></span>Profit</span></div>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Top Destinations by Revenue</h3>
        <div class="cardsub">All ${k.totalDestinations} destinations, ${k.totalPackages} packages</div>
        <div id="chart-topdest"></div>
      </div>
      <div class="card">
        <h3>Portfolio Snapshot</h3>
        <div class="cardsub">Where the business stands today</div>
        <table>
          <tr><td>Total Customers</td><td class="num">${k.totalCustomers.toLocaleString()}</td></tr>
          <tr><td>Total Passengers Travelled</td><td class="num">${k.totalPassengers.toLocaleString()}</td></tr>
          <tr><td>Repeat Customers</td><td class="num">${k.repeatCustomers} (${pct(k.repeatCustomers/k.totalCustomers*100)})</td></tr>
          <tr><td>Confirmed Bookings</td><td class="num">${k.confirmed}</td></tr>
          <tr><td>Cancelled Bookings</td><td class="num">${k.cancelled}</td></tr>
          <tr><td>Destinations on Offer</td><td class="num">${k.totalDestinations}</td></tr>
          <tr><td>Active Packages</td><td class="num">${k.totalPackages}</td></tr>
        </table>
        <p class="footnote">Note: figures reflect a single-proprietor operation — all sales, visa filing, and coordination are handled directly (no separate sales/ops staff on record in this dataset).</p>
      </div>
    </div>
  `;
  const months = DATA.monthlyTrend.map(r=>r.MonthKey.slice(2));
  lineChart(document.getElementById('chart-trend'), months, [
    {values: DATA.monthlyTrend.map(r=>r.Revenue), color:'#E2A542', area:true, fmt:INRc},
    {values: DATA.monthlyTrend.map(r=>r.Profit), color:'#1C7C74', area:true, fmt:INRc},
  ], {width:900, height:230, xEvery:2, fmtY:INRc});

  hBarList(document.getElementById('chart-topdest'), DATA.topDestinations.slice(0,8).map(r=>({
    label:r.DestLabel, value:r.Revenue, display:INRc(r.Revenue)
  })));
}

/* ---------- 2. SALES & REVENUE PERFORMANCE ---------- */
function renderSales(){
  const el = document.getElementById('page-sales');
  el.innerHTML = `
    ${head('Gate 02 · Where the revenue comes from','Sales & Revenue Performance','Revenue by package, booking source, season, and the effect of discounting on margin.', 'DEPARTURE · REVENUE')}
    <div class="grid cols-2">
      <div class="card">
        <h3>Revenue by Package</h3>
        <div class="cardsub">All ${DATA.packageRevenue.length} active packages</div>
        <div id="chart-pkgrev"></div>
      </div>
      <div class="card">
        <h3>Booking Source Performance</h3>
        <div class="cardsub">Revenue and volume by acquisition channel</div>
        <table>
          <thead><tr><th>Source</th><th class="num">Bookings</th><th class="num">Revenue</th><th class="num">Avg Rating</th></tr></thead>
          <tbody>
          ${DATA.sourcePerf.map(r=>`<tr><td>${r.BookingSource}</td><td class="num">${r.Bookings}</td><td class="num">${INRc(r.Revenue)}</td><td class="num">${r.AvgRating}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Peak vs Off-Peak Season</h3>
        <div class="cardsub">Revenue, bookings and average margin split</div>
        <div id="chart-season"></div>
      </div>
      <div class="card">
        <h3>Discount Impact on Margin</h3>
        <div class="cardsub">Average margin % by discount band applied</div>
        <table>
          <thead><tr><th>Discount Band</th><th class="num">Bookings</th><th class="num">Avg Revenue</th><th class="num">Avg Margin</th></tr></thead>
          <tbody>
          ${DATA.discountImpact.map(r=>`<tr><td>${r.DiscountBand}</td><td class="num">${r.Bookings}</td><td class="num">${INRc(r.AvgRevenue)}</td><td class="num">${pct(r.AvgMargin)}</td></tr>`).join('')}
          </tbody>
        </table>
        <p class="footnote">Deeper discounting tracks with thinner margin per booking — worth watching on high-discount packages.</p>
      </div>
    </div>
  `;
  hBarList(document.getElementById('chart-pkgrev'), DATA.packageRevenue.map(r=>({
    label:r.Package_Name, value:r.Revenue, display:INRc(r.Revenue)
  })));
  donutChart(document.getElementById('chart-season'), DATA.seasonRev.map((r,i)=>({
    label:r.Season, value:r.Revenue, display:`${INRc(r.Revenue)} · ${r.Bookings} bkgs`, color: r.Season==='Peak'?'#E2A542':'#4C7EA8'
  })), {center: pct(DATA.seasonRev.find(r=>r.Season==='Peak').Revenue/(DATA.seasonRev.reduce((a,b)=>a+b.Revenue,0))*100), centerSub:'Peak share'});
}

/* ---------- 3. DESTINATION & PEAK TRAVEL ANALYTICS ---------- */
function renderDestinations(){
  const el = document.getElementById('page-destinations');
  const visaBk = DATA.bookingVisaMix;
  el.innerHTML = `
    ${head('Gate 03 · Peak-location intelligence','Destination & Peak Travel Analytics','Bookings and revenue by destination, price range vs. what was actually realised, and the visa-required mix.', 'TRANSIT · DESTINATIONS')}
    <div class="grid cols-2">
      <div class="card span2">
        <h3>Bookings by Destination</h3>
        <div class="cardsub">Sorted by revenue, all ${DATA.destPriceRealized.length} destinations</div>
        <div id="chart-destbook"></div>
      </div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Listed Price Range vs. Realised Avg Revenue</h3>
        <div class="cardsub">Per-booking average revenue vs. the brochure Min–Max band</div>
        <table>
          <thead><tr><th>Destination</th><th class="num">Listed Range</th><th class="num">Realised Avg</th></tr></thead>
          <tbody>
          ${DATA.destPriceRealized.map(r=>`<tr><td>${r.DestLabel}</td><td class="num">${INRc(r.MinPrice)}–${INRc(r.MaxPrice)}</td><td class="num">${r.Bookings>0?INRc(r.RealizedAvgRevenue):'—'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="card">
        <h3>Visa-Required vs Visa-Free Mix</h3>
        <div class="cardsub">Destination catalog (left) and actual booking volume (right)</div>
        <div style="display:flex; gap:24px; flex-wrap:wrap;">
          <div style="flex:1; min-width:180px;">
            <div class="cardsub" style="margin-bottom:6px;">By destination catalog</div>
            <div id="chart-visadestmix"></div>
          </div>
          <div style="flex:1; min-width:180px;">
            <div class="cardsub" style="margin-bottom:6px;">By booking volume</div>
            <div id="chart-visabookmix"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  hBarList(document.getElementById('chart-destbook'), DATA.destPriceRealized.filter(r=>r.Bookings>0).map(r=>({
    label:r.DestLabel, value:r.Revenue, display:`${r.Bookings} bkgs · ${INRc(r.Revenue)}`
  })));
  donutChart(document.getElementById('chart-visadestmix'), DATA.visaMixDest.map(r=>({
    label:r.Visa_Required==='Yes'?'Visa Required':'Visa Free', value:r.Count, color:r.Visa_Required==='Yes'?'#D9634B':'#1C7C74'
  })), {size:150});
  donutChart(document.getElementById('chart-visabookmix'), DATA.bookingVisaMix.map(r=>({
    label:r.Visa_Required==='Yes'?'Visa Required':'Visa Free', value:r.Bookings, color:r.Visa_Required==='Yes'?'#D9634B':'#1C7C74'
  })), {size:150});
}

/* ---------- 4. VISA & DOCUMENTATION OPS ---------- */
function renderVisa(){
  const el = document.getElementById('page-visa');
  el.innerHTML = `
    ${head('Gate 04 · Operational maturity','Visa & Documentation Ops','Approval rates, processing times, and where visa applications tend to bottleneck.', 'CUSTOMS · VISA DESK')}
    <div class="kpirow">
      <div class="kpi teal"><div class="label">Approval Rate (applicable cases)</div><div class="value">${pct(DATA.visaApprovalRate)}</div><div class="delta">${DATA.visaApproved} of ${DATA.visaApplicable} applications</div></div>
      <div class="kpi"><div class="label">Pending</div><div class="value">${DATA.visaPending}</div><div class="delta">awaiting decision</div></div>
      <div class="kpi coral"><div class="label">Rejected</div><div class="value">${DATA.visaRejected}</div><div class="delta">of ${DATA.visaApplicable} applicable</div></div>
      <div class="kpi sky"><div class="label">Visa Not Required</div><div class="value">${DATA.visaStatus.find(r=>r.Status==='Not Required').Count}</div><div class="delta">of ${DATA.kpi.totalBookings} bookings</div></div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Visa Status Breakdown</h3>
        <div class="cardsub">All 500 bookings</div>
        <div id="chart-visastatus"></div>
      </div>
      <div class="card">
        <h3>Avg Processing Days by Visa Type</h3>
        <div class="cardsub">Applicable visa types only</div>
        <div id="chart-visatype"></div>
      </div>
    </div>
    <div class="grid cols-2">
      <div class="card span2">
        <h3>Bottleneck Destinations</h3>
        <div class="cardsub">Destinations ranked by average visa processing time</div>
        <table>
          <thead><tr><th>Destination</th><th class="num">Applications</th><th class="num">Avg Processing Days</th><th class="num">Pending</th><th class="num">Rejected</th></tr></thead>
          <tbody>
          ${DATA.destVisaBottleneck.map(r=>`<tr><td>${r.DestLabel}</td><td class="num">${r.Applications}</td><td class="num">${r.AvgProcessingDays}</td><td class="num">${r.Pending}</td><td class="num">${r.Rejected}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  donutChart(document.getElementById('chart-visastatus'), DATA.visaStatus.map(r=>({
    label:r.Status, value:r.Count,
    color: r.Status==='Approved'?'#1C7C74':r.Status==='Rejected'?'#D9634B':r.Status==='Pending'?'#E2A542':'#4C7EA8'
  })));
  columnChart(document.getElementById('chart-visatype'), DATA.visaTypeProcessing.map(r=>({
    label:r.VisaType, value:r.AvgProcessingDays, display:r.AvgProcessingDays+' days', color:'#4C7EA8'
  })), {width:400, height:220});
}

/* ---------- 5. CUSTOMER INSIGHTS ---------- */
function renderCustomers(){
  const el = document.getElementById('page-customers');
  const newCt = DATA.customerType.find(r=>r.CustomerType==='New').Count;
  const retCt = DATA.customerType.find(r=>r.CustomerType==='Returning').Count;
  el.innerHTML = `
    ${head('Gate 05 · Who is flying with us','Customer Insights','Demographics, repeat behaviour, and satisfaction across ${DATA.kpi.totalCustomers} customers.'.replace('${DATA.kpi.totalCustomers}', DATA.kpi.totalCustomers), 'PASSENGER · MANIFEST')}
    <div class="kpirow">
      <div class="kpi"><div class="label">New Customers</div><div class="value">${newCt}</div><div class="delta">${pct(newCt/DATA.kpi.totalCustomers*100)} of base</div></div>
      <div class="kpi teal"><div class="label">Returning Customers</div><div class="value">${retCt}</div><div class="delta">${pct(retCt/DATA.kpi.totalCustomers*100)} of base</div></div>
      <div class="kpi coral"><div class="label">Avg Rating</div><div class="value">${DATA.kpi.avgRating} / 5</div><div class="delta">across confirmed trips</div></div>
      <div class="kpi sky"><div class="label">Top State</div><div class="value" style="font-size:17px;">${DATA.stateDist[0].State}</div><div class="delta">${DATA.stateDist[0].Count} customers</div></div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Age Distribution</h3>
        <div class="cardsub">Customer base by age band</div>
        <div id="chart-age"></div>
      </div>
      <div class="card">
        <h3>Gender &amp; Income Band</h3>
        <div class="cardsub">Two-way demographic split</div>
        <div style="display:flex; gap:20px; flex-wrap:wrap;">
          <div style="flex:1; min-width:150px;"><div class="cardsub" style="margin-bottom:6px;">Gender</div><div id="chart-gender"></div></div>
          <div style="flex:1; min-width:150px;"><div class="cardsub" style="margin-bottom:6px;">Income Band</div><div id="chart-income"></div></div>
        </div>
      </div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Client Base by State</h3>
        <div class="cardsub">Top states by customer count</div>
        <div id="chart-state"></div>
      </div>
      <div class="card">
        <h3>Rating Distribution &amp; Repeat Value</h3>
        <div class="cardsub">Customer satisfaction and revenue by repeat status</div>
        <div id="chart-rating"></div>
        <hr class="divider-dash">
        <table>
          <thead><tr><th>Customer</th><th class="num">Bookings</th><th class="num">Revenue</th></tr></thead>
          <tbody>
          ${DATA.repeatRev.map(r=>`<tr><td>${r.RepeatCustomer==='Yes'?'Repeat':'First-time'}</td><td class="num">${r.Bookings}</td><td class="num">${INRc(r.Revenue)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  columnChart(document.getElementById('chart-age'), DATA.ageDist.map(r=>({label:r.AgeBand, value:r.Count, display:r.Count, color:'#E2A542'})), {width:480, height:200});
  donutChart(document.getElementById('chart-gender'), DATA.genderDist.map((r,i)=>({label:r.Gender, value:r.Count})), {size:150});
  donutChart(document.getElementById('chart-income'), DATA.incomeDist.map((r,i)=>({label:r.IncomeBand, value:r.Count})), {size:150});
  hBarList(document.getElementById('chart-state'), DATA.stateDist.slice(0,8).map(r=>({label:r.State, value:r.Count, display:r.Count})), {color:'#4C7EA8'});
  columnChart(document.getElementById('chart-rating'), DATA.ratingDist.map(r=>({label:r.Rating+'★', value:r.Count, display:r.Count, color:'#1C7C74'})), {width:480, height:180});
}

/* ---------- 6. PAYMENTS & COLLECTIONS ---------- */
function renderPayments(){
  const el = document.getElementById('page-payments');
  const advPct = (DATA.totalAdvance/(DATA.totalAdvance+DATA.totalBalance)*100);
  el.innerHTML = `
    ${head('Gate 06 · Cash in the till','Payments & Collections','Advance vs balance collection, payment mode preference, and where money is still outstanding.', 'FINANCE · TREASURY')}
    <div class="kpirow">
      <div class="kpi teal"><div class="label">Collected (Paid)</div><div class="value">${INRc(DATA.paidCollection)}</div><div class="delta">across all installments</div></div>
      <div class="kpi coral"><div class="label">Pending Collection</div><div class="value">${INRc(DATA.pendingCollection)}</div><div class="delta">outstanding across installments</div></div>
      <div class="kpi"><div class="label">Advance Collected</div><div class="value">${INRc(DATA.totalAdvance)}</div><div class="delta">${pct(advPct)} of booking value</div></div>
      <div class="kpi sky"><div class="label">Balance Due</div><div class="value">${INRc(DATA.totalBalance)}</div><div class="delta">${pct(100-advPct)} of booking value</div></div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Payment Mode Split</h3>
        <div class="cardsub">By transaction count, ${DATA.paymentModeCount.reduce((a,b)=>a+b.Count,0)} payments</div>
        <div id="chart-paymode"></div>
      </div>
      <div class="card">
        <h3>Payment Status</h3>
        <div class="cardsub">Booking-level payment status (Advance + Final)</div>
        <div id="chart-paystatus"></div>
      </div>
    </div>
    <div class="grid cols-2">
      <div class="card span2">
        <h3>Installment Breakdown</h3>
        <div class="cardsub">Advance vs Final collection totals</div>
        <table>
          <thead><tr><th>Installment</th><th class="num">Transactions</th><th class="num">Total Amount</th></tr></thead>
          <tbody>
          ${DATA.installmentSplit.map(r=>`<tr><td>${r.Installment}</td><td class="num">${r.Count}</td><td class="num">${INRc(r.TotalAmount)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  donutChart(document.getElementById('chart-paymode'), DATA.paymentModeCount.map(r=>({label:r.Mode, value:r.Count})));
  donutChart(document.getElementById('chart-paystatus'), DATA.bookingPayStatus.map(r=>({
    label:r.PaymentStatus, value:r.Count,
    color: r.PaymentStatus==='Paid'?'#1C7C74':r.PaymentStatus==='Pending'?'#D9634B':'#E2A542'
  })));
}

/* ---------- 7. FLIGHTS & HOTELS UTILIZATION ---------- */
function renderFlightsHotels(){
  const el = document.getElementById('page-flighthotels');
  el.innerHTML = `
    ${head('Gate 07 · Supply-side utilisation','Flights & Hotels Utilization','Airline and route frequency, direct vs connecting mix, and hotel category / meal-plan preferences.', 'OPERATIONS · FLEET')}
    <div class="grid cols-2">
      <div class="card">
        <h3>Airline Frequency</h3>
        <div class="cardsub">Flight options on file, by airline</div>
        <div id="chart-airline"></div>
      </div>
      <div class="card">
        <h3>Direct vs Connecting</h3>
        <div class="cardsub">All flight options are Economy cabin</div>
        <div id="chart-flighttype"></div>
      </div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Hotel Category — Supply vs Bookings</h3>
        <div class="cardsub">Catalog mix (left) vs. what customers actually booked (right)</div>
        <div style="display:flex; gap:24px; flex-wrap:wrap;">
          <div style="flex:1; min-width:180px;"><div class="cardsub" style="margin-bottom:6px;">Hotel catalog</div><div id="chart-hotelsupply"></div></div>
          <div style="flex:1; min-width:180px;"><div class="cardsub" style="margin-bottom:6px;">Booking volume</div><div id="chart-hotelbook"></div></div>
        </div>
      </div>
      <div class="card">
        <h3>Meal Plan &amp; Seat Preference</h3>
        <div class="cardsub">Hotel meal plans and passenger seat choices</div>
        <div style="display:flex; gap:20px; flex-wrap:wrap;">
          <div style="flex:1; min-width:150px;"><div class="cardsub" style="margin-bottom:6px;">Meal Plan (hotels)</div><div id="chart-meal"></div></div>
          <div style="flex:1; min-width:150px;"><div class="cardsub" style="margin-bottom:6px;">Seat Pref (${DATA.seatPref.reduce((a,b)=>a+b.Count,0)} pax)</div><div id="chart-seat"></div></div>
        </div>
        <p class="footnote">Travel insurance uptake: ${DATA.insurance.find(r=>r.Insurance==='Yes').Count} of ${DATA.insurance.reduce((a,b)=>a+b.Count,0)} passengers (${pct(DATA.insurance.find(r=>r.Insurance==='Yes').Count/DATA.insurance.reduce((a,b)=>a+b.Count,0)*100)}).</p>
      </div>
    </div>
  `;
  hBarList(document.getElementById('chart-airline'), DATA.airlineFreq.map(r=>({label:r.Airline, value:r.Count, display:r.Count})), {color:'#4C7EA8'});
  donutChart(document.getElementById('chart-flighttype'), DATA.flightType.map(r=>({label:r.Type, value:r.Count})));
  donutChart(document.getElementById('chart-hotelsupply'), DATA.hotelCatSupply.map(r=>({label:r.Category, value:r.Count})), {size:150});
  donutChart(document.getElementById('chart-hotelbook'), DATA.hotelCatBookings.map(r=>({label:r.Category, value:r.Bookings})), {size:150});
  donutChart(document.getElementById('chart-meal'), DATA.mealPlan.map(r=>({label:r.MealPlan, value:r.Count})), {size:150});
  donutChart(document.getElementById('chart-seat'), DATA.seatPref.map(r=>({label:r.SeatPref, value:r.Count})), {size:150});
}

/* ---------------- INIT ---------------- */
buildNav();
buildMain();
showPage('overview');
