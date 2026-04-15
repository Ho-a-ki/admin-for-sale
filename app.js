// ═══════════════════ 유틸 ═══════════════════
const esc = v => String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const fmt = n => n > 0 ? Number(n).toLocaleString() + '원' : '—';
const uid = () => 'u'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
const toast = msg => {
  const el=document.createElement('div');
  el.style.cssText='position:fixed;bottom:24px;right:24px;background:#1a1d23;color:#fff;padding:11px 18px;border-radius:7px;font-size:12px;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,.2)';
  el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>el.remove(),2500);
};

// ═══════════════════ 상태 ═══════════════════
let currentSet = { name:'', items:[] };   // {code,name,price,qty}
let savedSets = [];                        // [{id,name,items,discount,setQty,retail,sale}]
let currentSetIdx = -1;
let planCatFilter = 'all';
let dbSortCol = 'code';
let dbSortAsc = true;

function catalogArray(){
  return Object.entries(PRODUCT_DB).map(([code,p])=>({
    code, name:p.name||'', cat:p.cat||'', price:Number(p.price)||0, status:p.status||'활성'
  }));
}
function getCatOrder(){
  const cats=[...new Set(catalogArray().map(p=>p.cat).filter(Boolean))];
  return cats.sort();
}

// ═══════════════════ 제품 DB ═══════════════════
function populateCatOptions(selectId){
  const sel=document.getElementById(selectId); if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">전체 카테고리</option>'+
    getCatOrder().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value=cur;
}

function renderDB(){
  const search=(document.getElementById('dbSearch').value||'').toLowerCase();
  const cat=document.getElementById('dbCatFilter').value;
  const status=document.getElementById('dbStatusFilter').value;
  let rows=catalogArray().filter(p=>{
    if(search && !p.name.toLowerCase().includes(search) && !p.code.toLowerCase().includes(search)) return false;
    if(cat && p.cat!==cat) return false;
    if(status && p.status!==status) return false;
    return true;
  });
  const cmp=(a,b)=>{
    const av=a[dbSortCol], bv=b[dbSortCol];
    if(typeof av==='number') return dbSortAsc?av-bv:bv-av;
    return dbSortAsc?String(av).localeCompare(String(bv),'ko'):String(bv).localeCompare(String(av),'ko');
  };
  rows.sort(cmp);
  document.getElementById('dbCount').textContent=rows.length+' 건';
  const tb=document.getElementById('dbTbody');
  tb.innerHTML=rows.map(p=>`
    <tr>
      <td class="code">${esc(p.code)}</td>
      <td class="fw6">${esc(p.name)}</td>
      <td>${esc(p.cat||'—')}</td>
      <td class="price">${fmt(p.price)}</td>
      <td class="text-center"><span class="tag ${p.status==='활성'?'tag-active':'tag-soldout'}">${esc(p.status)}</span></td>
    </tr>`).join('');
}
function sortDB(col){
  if(dbSortCol===col) dbSortAsc=!dbSortAsc; else { dbSortCol=col; dbSortAsc=true; }
  renderDB();
}
function exportDbCSV(){
  let csv='\uFEFF관리코드,제품명,카테고리,판매가,상태\n';
  catalogArray().forEach(p=>{
    csv+=`${p.code},"${p.name}",${p.cat||''},${p.price},${p.status}\n`;
  });
  downloadFile('유스트_제품DB.csv', csv, 'text/csv;charset=utf-8');
}

