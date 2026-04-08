// ── 유틸 ──
const fmt = n => Number(n||0).toLocaleString();
const esc = v => String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const uid = () => 'u'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
const toast = msg => {
  const el=document.createElement('div');
  el.style.cssText='position:fixed;bottom:24px;right:24px;background:#1a1d23;color:#fff;padding:11px 18px;border-radius:7px;font-size:12px;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,.2)';
  el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>el.remove(),2500);
};

function parseExp(str){
  if(!str) return null;
  const p=String(str).replace('/','-').split('-');
  if(p.length<2) return null;
  const y=p[0].length===2?'20'+p[0]:p[0];
  return new Date(y+'-'+String(p[1]).padStart(2,'0')+'-01');
}
function expStatus(str){
  const d=parseExp(str); if(!d) return '';
  const now=new Date(); now.setDate(1); now.setHours(0,0,0,0);
  const diff=Math.round((d-now)/(1000*60*60*24*30));
  if(diff<0) return 'expired';
  if(diff<=3) return 'danger';
  if(diff<=6) return 'warn';
  return 'ok';
}

// ── 기획 차감 맵 ──
function getPlanMap(){
  const map={};
  plans.forEach(pl=>{
    if(pl.status==='완료') return;
    pl.items.forEach(item=>{
      const k=item.code; if(!k) return;
      const sold=Number(item.soldQty||0);
      // 판매수량이 이미 입력된 항목은 재고에 반영됐으므로 차감 표시 제외
      if(sold>0) return;
      if(!map[k]) map[k]={qty:0,sources:[]};
      map[k].qty+=Number(item.qty||0);
      const label=pl.channel+(pl.from?' '+pl.from.slice(5).replace('-','.'):'');
      if(!map[k].sources.includes(label)) map[k].sources.push(label);
    });
  });
  return map;
}

// ── 판매 완료 수량 맵 (가용재고 차감용) ──
function getSoldMap(){
  // 판매수량이 입력된 항목만 집계 (진행중/완료 모두 포함)
  const map={};
  plans.forEach(pl=>{
    pl.items.forEach(item=>{
      const k=item.code; if(!k) return;
      const sold=Number(item.soldQty||0);
      if(!sold) return;
      if(!map[k]) map[k]={qty:0,sources:[]};
      map[k].qty+=sold;
      const label=pl.channel+(pl.from?' '+pl.from.slice(5).replace('-','.'):'');
      if(!map[k].sources.includes(label)) map[k].sources.push(label);
    });
  });
  return map;
}

// ── 입고 예정 맵 ──
function getIncMap(){
  const map={};
  incoming.forEach(inc=>{
    const k=inc.code||inc.name; if(!k) return;
    if(!map[k]) map[k]={qty:0,dates:[]};
    map[k].qty+=Number(inc.qty||0);
    if(inc.date&&!map[k].dates.includes(inc.date)) map[k].dates.push(inc.date);
  });
  return map;
}

