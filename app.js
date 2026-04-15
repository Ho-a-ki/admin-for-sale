// ── 유틸 ──
const fmt = n => Number(n||0).toLocaleString();
const esc = v => String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const uid = () => 'u'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
const toast = msg => {
  const el=document.createElement('div');
  el.style.cssText='position:fixed;bottom:24px;right:24px;background:#1a1d23;color:#fff;padding:11px 18px;border-radius:7px;font-size:12px;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,.2)';
  el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>el.remove(),2500);
};

// ── 제품 DB ──
function populateCategoryFilter(){
  const sel=document.getElementById('pdb-cat'); if(!sel) return;
  const cats=new Set();
  Object.values(PRODUCT_DB).forEach(p=>{ if(p.cat) cats.add(p.cat); });
  const current=sel.value;
  sel.innerHTML='<option value="">전체 카테고리</option>'+
    [...cats].sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value=current;
}

function renderProductDB(){
  const q=(document.getElementById('pdb-q').value||'').toLowerCase();
  const cat=document.getElementById('pdb-cat').value||'';
  let entries=Object.entries(PRODUCT_DB);
  if(q) entries=entries.filter(([c,p])=>(p.name||'').toLowerCase().includes(q)||c.toLowerCase().includes(q));
  if(cat) entries=entries.filter(([,p])=>p.cat===cat);
  entries.sort((a,b)=>a[0].localeCompare(b[0]));
  document.getElementById('pdb-count').textContent=entries.length+'개 / 전체 '+Object.keys(PRODUCT_DB).length+'개';
  document.getElementById('pdb-info').textContent='유스트 전체 제품 목록 · '+Object.keys(PRODUCT_DB).length+'개';
  const tb=document.getElementById('pdb-tbody');
  if(!entries.length){ tb.innerHTML='<tr><td colspan="5" class="empty">검색 결과 없음</td></tr>'; return; }
  tb.innerHTML=entries.map(([code,p])=>`
    <tr>
      <td><code>${esc(code)}</code></td>
      <td style="font-weight:500">${esc(p.name)}</td>
      <td>${p.cat?`<span class="badge b-gray">${esc(p.cat)}</span>`:'<span style="color:#ccc">-</span>'}</td>
      <td class="r">${p.price?fmt(p.price)+'원':'<span style="color:#ccc">-</span>'}</td>
      <td class="r" style="color:var(--muted)">${p.box||1}</td>
    </tr>`).join('');
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
      document.getElementById('pl-ch').value=pl.channel||'';
      document.getElementById('pl-person').value=pl.person||'';
      document.getElementById('pl-from').value=pl.from||'';
      document.getElementById('pl-to').value=pl.to||'';
      document.getElementById('pl-memo').value=pl.memo||'';
      (pl.items||[]).forEach(item=>addPlanRow(item));
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
        oninput="autoFillRow(${i})" style="font-family:monospace;width:120px">
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
    if(pd) pd.textContent=prod.price?fmt(prod.price)+'원':'-';
  } else {
    if(nd) nd.innerHTML='<span style="color:#dc2626">매칭 없음</span>';
    if(pd) pd.textContent='-';
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
  if(!ch) return alert('세트명/채널명을 입력하세요');

  const rawItems=[];
  document.querySelectorAll('#pl-items tr[id^="plr-"]').forEach(tr=>{
    const i=tr.id.replace('plr-','');
    const code=document.getElementById('plc-'+i)?.value.trim()||'';
    const qty=Number(document.getElementById('plq-'+i)?.value||0);
    if(!code||!qty) return;
    const prod=PRODUCT_DB[code];
    const name=prod?.name||'';
    const price=prod?.price||0;
    rawItems.push({code,name,price,qty});
  });

  if(!rawItems.length) return alert('구성품을 1개 이상 입력하세요');

  // 같은 관리코드 합산
  const merged={};
  rawItems.forEach(item=>{
    if(merged[item.code]){ merged[item.code].qty+=item.qty; }
    else merged[item.code]={...item};
  });
  const items=Object.values(merged);

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
  renderPlans(); renderLogistics(); renderSummary();
  sbUpsertPlan(pl);
  const dupMsg=rawItems.length>items.length?` (중복 ${rawItems.length-items.length}개 합산)`:'';
  toast('기획 저장 완료'+dupMsg);
}