// ═══════════════════ 기획: 좌측 제품 카탈로그 ═══════════════════
function initPlanCatBtns(){
  const btns=document.getElementById('planCatBtns');
  btns.innerHTML=`<button class="cat-filter-btn active" onclick="setPlanCat('all',this)">전체</button>`+
    getCatOrder().map(c=>`<button class="cat-filter-btn" onclick="setPlanCat('${esc(c)}',this)">${esc(c)}</button>`).join('');
}
function setPlanCat(cat,btn){
  planCatFilter=cat;
  document.querySelectorAll('#planCatBtns .cat-filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderPlanList();
}
function renderPlanList(){
  const search=(document.getElementById('planSearch').value||'').toLowerCase();
  const list=document.getElementById('planProductList');
  const groups={};
  const cats=getCatOrder();
  cats.forEach(c=>groups[c]=[]);
  catalogArray().forEach(p=>{
    if(planCatFilter!=='all' && p.cat!==planCatFilter) return;
    if(search && !p.name.toLowerCase().includes(search) && !p.code.toLowerCase().includes(search)) return;
    if(p.status!=='활성') return;
    if(!groups[p.cat]) groups[p.cat]=[];
    groups[p.cat].push(p);
  });
  let html='', any=false;
  cats.forEach(cat=>{
    if(!groups[cat]||!groups[cat].length) return;
    any=true;
    html+=`<div class="cat-section-title">${esc(cat)}</div>`;
    groups[cat].forEach(p=>{
      html+=`<div class="product-card" onclick='addToSet(${JSON.stringify(p).replace(/'/g,"&#39;")})'>
        <div class="pc-code">${esc(p.code)}</div>
        <div class="pc-name">${esc(p.name)}</div>
        <div class="pc-meta"><span class="pc-price">${fmt(p.price)}</span></div>
      </div>`;
    });
  });
  if(!any) html='<div style="text-align:center;padding:40px;color:var(--muted);font-size:12px">검색 결과 없음</div>';
  list.innerHTML=html;
}

// ═══════════════════ 세트 빌더 ═══════════════════
function addToSet(p){
  const existing=currentSet.items.find(i=>i.code===p.code);
  if(existing){ existing.qty+=1; }
  else currentSet.items.push({code:p.code,name:p.name,price:p.price,qty:1});
  renderSetItems(); updateSummary();
}
function renderSetItems(){
  const list=document.getElementById('setItemsList');
  const hint=document.getElementById('setDropHint');
  hint.style.display=currentSet.items.length>0?'none':'block';
  const setQty=parseInt(document.getElementById('setQtyInput')?.value)||1;
  list.innerHTML=currentSet.items.map((item,idx)=>{
    const needed=item.qty*setQty;
    return `<div class="set-item">
      <div class="set-item-num">${idx+1}</div>
      <div class="set-item-info">
        <div class="set-item-code">${esc(item.code)}</div>
        <div class="set-item-name">${esc(item.name)}</div>
        <div class="set-item-price">${fmt(item.price)}</div>
      </div>
      <div class="text-center" style="min-width:44px">
        <div style="font-size:10px;color:var(--muted);margin-bottom:2px">세트당</div>
        <input type="number" class="set-item-qty" value="${item.qty}" min="1" onchange="updateQty(${idx},this.value)">
      </div>
      <div class="text-center" style="min-width:54px;padding:0 4px">
        <div style="font-size:10px;color:var(--muted);margin-bottom:2px">필요수량</div>
        <div style="font-family:ui-monospace,monospace;font-size:13px;font-weight:700;color:var(--blue)">${needed}</div>
      </div>
      <button class="set-item-remove" onclick="removeFromSet(${idx})">×</button>
    </div>`;
  }).join('');
}
function updateQty(idx,val){
  currentSet.items[idx].qty=parseInt(val)||1;
  renderSetItems(); updateSummary();
}
function removeFromSet(idx){
  currentSet.items.splice(idx,1);
  renderSetItems(); updateSummary();
}
function clearCurrentSet(){
  if(currentSet.items.length>0 && !confirm('세트를 초기화할까요?')) return;
  currentSet={name:'',items:[]};
  document.getElementById('setNameInput').value='';
  document.getElementById('setQtyInput').value=1;
  document.getElementById('discountRate').value=0;
  currentSetIdx=-1;
  renderSetItems(); updateSummary(); renderSavedSets();
}
function updateSummary(){
  const total=currentSet.items.reduce((s,i)=>s+i.price*i.qty,0);
  const disc=parseInt(document.getElementById('discountRate').value)||0;
  const sale=Math.round(total*(1-disc/100));
  document.getElementById('sumItemCount').textContent=currentSet.items.length+' 종';
  document.getElementById('sumRetail').textContent=total.toLocaleString()+'원';
  document.getElementById('sumSalePrice').textContent=sale.toLocaleString()+'원';
}
function newSet(){ clearCurrentSet(); }

function saveCurrentSet(){
  const name=document.getElementById('setNameInput').value.trim();
  if(!name) return alert('세트명을 입력하세요.');
  if(currentSet.items.length===0) return alert('제품을 추가하세요.');
  const disc=parseInt(document.getElementById('discountRate').value)||0;
  const setQty=parseInt(document.getElementById('setQtyInput').value)||1;
  const total=currentSet.items.reduce((s,i)=>s+i.price*i.qty,0);
  const existingId = currentSetIdx>=0 ? savedSets[currentSetIdx].id : uid();
  const setObj={
    id:existingId, name,
    items:currentSet.items.map(i=>({code:i.code,name:i.name,price:i.price,qty:i.qty})),
    discount:disc, setQty,
    retail:total, sale:Math.round(total*(1-disc/100))
  };
  if(currentSetIdx>=0) savedSets[currentSetIdx]=setObj;
  else { savedSets.push(setObj); currentSetIdx=savedSets.length-1; }
  sbUpsertPlan(setObj);
  renderSavedSets();
  toast(`"${name}" 세트 저장됨`);
}
function loadSet(idx){
  const s=savedSets[idx];
  currentSetIdx=idx;
  currentSet={name:s.name, items:s.items.map(i=>({...i}))};
  document.getElementById('setNameInput').value=s.name;
  document.getElementById('discountRate').value=s.discount||0;
  document.getElementById('setQtyInput').value=s.setQty||1;
  renderSetItems(); updateSummary(); renderSavedSets();
}
function deleteSet(idx){
  const s=savedSets[idx];
  if(!confirm(`"${s.name}" 세트를 삭제할까요?`)) return;
  sbDeletePlan(s.id);
  savedSets.splice(idx,1);
  if(currentSetIdx===idx) currentSetIdx=-1;
  else if(currentSetIdx>idx) currentSetIdx--;
  renderSavedSets();
}
function renderSavedSets(){
  const el=document.getElementById('savedSetsList');
  if(!savedSets.length){
    el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">저장된 세트 없음</div>';
    return;
  }
  el.innerHTML=savedSets.map((s,idx)=>`
    <div class="saved-set-item${idx===currentSetIdx?' active':''}" onclick="loadSet(${idx})">
      <div class="flex">
        <div style="flex:1;min-width:0">
          <div class="ss-name">${esc(s.name)}</div>
          <div class="ss-meta">${s.items.length}종 · 할인 ${s.discount||0}% · <strong style="color:var(--blue)">${s.setQty||1}개</strong></div>
          <div class="ss-price">${(s.sale||0).toLocaleString()}원/세트</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteSet(${idx})">삭제</button>
      </div>
    </div>`).join('');
}

// ═══════════════════ 엑셀/CSV ═══════════════════
function downloadFile(filename,content,mime){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function exportSetExcel(){
  if(currentSet.items.length===0) return alert('세트에 제품을 추가하세요.');
  const name=document.getElementById('setNameInput').value.trim()||'세트기획';
  const disc=parseInt(document.getElementById('discountRate').value)||0;
  const total=currentSet.items.reduce((s,i)=>s+i.price*i.qty,0);
  const sale=Math.round(total*(1-disc/100));
  let csv='\uFEFF';
  csv+=`세트명:,${name}\n생성일:,${new Date().toLocaleDateString('ko-KR')}\n할인율:,${disc}%\n\n`;
  csv+='순번,관리코드,제품명,판매가,수량,소계\n';
  currentSet.items.forEach((item,i)=>{
    csv+=`${i+1},${item.code},"${item.name}",${item.price},${item.qty},${item.price*item.qty}\n`;
  });
  csv+=`\n합산정가,,,,,${total}\n세트판매가(${disc}% 할인),,,,,${sale}\n절약금액,,,,,${total-sale}\n`;
  downloadFile(`유스트_${name}_기획.csv`, csv, 'text/csv;charset=utf-8');
}

// ═══════════════════ 물류 취합 ═══════════════════
let _lastLogistics=null;
function buildLogistics(){
  if(!savedSets.length){ alert('저장된 세트가 없습니다.'); return; }

  // 세트별 현황
  document.getElementById('logSetTbody').innerHTML=savedSets.map(s=>`
    <tr>
      <td class="fw6">${esc(s.name)}</td>
      <td class="text-center" style="font-family:ui-monospace,monospace;font-weight:700;color:var(--blue)">${s.setQty||1}개</td>
      <td class="text-center">${s.items.length}종</td>
      <td>${s.discount||0}%</td>
      <td style="font-family:ui-monospace,monospace;text-align:right">${(s.sale||0).toLocaleString()}원</td>
      <td style="font-size:11px;color:var(--muted)">${esc(s.items.map(i=>i.name).join(', '))}</td>
    </tr>`).join('');

  // 관리코드별 합산
  const merged={};
  savedSets.forEach(s=>{
    const sq=s.setQty||1;
    s.items.forEach(item=>{
      const needed=item.qty*sq;
      if(!merged[item.code]){
        const prod=PRODUCT_DB[item.code];
        merged[item.code]={
          name:item.name, price:item.price,
          cat:prod?.cat||'—',
          total:0, sources:[]
        };
      }
      merged[item.code].total+=needed;
      merged[item.code].sources.push(`${s.name}×${sq}(${item.qty}개)`);
    });
  });

  const catOrder=getCatOrder();
  const sorted=Object.entries(merged).sort((a,b)=>{
    const ai=catOrder.indexOf(a[1].cat), bi=catOrder.indexOf(b[1].cat);
    if(ai!==bi) return (ai===-1?99:ai)-(bi===-1?99:bi);
    return a[1].name.localeCompare(b[1].name,'ko');
  });

  const tbody=document.getElementById('logTbody');
  const tfoot=document.getElementById('logTfoot');
  let gTotal=0,gAmt=0,lastCat=null;
  tbody.innerHTML=sorted.map(([code,d])=>{
    const amt=d.price*d.total; gTotal+=d.total; gAmt+=amt;
    let catRow='';
    if(d.cat!==lastCat){
      lastCat=d.cat;
      catRow=`<tr><td colspan="7" style="background:var(--blue);color:#fff;font-size:11px;font-weight:700;padding:5px 10px;letter-spacing:.04em">${esc(d.cat)}</td></tr>`;
    }
    return catRow+`<tr>
      <td class="code">${esc(code)}</td>
      <td class="fw6">${esc(d.name)}</td>
      <td>${esc(d.cat)}</td>
      <td style="font-family:ui-monospace,monospace;text-align:right">${d.price.toLocaleString()}</td>
      <td style="font-family:ui-monospace,monospace;font-size:15px;font-weight:700;text-align:center;color:var(--blue)">${d.total}</td>
      <td style="font-family:ui-monospace,monospace;text-align:right">${amt.toLocaleString()}</td>
      <td style="font-size:11px;color:var(--muted)">${esc(d.sources.join(' / '))}</td>
    </tr>`;
  }).join('');

  tfoot.innerHTML=`<tr style="background:#fafbfc;border-top:2px solid var(--border)">
    <td colspan="4" style="font-weight:700;padding:8px 10px;text-align:right">합계</td>
    <td style="font-family:ui-monospace,monospace;font-size:15px;font-weight:700;text-align:center;color:var(--blue);padding:8px 10px">${gTotal}</td>
    <td style="font-family:ui-monospace,monospace;font-weight:700;text-align:right;padding:8px 10px">${gAmt.toLocaleString()}</td>
    <td></td>
  </tr>`;

  document.getElementById('logTotalKinds').textContent=sorted.length+' 종';
  document.getElementById('logTotalQty').textContent='총 '+gTotal+'개';
  _lastLogistics={sorted,savedSets:[...savedSets]};
}
function exportLogisticsCSV(){
  if(!_lastLogistics){ alert('먼저 [취합 계산]을 눌러주세요.'); return; }
  const {sorted,savedSets:sets}=_lastLogistics;
  const today=new Date().toLocaleDateString('ko-KR');
  let csv='\uFEFF'+`유스트 물류 취합표,생성일:,${today}\n\n`;
  csv+='=== 세트별 기획 현황 ===\n세트명,세트수량,구성종,할인율,세트판매가\n';
  sets.forEach(s=>{ csv+=`"${s.name}",${s.setQty||1},${s.items.length},${s.discount||0}%,${s.sale||0}\n`; });
  csv+='\n=== 관리코드별 필요수량 합산 ===\n관리코드,제품명,카테고리,단가,필요수량,금액소계,세트출처\n';
  sorted.forEach(([code,d])=>{
    csv+=`${code},"${d.name}",${d.cat},${d.price},${d.total},${d.price*d.total},"${d.sources.join(' / ')}"\n`;
  });
  const gt=sorted.reduce((s,[,d])=>s+d.total,0);
  const ga=sorted.reduce((s,[,d])=>s+d.price*d.total,0);
  csv+=`,,,,합계,${gt},${ga}\n`;
  downloadFile(`유스트_물류취합_${today}.csv`, csv, 'text/csv;charset=utf-8');
}

// ═══════════════════ 기획상품 합산 (분해 뷰) ═══════════════════
function renderSummary(){
  const q=(document.getElementById('smSearch').value||'').toLowerCase();
  const merged={};
  savedSets.forEach(s=>{
    const sq=s.setQty||1;
    s.items.forEach(item=>{
      const needed=item.qty*sq;
      if(!merged[item.code]){
        const prod=PRODUCT_DB[item.code];
        merged[item.code]={
          name:item.name, price:item.price, cat:prod?.cat||'—',
          total:0, breakdown:[]
        };
      }
      merged[item.code].total+=needed;
      merged[item.code].breakdown.push({setName:s.name, setQty:sq, perSet:item.qty, total:needed, discount:s.discount||0});
    });
  });
  let rows=Object.entries(merged).map(([code,d])=>({code,...d}));
  const totalAll=rows.reduce((s,r)=>s+r.total,0);
  const amtAll=rows.reduce((s,r)=>s+r.total*r.price,0);
  if(q) rows=rows.filter(r=>r.name.toLowerCase().includes(q)||r.code.toLowerCase().includes(q));
  rows.sort((a,b)=>b.total-a.total);

  document.getElementById('smSetCount').textContent=savedSets.length;
  document.getElementById('smSkuCount').textContent=Object.keys(merged).length;
  document.getElementById('smQtyTotal').textContent=totalAll.toLocaleString();
  document.getElementById('smAmtTotal').textContent=amtAll.toLocaleString()+'원';

  const el=document.getElementById('smList');
  if(!rows.length){ el.innerHTML='<div class="empty">'+(savedSets.length?'검색 결과 없음':'저장된 세트가 없습니다')+'</div>'; return; }

  el.innerHTML=rows.map(r=>{
    const amt=r.total*r.price;
    const breakdown=r.breakdown.map(b=>`
      <div style="display:flex;align-items:center;gap:10px;padding:7px 16px;border-top:1px solid #f3f4f6;font-size:12px">
        <span style="font-weight:500">${esc(b.setName)}</span>
        <span style="color:var(--muted);font-size:11px">세트당 ${b.perSet}개 × ${b.setQty}세트</span>
        ${b.discount>0?`<span class="tag tag-c">할인 ${b.discount}%</span>`:''}
        <span style="margin-left:auto;font-family:ui-monospace,monospace;font-weight:700;color:var(--blue)">${b.total}개</span>
      </div>`).join('');
    return `<div class="card" style="margin-bottom:10px;overflow:hidden">
      <div class="flex" style="padding:11px 16px;background:#fafbfc;border-bottom:1px solid var(--border)">
        <code class="mono" style="background:#fff;padding:2px 8px;border-radius:4px;border:1px solid var(--border)">${esc(r.code)}</code>
        <span style="font-weight:600;font-size:13px">${esc(r.name)}</span>
        ${r.cat?`<span class="tag tag-c">${esc(r.cat)}</span>`:''}
        <span style="font-size:11px;color:var(--muted)">${r.breakdown.length}개 세트</span>
        <div class="spacer"></div>
        <span style="font-size:15px;font-weight:700;color:var(--blue);font-family:ui-monospace,monospace">${r.total}개</span>
        <span style="font-size:12px;color:var(--purple);font-weight:600">${amt.toLocaleString()}원</span>
      </div>
      <div>${breakdown}</div>
    </div>`;
  }).join('');
}

// ═══════════════════ 네비 ═══════════════════
const titles={productdb:'제품 DB',planning:'기획 (세트 구성)',logistics:'물류 취합',summary:'기획상품 합산'};
function goPage(name,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('page-'+name).classList.add('on');
  if(el) el.classList.add('on');
  document.getElementById('topbar-title').textContent=titles[name]||'';
  if(name==='productdb') renderDB();
  if(name==='planning'){ initPlanCatBtns(); renderPlanList(); renderSavedSets(); renderSetItems(); updateSummary(); }
  if(name==='logistics') buildLogistics();
  if(name==='summary') renderSummary();
}

// ═══════════════════ Supabase ═══════════════════
const SB_URL = 'https://usycrdxicsxyvasokvns.supabase.co';
const SB_KEY = 'sb_publishable_NPHJWK3WOdHsVog_PwLLYQ_v4gEAKwL';
let sb=null;
try{ sb=window.supabase.createClient(SB_URL,SB_KEY); }catch(e){ console.warn('Supabase SDK load failed:',e); }

async function doLogin(){
  if(!sb) return;
  const email=document.getElementById('auth-email').value.trim();
  const pw=document.getElementById('auth-pw').value;
  const errEl=document.getElementById('auth-error'); errEl.textContent='';
  if(!email||!pw){ errEl.textContent='이메일과 비밀번호를 입력하세요'; return; }
  const {error}=await sb.auth.signInWithPassword({email,password:pw});
  if(error){ errEl.textContent=error.message; return; }
  location.reload();
}
async function doLogout(){ if(sb) await sb.auth.signOut(); location.reload(); }

async function loadFromSupabase(){
  if(!sb) return;
  try{
    // products → PRODUCT_DB
    const {data:prods,error:pe}=await sb.from('products').select('id,name_ko,category,base_price,is_active');
    if(pe) console.error('products load error:',pe);
    if(prods){
      Object.keys(PRODUCT_DB).forEach(k=>delete PRODUCT_DB[k]);
      prods.forEach(p=>{
        PRODUCT_DB[p.id]={
          name:p.name_ko||'', cat:p.category||'',
          price:Math.round(Number(p.base_price)||0),
          status:p.is_active?'활성':'품절'
        };
      });
    }
    populateCatOptions('dbCatFilter');

    // wholesale_plans → savedSets (memo = JSON meta)
    const {data:plRows,error:ple}=await sb.from('wholesale_plans').select('*').order('created_at',{ascending:false});
    if(ple) console.error('plans load error:',ple);
    if(plRows){
      savedSets.length=0;
      plRows.forEach(p=>{
        let meta={discount:0,setQty:1};
        try{ const parsed=JSON.parse(p.memo||'{}'); if(parsed && typeof parsed==='object') meta={...meta,...parsed}; }catch(e){}
        const items=p.items||[];
        const retail=items.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||0),0);
        const sale=Math.round(retail*(1-(meta.discount||0)/100));
        savedSets.push({
          id:p.id, name:p.channel||'(이름없음)',
          items:items.map(i=>({code:i.code,name:i.name,price:Number(i.price)||0,qty:Number(i.qty)||1})),
          discount:Number(meta.discount)||0, setQty:Number(meta.setQty)||1, retail, sale
        });
      });
    }

    // 초기 렌더 — 현재 활성 페이지 기준
    const active=document.querySelector('.page.on')?.id||'page-planning';
    const name=active.replace('page-','');
    if(name==='planning'){ initPlanCatBtns(); renderPlanList(); renderSavedSets(); renderSetItems(); updateSummary(); }
    else if(name==='productdb') renderDB();
    else if(name==='logistics') buildLogistics();
    else if(name==='summary') renderSummary();
  }catch(e){ console.error('load error:',e); toast('데이터 로드 실패'); }
}

async function sbUpsertPlan(s){
  if(!sb) return;
  const memo=JSON.stringify({discount:s.discount||0, setQty:s.setQty||1});
  const {error}=await sb.from('wholesale_plans').upsert({
    id:s.id, channel:s.name||'', person:'',
    from_date:null, to_date:null,
    memo, status:'진행예정', items:s.items||[]
  });
  if(error) console.error('plan sync error:',error);
}
async function sbDeletePlan(id){
  if(!sb) return;
  const {error}=await sb.from('wholesale_plans').delete().eq('id',id);
  if(error) console.error('plan delete error:',error);
}

// ═══════════════════ 앱 초기화 ═══════════════════
(async function(){
  if(!sb){
    document.getElementById('app-wrap').style.display='';
    initPlanCatBtns(); renderPlanList(); renderSavedSets(); renderSetItems(); updateSummary();
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