// ── 재고 현황 ──
function renderDashboard(){
  const q=(document.getElementById('ds-q').value||'').toLowerCase();
  const sf=document.getElementById('ds-sf').value||'';
  const expF=document.getElementById('exp-filter').value||'';
  const expFDate=expF?new Date(expF):null;

  const planMap=getPlanMap();
  const soldMap=getSoldMap();
  const incMap=getIncMap();

  // 유통기한 필터 후 코드별 합산
  let rows=[...stockDB];
  if(expFDate) rows=rows.filter(r=>{
    const d=parseExp(r.exp);
    return !d||d>=expFDate;
  });

  // 코드별 그룹핑 → 합산
  const grouped={};
  rows.forEach(r=>{
    if(!grouped[r.code]){
      grouped[r.code]={
        code:r.code, name:r.name,
        loc1:0, loc2:0, stock:0,
        exps:[] // 유통기한 목록
      };
    }
    grouped[r.code].loc1+=r.loc1;
    grouped[r.code].loc2+=r.loc2;
    grouped[r.code].stock+=r.stock;
    if(r.exp&&!grouped[r.code].exps.includes(r.exp)) grouped[r.code].exps.push(r.exp);
  });

  // 검색 필터
  let merged=Object.values(grouped);
  if(q) merged=merged.filter(r=>r.name.toLowerCase().includes(q)||r.code.includes(q));

  // 기획차감·판매수량·가용재고 계산
  const computed=merged.map(r=>{
    // 기획차감: 판매수량 미입력 + 진행중/예정인 것
    const pm=planMap[r.code]||null;
    const planned=pm?pm.qty:0;
    const sources=pm?pm.sources:[];
    // 판매수량: 이미 판매 확정된 수량
    const sm=soldMap[r.code]||null;
    const sold=sm?sm.qty:0;
    const soldSources=sm?sm.sources:[];
    // 가용재고 = 실재고 - 기획차감 - 판매수량
    const avail=r.stock-planned-sold;
    const im=incMap[r.code]||null;
    const incQty=im?im.qty:0;
    const incDates=im?im.dates:[];
    const projAvail=avail+incQty;
    const exps=r.exps.sort();
    const earliestExp=exps[0]||'';
    const es=expStatus(earliestExp);
    return {...r,planned,sources,sold,soldSources,avail,incQty,incDates,projAvail,es,exps,earliestExp};
  });

  // 상태 필터
  let filtered=computed;
  if(sf==='zero')    filtered=computed.filter(r=>r.avail<=0);
  if(sf==='exp')     filtered=computed.filter(r=>r.es==='danger'||r.es==='expired');
  if(sf==='planned') filtered=computed.filter(r=>r.planned>0);
  if(sf==='inc')     filtered=computed.filter(r=>r.incQty>0);

  // 통계
  document.getElementById('st-total').textContent=Object.keys(grouped).length;
  document.getElementById('st-planned').textContent=Object.keys(planMap).length;
  document.getElementById('st-zero').textContent=computed.filter(r=>r.avail<=0).length;
  document.getElementById('st-exp').textContent=computed.filter(r=>r.es==='danger'||r.es==='expired').length;
  document.getElementById('st-inc').textContent=Object.keys(incMap).length;
  document.getElementById('ds-count').textContent=filtered.length+'개 상품 (합산) / 원본 '+stockDB.length+'개 행';

  const tbody=document.getElementById('ds-tbody');
  if(!filtered.length){ tbody.innerHTML='<tr><td colspan="10" class="empty">검색 결과 없음</td></tr>'; return; }

  tbody.innerHTML=filtered.map(r=>{
    const availCls=r.avail<=0?'td-zero':r.avail<=10?'td-warn':'td-ok';
    const expCls=r.es==='expired'||r.es==='danger'?'exp-danger':r.es==='warn'?'exp-warn':'exp-ok';
    // 유통기한별 상세 행
    const expRows=stockDB
      .filter(s=>s.code===r.code&&s.exp)
      .filter(s=>!expFDate||!parseExp(s.exp)||(parseExp(s.exp)>=expFDate))
      .sort((a,b)=>a.exp>b.exp?1:-1);
    const safeCode=r.code.replace(/[^a-zA-Z0-9]/g,'_');
    const detailHtml=expRows.length>1?expRows.map(s=>{
      const sc=expStatus(s.exp);
      const dc=sc==='expired'||sc==='danger'?'exp-danger':sc==='warn'?'exp-warn':'exp-ok';
      const safeExp=s.exp.replace(/[^a-zA-Z0-9]/g,'_');
      return `<tr id="exp-detail-${safeCode}_${safeExp}" style="display:none;background:#f0f7ff">
        <td colspan="2" style="padding:5px 14px 5px 28px;font-size:11px;color:var(--muted)">└ ${s.exp}</td>
        <td style="font-size:11px;font-weight:600;padding:5px 14px" class="${dc}">${s.exp}</td>
        <td class="r" style="font-size:11px;color:var(--muted);padding:5px 14px">${fmt(s.loc1)}</td>
        <td class="r" style="font-size:11px;color:var(--muted);padding:5px 14px">${fmt(s.loc2)}</td>
        <td class="r" style="font-size:11px;font-weight:700;color:var(--blue);padding:5px 14px">${fmt(s.stock)}</td>
        <td colspan="5" style="padding:5px 14px"></td>
      </tr>`;
    }).join(''):'';

    const expDisp=expRows.length>1
      ? `<span class="${expCls}" style="cursor:pointer;border-bottom:1px dashed currentColor"
            onclick="toggleExpDetail('${r.code}')" title="클릭: 유통기한 상세">
            ${expRows[0].exp} 외 ${expRows.length-1}건 ▾</span>`
      : `<span class="${expCls}">${r.exps[0]||'-'}</span>`;
    const planCell=r.planned>0
      ?`<span style="font-weight:700;color:var(--amber)">-${fmt(r.planned)}</span><br><span style="font-size:10px;color:var(--amber)">${esc(r.sources.join(', '))}</span>`
      :'<span style="color:var(--muted)">-</span>';
    const soldCell=r.sold>0
      ?`<span style="font-weight:700;color:var(--red)">-${fmt(r.sold)}</span><br><span style="font-size:10px;color:var(--red)">${esc(r.soldSources.join(', '))}</span>`
      :'<span style="color:var(--muted)">-</span>';
    const incCell=r.incQty>0?`<span style="color:var(--purple);font-weight:700">+${fmt(r.incQty)}</span>`:'<span style="color:var(--muted)">-</span>';
    const projCell=r.incQty>0?`<span style="color:var(--purple);font-weight:700">${fmt(r.projAvail)}</span>`:'<span style="color:var(--muted)">-</span>';
    return `<tr style="cursor:default">
      <td><code>${esc(r.code)}</code></td>
      <td style="font-weight:500">${esc(r.name)}</td>
      <td class="r" style="color:var(--muted);font-size:12px">${PRODUCT_DB[r.code]?fmt(PRODUCT_DB[r.code].price)+'원':'-'}</td>
      <td onclick="toggleExpDetail('${r.code}')" style="${expRows.length>1?'cursor:pointer':''}">${expDisp}</td>
      <td class="r">${fmt(r.loc1)}</td>
      <td class="r">${fmt(r.loc2)}</td>
      <td class="r" style="font-weight:600">${fmt(r.stock)}</td>
      <td>${planCell}</td>
      <td style="background:#fff5f5">${soldCell}</td>
      <td class="r ${availCls}">${fmt(r.avail)}</td>
      <td class="td-proj r">${incCell}</td>
      <td class="td-proj r">${projCell}</td>
    </tr>${detailHtml}`;
  }).join('');
}