function delPlan(id){
  if(!confirm('삭제할까요?')) return;
  plans=plans.filter(p=>p.id!==id);
  sbDeletePlan(id);
  renderPlans(); renderLogistics(); renderSummary();
}

function setStatus(id,val){
  const pl=plans.find(p=>p.id===id);
  if(pl){ pl.status=val; sbUpsertPlan(pl); renderPlans(); }
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
    const items=pl.items||[];
    const totalQty=items.reduce((s,i)=>s+Number(i.qty||0),0);
    const totalAmt=items.reduce((s,i)=>s+Number(i.qty||0)*Number(i.price||0),0);
    const stColor={'진행예정':'#1e40af','진행중':'#92400e','완료':'#065f46'}[pl.status]||'#6b7280';
    const stBg={'진행예정':'#dbeafe','진행중':'#fef3c7','완료':'#d1fae5'}[pl.status]||'#f3f4f6';
    const safeId=pl.id.replace(/[^a-zA-Z0-9]/g,'_');

    const detailRows=items.map(item=>{
      const amt=Number(item.qty||0)*Number(item.price||0);
      return `<tr>
        <td style="padding:8px 14px"><code>${esc(item.code)}</code></td>
        <td style="padding:8px 14px;font-weight:500">${esc(item.name)}</td>
        <td style="padding:8px 14px;text-align:right;color:var(--muted)">${item.price?fmt(item.price)+'원':'-'}</td>
        <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--blue)">${fmt(item.qty)}</td>
        <td style="padding:8px 14px;text-align:right;color:var(--muted)">${amt?fmt(amt)+'원':'-'}</td>
      </tr>`;
    }).join('');

    return `<div class="plan-card">
      <div class="plan-head" style="cursor:pointer;user-select:none" ondblclick="togglePlanDetail('${safeId}')">
        <span class="plan-ch" style="background:${chBg[ci]};color:${chFg[ci]}">${esc(pl.channel)}</span>
        ${pl.person?`<span style="font-size:12px;color:var(--muted)">${esc(pl.person)}</span>`:''}
        <span class="plan-date">${pl.from||''} ${pl.to?'~ '+pl.to:''}</span>
        ${pl.memo?`<span style="font-size:11px;color:var(--text);background:#f3f4f6;padding:1px 8px;border-radius:4px">${esc(pl.memo)}</span>`:''}
        <span style="font-size:11px;color:var(--muted)">구성 ${items.length}개 · 총 ${fmt(totalQty)}개 · ${fmt(totalAmt)}원</span>
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${stBg};color:${stColor}">${pl.status||'진행예정'}</span>
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
        <table class="plan-table">
          <thead><tr>
            <th>관리코드</th><th>상품명</th>
            <th style="text-align:right">정가</th>
            <th style="text-align:right;color:var(--blue)">수량</th>
            <th style="text-align:right">금액</th>
          </tr></thead>
          <tbody>${detailRows}</tbody>
          <tfoot><tr style="background:#fafbfc">
            <td colspan="3" style="padding:8px 14px;font-size:11px;color:var(--muted);font-weight:700">합계</td>
            <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--blue)">${fmt(totalQty)}</td>
            <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--purple)">${fmt(totalAmt)}원</td>
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

// ── 물류 취합 (관리코드별 합산) ──
function aggregateByCode(){
  const map={};
  plans.forEach(pl=>{
    (pl.items||[]).forEach(item=>{
      const k=item.code; if(!k) return;
      if(!map[k]){
        const prod=PRODUCT_DB[k];
        map[k]={
          code:k,
          name:item.name||prod?.name||'',
          cat:prod?.cat||'',
          price:Number(item.price||prod?.price||0),
          qty:0,
          plans:[] // [{channel, qty}]
        };
      }
      map[k].qty+=Number(item.qty||0);
      map[k].plans.push({channel:pl.channel, qty:Number(item.qty||0), from:pl.from, status:pl.status});
    });
  });
  return map;
}

function renderLogistics(){
  const q=(document.getElementById('lg-q').value||'').toLowerCase();
  const map=aggregateByCode();
  let rows=Object.values(map);
  if(q) rows=rows.filter(r=>(r.name||'').toLowerCase().includes(q)||r.code.toLowerCase().includes(q));
  rows.sort((a,b)=>b.qty-a.qty);

  const totalQty=rows.reduce((s,r)=>s+r.qty,0);
  document.getElementById('lg-sku').textContent=fmt(rows.length);
  document.getElementById('lg-qty').textContent=fmt(totalQty);
  document.getElementById('lg-plans').textContent=fmt(plans.length);
  document.getElementById('lg-count').textContent=rows.length+'개 관리코드 / 전체 '+Object.keys(map).length+'개';

  const tb=document.getElementById('lg-tbody');
  if(!rows.length){ tb.innerHTML='<tr><td colspan="6" class="empty">데이터 없음</td></tr>'; return; }
  tb.innerHTML=rows.map(r=>{
    const chs=[...new Set(r.plans.map(p=>p.channel))];
    return `<tr>
      <td><code>${esc(r.code)}</code></td>
      <td style="font-weight:500">${esc(r.name)}</td>
      <td>${r.cat?`<span class="badge b-gray">${esc(r.cat)}</span>`:'<span style="color:#ccc">-</span>'}</td>
      <td class="r" style="color:var(--muted)">${r.price?fmt(r.price)+'원':'-'}</td>
      <td class="r td-ok" style="font-size:14px">${fmt(r.qty)}</td>
      <td class="r" style="font-size:11px;color:var(--muted)">${esc(chs.join(', '))}</td>
    </tr>`;
  }).join('');
}

function copyLogistics(){
  const map=aggregateByCode();
  const rows=Object.values(map).sort((a,b)=>b.qty-a.qty);
  const lines=['관리코드\t상품명\t총수량'];
  rows.forEach(r=>lines.push(`${r.code}\t${r.name}\t${r.qty}`));
  const text=lines.join('\n');
  navigator.clipboard.writeText(text).then(()=>toast('클립보드 복사 완료 ('+rows.length+'행)'),
    ()=>{ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('복사됨'); });
}

// ── 기획상품 합산 (분해 뷰) ──
function renderSummary(){
  const q=(document.getElementById('sm-q').value||'').toLowerCase();
  const map=aggregateByCode();
  let rows=Object.values(map);
  if(q) rows=rows.filter(r=>(r.name||'').toLowerCase().includes(q)||r.code.toLowerCase().includes(q));
  rows.sort((a,b)=>b.qty-a.qty);

  const totalQty=Object.values(map).reduce((s,r)=>s+r.qty,0);
  const totalAmt=Object.values(map).reduce((s,r)=>s+r.qty*r.price,0);

  document.getElementById('sm-plans').textContent=fmt(plans.length);
  document.getElementById('sm-sku').textContent=fmt(Object.keys(map).length);
  document.getElementById('sm-qty').textContent=fmt(totalQty);
  document.getElementById('sm-amt').textContent=fmt(totalAmt)+'원';

  const el=document.getElementById('sm-list');
  if(!rows.length){ el.innerHTML='<div class="empty">등록된 기획이 없습니다</div>'; return; }

  el.innerHTML=rows.map(r=>{
    const amt=r.qty*r.price;
    const breakdown=r.plans.map(p=>{
      const stBg={'진행예정':'#dbeafe','진행중':'#fef3c7','완료':'#d1fae5'}[p.status]||'#f3f4f6';
      const stFg={'진행예정':'#1e40af','진행중':'#92400e','완료':'#065f46'}[p.status]||'#6b7280';
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;border-top:1px solid #f3f4f6">
        <span style="background:${stBg};color:${stFg};font-size:10px;font-weight:600;padding:1px 7px;border-radius:20px">${p.status||'진행예정'}</span>
        <span style="font-size:12px;font-weight:500">${esc(p.channel)}</span>
        <span style="font-size:11px;color:var(--muted)">${p.from||''}</span>
        <span style="margin-left:auto;font-size:12px;font-weight:700;color:var(--blue)">${fmt(p.qty)}개</span>
      </div>`;
    }).join('');

    return `<div class="plan-card">
      <div style="padding:11px 16px;display:flex;align-items:center;gap:10px;background:#fafbfc">
        <code style="font-family:monospace;font-size:12px;color:var(--muted);background:#fff;padding:2px 8px;border-radius:4px;border:1px solid var(--border)">${esc(r.code)}</code>
        <span style="font-weight:600;font-size:13px">${esc(r.name)}</span>
        ${r.cat?`<span class="badge b-gray">${esc(r.cat)}</span>`:''}
        <span style="font-size:11px;color:var(--muted)">기획 ${r.plans.length}건</span>
        <span style="margin-left:auto;font-size:15px;font-weight:700;color:var(--blue)">${fmt(r.qty)}개</span>
        <span style="font-size:12px;color:var(--purple);font-weight:600">${fmt(amt)}원</span>
      </div>
      <div>${breakdown}</div>
    </div>`;
  }).join('');
}