function toggleExpDetail(code){
  const safeCode=code.replace(/[^a-zA-Z0-9]/g,'_');
  const rows=document.querySelectorAll('[id^="exp-detail-'+safeCode+'_"]');
  if(!rows.length) return;
  const isHidden=rows[0].style.display==='none';
  rows.forEach(r=>r.style.display=isHidden?'table-row':'none');
}

// ── 기획 모달 ──
let planEditId=null;

function openPlanModal(id){
  planEditId=id||null; rowIdx=0;
  document.getElementById('pl-items').innerHTML='';
  document.getElementById('paste-area').style.display='none';
  document.getElementById('btn-paste-toggle').textContent='붙여넣기로 입력';
  if(id){
    const pl=plans.find(p=>p.id===id);
    if(pl){
      document.getElementById('pl-ch').value=pl.channel;
      document.getElementById('pl-person').value=pl.person||'';
      document.getElementById('pl-from').value=pl.from||'';
      document.getElementById('pl-to').value=pl.to||'';
      document.getElementById('pl-memo').value=pl.memo||'';
      pl.items.forEach(item=>addPlanRow(item));
    }
  } else {
    ['pl-ch','pl-person','pl-to','pl-memo'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('pl-from').value=new Date().toISOString().slice(0,10);
    addPlanRow();
  }
  document.getElementById('modal-plan').classList.add('open');
}

function addPlanRow(item){
  const i=rowIdx++;
  const code=item?.code||''; const name=item?.name||''; const qty=item?.qty||''; const price=item?.price||'';
  const tr=document.createElement('tr');
  tr.id='plr-'+i;
  tr.innerHTML=`
    <td style="padding:5px 8px">
      <input class="cell-in" id="plc-${i}" value="${esc(code)}" placeholder="관리코드"
        oninput="autoFillRow(${i})" style="font-family:monospace;width:110px">
    </td>
    <td style="padding:5px 8px;font-size:12px;color:var(--muted)" id="pln-${i}">
      ${name?'<span style="color:var(--text);font-weight:500">'+esc(name)+'</span>':'<span style="color:#ccc">코드 입력 시 자동</span>'}
    </td>
    <td style="padding:5px 8px;text-align:right;color:var(--muted)" id="plp-${i}">
      ${price?fmt(price)+'원':'-'}
    </td>
    <td style="padding:5px 8px">
      <input class="cell-in" id="plq-${i}" value="${esc(qty)}" type="number" placeholder="0" style="width:70px">
    </td>
    <td style="padding:5px 8px"><button class="btn-del" onclick="document.getElementById('plr-${i}').remove()">×</button></td>`;
  document.getElementById('pl-items').appendChild(tr);
}

function autoFillRow(i){
  const code=document.getElementById('plc-'+i).value.trim();
  if(!code) return;
  const prod=PRODUCT_DB[code];
  const nd=document.getElementById('pln-'+i);
  const pd=document.getElementById('plp-'+i);
  if(prod){
    if(nd) nd.innerHTML='<span style="color:var(--text);font-weight:500">'+esc(prod.name)+'</span>';
    if(pd) pd.textContent=fmt(prod.price)+'원';
  } else {
    const fb=stockDB.find(r=>r.code===code);
    if(fb&&nd) nd.innerHTML='<span style="color:var(--text);font-weight:500">'+esc(fb.name)+'</span>';
  }
}

function togglePaste(){
  const area=document.getElementById('paste-area');
  const btn=document.getElementById('btn-paste-toggle');
  const open=area.style.display!=='none';
  area.style.display=open?'none':'block';
  btn.textContent=open?'붙여넣기로 입력':'직접 입력';
}

function doPaste(){
  const text=document.getElementById('paste-box').value.trim();
  if(!text) return alert('내용이 없습니다');
  let added=0, notFound=[];
  text.split('\n').filter(l=>l.trim()).forEach(line=>{
    let cols=line.split('\t');
    if(cols.length<2) cols=line.trim().split(/\s{2,}/);
    if(cols.length<2) cols=line.trim().split(/[,;]/);
    if(cols.length<2) cols=line.trim().split(/\s+/);
    const code=(cols[0]||'').trim();
    const qty=Number((cols[1]||'').replace(/[^0-9]/g,''));
    if(!code||!qty) return;
    const prod=PRODUCT_DB[code];
    if(!prod) notFound.push(code);
    addPlanRow({code, name:prod?.name||'', price:prod?.price||'', qty});
    added++;
  });
  document.getElementById('paste-box').value='';
  document.getElementById('paste-area').style.display='none';
  document.getElementById('btn-paste-toggle').textContent='붙여넣기로 입력';
  let msg=added+'개 추가됨';
  if(notFound.length) msg+=' | 미매칭: '+notFound.join(', ');
  toast(msg);
}

function savePlan(){
  const ch=document.getElementById('pl-ch').value.trim();
  if(!ch) return alert('채널명을 입력하세요');

  const rawItems=[];
  document.querySelectorAll('#pl-items tr[id^="plr-"]').forEach(tr=>{
    const i=tr.id.replace('plr-','');
    const code=document.getElementById('plc-'+i)?.value.trim()||'';
    const qty=Number(document.getElementById('plq-'+i)?.value||0);
    if(!code||!qty) return;
    const prod=PRODUCT_DB[code];
    const nameEl=document.getElementById('pln-'+i);
    const name=nameEl?.querySelector('span')?.textContent.trim()||prod?.name||'';
    const price=prod?.price||'';
    rawItems.push({code,name,price,qty});
  });

  if(!rawItems.length) return alert('상품을 1개 이상 입력하세요');

  // 같은 관리코드 합산
  const merged={};
  rawItems.forEach(item=>{
    if(merged[item.code]){
      merged[item.code].qty+=item.qty;
    } else {
      merged[item.code]={...item};
    }
  });
  const items=Object.values(merged);

  // 기존 판매수량 유지 (수정 시)
  if(planEditId){
    const old=plans.find(p=>p.id===planEditId);
    if(old) items.forEach(item=>{
      const prev=old.items.find(i=>i.code===item.code);
      if(prev?.soldQty) item.soldQty=prev.soldQty;
    });
  }

  const pl={
    id:planEditId||uid(),
    channel:ch,
    person:document.getElementById('pl-person').value.trim(),
    from:document.getElementById('pl-from').value,
    to:document.getElementById('pl-to').value,
    memo:document.getElementById('pl-memo').value.trim(),
    status:'진행예정', items
  };
  if(planEditId){
    const idx=plans.findIndex(p=>p.id===planEditId);
    if(idx>=0){ pl.status=plans[idx].status; plans[idx]=pl; }
  } else plans.push(pl);

  closeModal('modal-plan');
  renderPlans(); renderDashboard();
  const dupMsg=rawItems.length>items.length?` (중복 ${rawItems.length-items.length}개 합산)`:'';
  toast('기획 저장 완료'+dupMsg);
}

function delPlan(id){
  if(!confirm('삭제할까요?')) return;
  plans=plans.filter(p=>p.id!==id);
  renderPlans(); renderDashboard();
}

function setStatus(id,val){
  const pl=plans.find(p=>p.id===id);
  if(pl){ pl.status=val; renderPlans(); renderDashboard(); }
}

function renderPlans(){
  const el=document.getElementById('plan-list');
  if(!plans.length){ el.innerHTML='<div class="empty">등록된 기획이 없습니다</div>'; return; }
  const chBg=['#dbeafe','#fee2e2','#d1fae5','#fef3c7','#ede9fe','#fce7f3'];
  const chFg=['#1e40af','#991b1b','#065f46','#92400e','#5b21b6','#9d174d'];
  const order={'진행중':0,'진행예정':1,'완료':2};
  const sorted=[...plans].sort((a,b)=>(order[a.status]||0)-(order[b.status]||0));
  el.innerHTML=sorted.map((pl,pi)=>{
    const ci=pi%chBg.length;
    const totalPlan=pl.items.reduce((s,i)=>s+Number(i.qty||0),0);
    const totalSold=pl.items.reduce((s,i)=>s+Number(i.soldQty||0),0);
    // 재고 차감은 판매수량이 있으면 판매수량, 없으면 기획수량
    const effectiveQty=totalSold>0?totalSold:totalPlan;
    const stColor={'진행예정':'#1e40af','진행중':'#92400e','완료':'#065f46'}[pl.status]||'#6b7280';
    const stBg={'진행예정':'#dbeafe','진행중':'#fef3c7','완료':'#d1fae5'}[pl.status]||'#f3f4f6';
    const safeId=pl.id.replace(/[^a-zA-Z0-9]/g,'_');

    const detailRows=pl.items.map((item,itemIdx)=>{
      const rows=stockDB.filter(r=>r.code===item.code);
      const curStock=rows.reduce((s,r)=>s+r.stock,0);
      const sold=Number(item.soldQty||0);
      // 차감 기준: 판매수량 있으면 판매수량, 없으면 기획수량
      const deduct=sold>0?sold:Number(item.qty||0);
      const avail=curStock-deduct;
      const rate=item.qty>0?Math.round(sold/item.qty*100):0;
      const rateColor=rate>=100?'var(--green)':rate>=70?'var(--amber)':sold>0?'var(--blue)':'var(--muted)';
      return `<tr style="background:#f8faff">
        <td style="padding:8px 14px"><code>${esc(item.code)}</code></td>
        <td style="padding:8px 14px;font-weight:500">${esc(item.name)}</td>
        <td style="padding:8px 14px;text-align:right;color:var(--muted)">${fmt(item.qty)}</td>
        <td style="padding:8px 14px;text-align:right">
          <input type="number" min="0" value="${sold||''}" placeholder="0"
            style="width:80px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;text-align:right;font-size:12px;font-family:inherit;outline:none"
            onfocus="this.style.borderColor='var(--blue)'"
            onblur="this.style.borderColor='var(--border)'"
            onchange="updateSoldQty('${pl.id}',${itemIdx},this.value)">
        </td>
        <td style="padding:8px 14px;text-align:right;font-size:11px;color:${rateColor};font-weight:600">${sold>0?rate+'%':'-'}</td>
        <td style="padding:8px 14px;text-align:right;color:var(--muted)">${fmt(curStock)}</td>
        <td style="padding:8px 14px;text-align:right;font-weight:700;color:${avail<=0?'var(--red)':avail<=10?'var(--amber)':'var(--green)'}">${fmt(avail)}</td>
      </tr>`;
    }).join('');

    return `<div class="plan-card" style="margin-bottom:6px">
      <div style="padding:11px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none" ondblclick="togglePlanDetail('${safeId}')">
        <span style="background:${chBg[ci]};color:${chFg[ci]};font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap">${esc(pl.channel)}</span>
        ${pl.person?`<span style="font-size:12px;color:var(--muted)">${esc(pl.person)}</span>`:''}
        <span style="font-size:12px;color:var(--muted)">${pl.from||''} ${pl.to?'~ '+pl.to:''}</span>
        ${pl.memo?`<span style="font-size:11px;color:var(--text);background:#f3f4f6;padding:1px 8px;border-radius:4px">${esc(pl.memo)}</span>`:''}
        <span style="font-size:11px;color:var(--muted)">상품 ${pl.items.length}개 · 기획 ${fmt(totalPlan)}개${totalSold>0?' · 판매 '+fmt(totalSold)+'개':''}</span>
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${stBg};color:${stColor};margin-left:auto">${pl.status}</span>
        <span style="font-size:10px;color:#ccc">더블클릭</span>
        <select onclick="event.stopPropagation()" onchange="setStatus('${pl.id}',this.value)"
          style="padding:3px 7px;border-radius:20px;border:1px solid var(--border);font-size:11px;background:var(--bg);cursor:pointer">
          <option ${pl.status==='진행예정'?'selected':''}>진행예정</option>
          <option ${pl.status==='진행중'?'selected':''}>진행중</option>
          <option ${pl.status==='완료'?'selected':''}>완료</option>
        </select>
        <button onclick="event.stopPropagation();openPlanModal('${pl.id}')" class="btn btn-outline btn-sm">수정</button>
        <button onclick="event.stopPropagation();delPlan('${pl.id}')" class="btn-del">×</button>
      </div>
      <div id="plan-detail-${safeId}" style="display:none;border-top:1px solid var(--border)">
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;background:#fffbeb">
          <span style="font-size:11px;font-weight:600;color:var(--amber)">판매수량 붙여넣기</span>
          <span style="font-size:11px;color:var(--muted)">관리코드 | 판매수량</span>
          <button class="btn btn-outline btn-sm" onclick="toggleSoldPaste('${safeId}')">붙여넣기</button>
        </div>
        <div id="sold-paste-${safeId}" style="display:none;padding:10px 14px;border-bottom:1px solid var(--border);background:#fffbeb">
          <div style="display:flex;gap:8px;align-items:flex-start">
            <textarea id="sold-paste-box-${safeId}" rows="4"
              style="flex:1;padding:7px 10px;border:1px solid #fde68a;border-radius:5px;font-size:12px;font-family:monospace;resize:vertical;outline:none;background:#fff"
              placeholder="2003515&#9;480&#10;2000507&#9;290&#10;2003518&#9;195"></textarea>
            <button class="btn btn-primary btn-sm" style="white-space:nowrap" onclick="doSoldPaste('${pl.id}','${safeId}')">가져오기</button>
          </div>
        </div>
        <table class="plan-table">
          <thead><tr>
            <th>관리코드</th><th>상품명</th>
            <th style="text-align:right;color:var(--muted)">기획수량</th>
            <th style="text-align:right;color:var(--blue)">실제판매수량</th>
            <th style="text-align:right">판매율</th>
            <th style="text-align:right">현재고</th>
            <th style="text-align:right;color:var(--green)">가용재고</th>
          </tr></thead>
          <tbody>${detailRows}</tbody>
          <tfoot><tr>
            <td colspan="2" style="padding:8px 14px;font-size:11px;color:var(--muted);border-top:1px solid var(--border)">${pl.memo||''}</td>
            <td style="padding:8px 14px;text-align:right;color:var(--muted);border-top:1px solid var(--border)">${fmt(totalPlan)}</td>
            <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--blue);border-top:1px solid var(--border)">${totalSold>0?fmt(totalSold):'-'}</td>
            <td colspan="3" style="border-top:1px solid var(--border)"></td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
  }).join('');
}

function togglePlanDetail(safeId){
  const el=document.getElementById('plan-detail-'+safeId);
  if(!el) return;
  el.style.display=el.style.display==='none'?'block':'none';
}

function toggleSoldPaste(safeId){
  const el=document.getElementById('sold-paste-'+safeId);
  if(!el) return;
  el.style.display=el.style.display==='none'?'block':'none';
}

function doSoldPaste(planId,safeId){
  const pl=plans.find(p=>p.id===planId);
  if(!pl) return;
  const text=document.getElementById('sold-paste-box-'+safeId)?.value.trim();
  if(!text) return alert('내용이 없습니다');

  // 관리코드 → items 인덱스 맵
  const codeMap={};
  pl.items.forEach((item,idx)=>{ if(item.code) codeMap[item.code]=idx; });

  let matched=0, notFound=[];
  text.split('\n').filter(l=>l.trim()).forEach(line=>{
    let cols=line.split('\t');
    if(cols.length<2) cols=line.trim().split(/\s{2,}/);
    if(cols.length<2) cols=line.trim().split(/[,;]/);
    if(cols.length<2) cols=line.trim().split(/\s+/);
    const code=(cols[0]||'').trim();
    const qty=Number((cols[1]||'').replace(/[^0-9]/g,''));
    if(!code||!qty) return;
    if(codeMap[code]!==undefined){
      pl.items[codeMap[code]].soldQty=qty;
      matched++;
    } else {
      notFound.push(code);
    }
  });

  document.getElementById('sold-paste-box-'+safeId).value='';
  document.getElementById('sold-paste-'+safeId).style.display='none';
  renderPlans();
  renderDashboard();
  let msg=matched+'개 판매수량 업데이트';
  if(notFound.length) msg+=' | 미매칭: '+notFound.join(', ');
  toast(msg);
}

function updateSoldQty(planId,itemIdx,val){
  const pl=plans.find(p=>p.id===planId);
  if(!pl||!pl.items[itemIdx]) return;
  pl.items[itemIdx].soldQty=Number(val)||0;
  renderDashboard(); // 재고 현황도 즉시 갱신
}

function toggleIncPaste(){
  const area=document.getElementById('inc-paste-area');
  const btn=document.getElementById('btn-inc-paste-toggle');
  const open=area.style.display!=='none';
  area.style.display=open?'none':'block';
  btn.textContent=open?'붙여넣기로 입력':'직접 입력';
}

function doIncPaste(){
  const text=document.getElementById('inc-paste-box').value.trim();
  if(!text) return alert('내용이 없습니다');
  let added=0, notFound=[];
  text.split('\n').filter(l=>l.trim()).forEach(line=>{
    let cols=line.split('\t');
    if(cols.length<2) cols=line.trim().split(/\s{2,}/);
    if(cols.length<2) cols=line.trim().split(/[,;]/);
    if(cols.length<2) cols=line.trim().split(/\s+/);
    const code=(cols[0]||'').trim();
    const qty=Number((cols[1]||'').replace(/[^0-9]/g,''));
    const date=(cols[2]||'').trim();
    if(!code||!qty) return;
    const prod=PRODUCT_DB[code];
    const name=prod?.name||(stockDB.find(r=>r.code===code)?.name)||'';
    if(!prod) notFound.push(code);
    incoming.push({id:uid(),code,name,qty,date,memo:''});
    added++;
  });
  document.getElementById('inc-paste-box').value='';
  document.getElementById('inc-paste-area').style.display='none';
  document.getElementById('btn-inc-paste-toggle').textContent='붙여넣기로 입력';
  renderIncoming(); renderDashboard();
  let msg=added+'개 입고 예정 추가됨';
  if(notFound.length) msg+=' | 미매칭 코드: '+notFound.join(', ');
  toast(msg);
}

// ── 입고 예정 ──
function openIncModal(){
  ['inc-code','inc-name','inc-memo'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('inc-qty').value='';
  document.getElementById('inc-date').value='';
  document.getElementById('modal-inc').classList.add('open');
}

function autoFillInc(){
  const code=document.getElementById('inc-code').value.trim();
  const prod=PRODUCT_DB[code];
  if(prod) document.getElementById('inc-name').value=prod.name;
}

function saveInc(){
  const code=document.getElementById('inc-code').value.trim();
  const name=document.getElementById('inc-name').value.trim();
  const qty=Number(document.getElementById('inc-qty').value||0);
  const date=document.getElementById('inc-date').value;
  if(!code&&!name) return alert('관리코드 또는 상품명을 입력하세요');
  if(!qty) return alert('수량을 입력하세요');
  incoming.push({id:uid(),code,name,qty,date,memo:document.getElementById('inc-memo').value.trim()});
  closeModal('modal-inc'); renderIncoming(); renderDashboard();
  toast('입고 예정 추가 완료');
}

function delInc(id){
  incoming=incoming.filter(i=>i.id!==id);
  renderIncoming(); renderDashboard();
}

function renderIncoming(){
  const tbody=document.getElementById('inc-tbody');
  if(!incoming.length){ tbody.innerHTML='<tr><td colspan="6" class="empty">등록된 입고 예정이 없습니다</td></tr>'; return; }
  tbody.innerHTML=incoming.map(inc=>`<tr>
    <td><code>${esc(inc.code)}</code></td>
    <td style="font-weight:500">${esc(inc.name)}</td>
    <td class="td-proj r">+${fmt(inc.qty)}</td>
    <td class="td-proj-soft">${inc.date||'-'}</td>
    <td style="color:var(--muted);font-size:12px">${esc(inc.memo)}</td>
    <td><button class="btn-del" onclick="delInc('${inc.id}')">×</button></td>
  </tr>`).join('');
}

// ── 제품 DB ──
function renderProductDB(){
  const q=(document.getElementById('pdb-q').value||'').toLowerCase();
  const entries=Object.entries(PRODUCT_DB);
  const filtered=q?entries.filter(([c,p])=>p.name.toLowerCase().includes(q)||c.includes(q)):entries;
  document.getElementById('pdb-count').textContent=filtered.length+'개 상품';
  document.getElementById('pdb-tbody').innerHTML=filtered.map(([code,p])=>`
    <tr>
      <td><code>${esc(code)}</code></td>
      <td style="font-weight:500">${esc(p.name)}</td>
      <td><span class="badge b-gray">${esc(p.cat)}</span></td>
      <td class="r">${fmt(p.price)}원</td>
    </tr>`).join('');
}

// ── 실재고 DB ──
function renderStockDBPage(){
  const q=(document.getElementById('sdb-q').value||'').toLowerCase();
  const expF=document.getElementById('exp-filter').value||'';
  const expFDate=expF?new Date(expF):null;
  let rows=[...stockDB];
  if(q) rows=rows.filter(r=>r.name.toLowerCase().includes(q)||r.code.includes(q));
  if(expFDate) rows=rows.filter(r=>{const d=parseExp(r.exp);return !d||d>=expFDate;});
  document.getElementById('sdbp-count').textContent=rows.length+'개 행 / 전체 '+stockDB.length+'개';
  document.getElementById('sdbp-tbody').innerHTML=rows.map(r=>{
    const es=expStatus(r.exp);
    const expCls=es==='expired'||es==='danger'?'exp-danger':es==='warn'?'exp-warn':'exp-ok';
    return `<tr>
      <td><code>${esc(r.code)}</code></td>
      <td style="font-weight:500">${esc(r.name)}</td>
      <td class="${expCls}">${r.exp||'-'}</td>
      <td class="r">${fmt(r.loc1)}</td>
      <td class="r">${fmt(r.loc2)}</td>
      <td class="r" style="font-weight:700;color:var(--blue)">${fmt(r.stock)}</td>
    </tr>`;
  }).join('');
}

// ── 네비 ──
const titles={dashboard:'재고 현황',planning:'기획 입력',incoming:'입고 예정',productdb:'제품 DB',stockdbpage:'실재고 DB'};
function goPage(name,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('page-'+name).classList.add('on');
  if(el) el.classList.add('on');
  document.getElementById('topbar-title').textContent=titles[name]||'';
  // 유통기한 필터는 재고현황·실재고DB에서만 표시
  const showFilter=['dashboard','stockdbpage'].includes(name);
  document.getElementById('exp-filter-wrap').style.display=showFilter?'flex':'none';
  if(name==='dashboard') renderDashboard();
  if(name==='planning') renderPlans();
  if(name==='incoming') renderIncoming();
  if(name==='productdb') renderProductDB();
  if(name==='stockdbpage') renderStockDBPage();
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open')}));

// ── Supabase 연동 ──
const SB_URL  = 'https://usycrdxicsxyvasokvns.supabase.co';
const SB_KEY  = 'sb_publishable_NPHJWK3WOdHsVog_PwLLYQ_v4gEAKwL';
// loc2: stock 테이블 store_id='0009' (양평사무실)
// loc1: wms_pallet_contents (양평대창고) = quantity * pcs_per_box + onebox_plus_quantity

let sb = null;
try { sb = window.supabase.createClient(SB_URL, SB_KEY); } catch(e) { console.warn('Supabase SDK load failed:', e); }

// -- Auth --
async function doLogin(){
  if(!sb) return;
  const email=document.getElementById('auth-email').value.trim();
  const pw=document.getElementById('auth-pw').value;
  const errEl=document.getElementById('auth-error');
  errEl.textContent='';
  if(!email||!pw){ errEl.textContent='이메일과 비밀번호를 입력하세요'; return; }
  const { error }=await sb.auth.signInWithPassword({email,password:pw});
  if(error){ errEl.textContent=error.message; return; }
  location.reload();
}
async function doLogout(){
  if(sb) await sb.auth.signOut();
  location.reload();
}

// -- Supabase 데이터 로드 --
function sbDateToExp(d){
  if(!d||d==='9999-12-31') return '';
  const p=String(d).split('-');
  return p.length>=2?p[0].slice(2)+'/'+p[1]:'';
}

async function loadFromSupabase(){
  if(!sb) return;
  try {
    // products -> PRODUCT_DB
    const {data:prods}=await sb.from('products').select('id,name_ko,category,base_price,pcs_per_box').eq('is_active',true);
    if(prods&&prods.length){
      Object.keys(PRODUCT_DB).forEach(k=>delete PRODUCT_DB[k]);
      prods.forEach(p=>{ PRODUCT_DB[p.id]={name:p.name_ko||'',cat:p.category||'',price:String(Math.round(p.base_price||0)),pcs_per_box:p.pcs_per_box||1}; });
    }

    // stock -> stockDB (loc2: 양평사무실, loc1: 양평대창고 WMS)
    const g={};

    // loc2: 양평사무실 (stock 테이블, store_id='0009')
    const {data:stRows}=await sb.from('stock').select('product_id,expiration_date,qty_on_hand').eq('store_id','0009');
    if(stRows){
      stRows.forEach(r=>{
        const exp=sbDateToExp(r.expiration_date);
        const k=r.product_id+'|'+exp;
        if(!g[k]){
          const pr=PRODUCT_DB[r.product_id];
          g[k]={code:r.product_id,name:pr?.name||r.product_id,price:pr?.price||'0',exp,loc1:0,loc2:0,stock:0};
        }
        const q=Number(r.qty_on_hand||0);
        g[k].loc2+=q;
        g[k].stock+=q;
      });
    }

    // loc1: 양평대창고 (wms_pallet_contents + products.pcs_per_box)
    const {data:wmsRows}=await sb.from('wms_pallet_contents').select('sku_id,quantity,onebox_plus_quantity,expiry_date');
    if(wmsRows){
      wmsRows.forEach(r=>{
        const exp=sbDateToExp(r.expiry_date);
        const k=r.sku_id+'|'+exp;
        if(!g[k]){
          const pr=PRODUCT_DB[r.sku_id];
          g[k]={code:r.sku_id,name:pr?.name||r.sku_id,price:pr?.price||'0',exp,loc1:0,loc2:0,stock:0};
        }
        const pcsPerBox=Number(PRODUCT_DB[r.sku_id]?.pcs_per_box||1);
        const q=Number(r.quantity||0)*pcsPerBox+Number(r.onebox_plus_quantity||0);
        g[k].loc1+=q;
        g[k].stock+=q;
      });
    }

    stockDB.length=0;
    Object.values(g).forEach(r=>stockDB.push(r));

    // plans
    const {data:plRows}=await sb.from('wholesale_plans').select('*').order('created_at',{ascending:false});
    if(plRows){
      plans.length=0;
      plRows.forEach(p=>plans.push({
        id:p.id,channel:p.channel||'',person:p.person||'',
        from:p.from_date||'',to:p.to_date||'',
        memo:p.memo||'',status:p.status||'진행예정',items:p.items||[]
      }));
    }

    // incoming (read-only from swiss_orders + swiss_order_items)
    const {data:soRows}=await sb.from('swiss_orders').select('id,order_no,delivery_due_date,notes,swiss_order_items(id,product_id,product_name_en,qty)').not('status','in','("completed","cancelled")').order('created_at',{ascending:false});
    if(soRows){
      incoming.length=0;
      soRows.forEach(o=>{
        (o.swiss_order_items||[]).forEach(item=>{
          const prod=PRODUCT_DB[item.product_id];
          incoming.push({
            id:item.id,
            code:item.product_id||'',
            name:prod?.name||item.product_name_en||'',
            qty:Number(item.qty||0),
            date:o.delivery_due_date||'',
            memo:o.notes||''
          });
        });
      });
    }

    renderDashboard();
  } catch(e){
    console.error('Supabase load error:',e);
    toast('데이터 로드 실패 - 로컬 데이터 사용');
    renderDashboard();
  }
}

// -- Supabase 동기화 --
async function sbUpsertPlan(pl){
  if(!sb) return;
  const {error}=await sb.from('wholesale_plans').upsert({
    id:pl.id,channel:pl.channel,person:pl.person||'',
    from_date:pl.from||'',to_date:pl.to||'',
    memo:pl.memo||'',status:pl.status||'진행예정',items:pl.items||[]
  });
  if(error) console.error('plan sync error:',error);
}
async function sbDeletePlan(id){
  if(!sb) return;
  const {error}=await sb.from('wholesale_plans').delete().eq('id',id);
  if(error) console.error('plan delete error:',error);
}
// sbUpsertInc / sbDeleteInc: no-op (swiss_orders are read-only from this admin tool)
async function sbUpsertInc(inc){}
async function sbDeleteInc(id){}

// -- 기존 함수 오버라이드 --
const _savePlan=savePlan;
savePlan=function(){
  const editId=planEditId;
  const prevLen=plans.length;
  _savePlan();
  const target=editId?plans.find(p=>p.id===editId):(plans.length>prevLen?plans[plans.length-1]:null);
  if(target) sbUpsertPlan(target);
};

const _delPlan=delPlan;
delPlan=function(id){ _delPlan(id); sbDeletePlan(id); };

const _setStatus=setStatus;
setStatus=function(id,v){ _setStatus(id,v); const p=plans.find(x=>x.id===id); if(p) sbUpsertPlan(p); };

const _updateSoldQty=updateSoldQty;
updateSoldQty=function(pid,idx,v){ _updateSoldQty(pid,idx,v); const p=plans.find(x=>x.id===pid); if(p) sbUpsertPlan(p); };

const _doSoldPaste=doSoldPaste;
doSoldPaste=function(pid,sid){ _doSoldPaste(pid,sid); const p=plans.find(x=>x.id===pid); if(p) sbUpsertPlan(p); };

const _saveInc=saveInc;
saveInc=function(){ const n=incoming.length; _saveInc(); if(incoming.length>n) sbUpsertInc(incoming[incoming.length-1]); };

const _doIncPaste=doIncPaste;
doIncPaste=function(){ const n=incoming.length; _doIncPaste(); for(let i=n;i<incoming.length;i++) sbUpsertInc(incoming[i]); };

const _delInc=delInc;
delInc=function(id){ _delInc(id); sbDeleteInc(id); };

// -- saveAll: 클라우드 전체 저장 --
saveAll=async function(){
  if(!sb){ toast('Supabase 연결 없음'); return; }
  try{
    for(const p of plans) await sbUpsertPlan(p);
    // incoming is read-only (swiss_orders managed elsewhere)
    toast('클라우드 저장 완료');
  }catch(e){ console.error(e); toast('저장 실패'); }
};

// -- 앱 초기화 --
(async function(){
  if(!sb){
    document.getElementById('app-wrap').style.display='';
    renderDashboard();
    return;
  }
  const {data:{session}}=await sb.auth.getSession();
  if(session){
    document.getElementById('auth-overlay').style.display='none';
    document.getElementById('app-wrap').style.display='';
    await loadFromSupabase();
  } else {
    document.getElementById('auth-overlay').style.display='flex';
  }
})();