// ── 네비 ──
const titles={productdb:'제품 DB',planning:'기획 (세트 구성)',logistics:'물류 취합',summary:'기획상품 합산'};
function goPage(name,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('page-'+name).classList.add('on');
  if(el) el.classList.add('on');
  document.getElementById('topbar-title').textContent=titles[name]||'';
  if(name==='productdb') renderProductDB();
  if(name==='planning') renderPlans();
  if(name==='logistics') renderLogistics();
  if(name==='summary') renderSummary();
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open')}));

// ── Supabase ──
const SB_URL = 'https://usycrdxicsxyvasokvns.supabase.co';
const SB_KEY = 'sb_publishable_NPHJWK3WOdHsVog_PwLLYQ_v4gEAKwL';

let sb = null;
try { sb = window.supabase.createClient(SB_URL, SB_KEY); } catch(e) { console.warn('Supabase SDK load failed:', e); }

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

async function loadFromSupabase(){
  if(!sb) return;
  try {
    // products → PRODUCT_DB
    const {data:prods,error:pe}=await sb.from('products').select('id,name_ko,category,base_price,pcs_per_box,is_active');
    if(pe) console.error('products load error:',pe);
    if(prods&&prods.length){
      Object.keys(PRODUCT_DB).forEach(k=>delete PRODUCT_DB[k]);
      prods.forEach(p=>{
        PRODUCT_DB[p.id]={
          name:p.name_ko||'',
          cat:p.category||'',
          price:Math.round(Number(p.base_price)||0),
          box:Number(p.pcs_per_box)||1,
          status:p.is_active?'활성':'품절'
        };
      });
    }
    populateCategoryFilter();

    // wholesale_plans → plans
    const {data:plRows,error:ple}=await sb.from('wholesale_plans').select('*').order('created_at',{ascending:false});
    if(ple) console.error('plans load error:',ple);
    if(plRows){
      plans.length=0;
      plRows.forEach(p=>plans.push({
        id:p.id,channel:p.channel||'',person:p.person||'',
        from:p.from_date||'',to:p.to_date||'',
        memo:p.memo||'',status:p.status||'진행예정',items:p.items||[]
      }));
    }

    renderProductDB();
  } catch(e){
    console.error('Supabase load error:',e);
    toast('데이터 로드 실패');
  }
}

async function sbUpsertPlan(pl){
  if(!sb) return;
  const {error}=await sb.from('wholesale_plans').upsert({
    id:pl.id,channel:pl.channel,person:pl.person||'',
    from_date:pl.from||null,to_date:pl.to||null,
    memo:pl.memo||'',status:pl.status||'진행예정',items:pl.items||[]
  });
  if(error) console.error('plan sync error:',error);
}
async function sbDeletePlan(id){
  if(!sb) return;
  const {error}=await sb.from('wholesale_plans').delete().eq('id',id);
  if(error) console.error('plan delete error:',error);
}

async function saveAll(){
  if(!sb){ toast('Supabase 연결 없음'); return; }
  try{
    for(const p of plans) await sbUpsertPlan(p);
    toast('클라우드 저장 완료');
  }catch(e){ console.error(e); toast('저장 실패'); }
}

// ── 앱 초기화 ──
(async function(){
  if(!sb){
    document.getElementById('app-wrap').style.display='';
    renderProductDB();
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
