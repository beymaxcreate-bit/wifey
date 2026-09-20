const STORAGE_KEY = 'ask-wifey-v1';
const APP_VERSION = '1.3';
const money = n => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-LK')}`;
const uid = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 12));
const localDate = d => {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const today = localDate(new Date());

const defaultState = {
  version: APP_VERSION,
  strictness: 2,
  brain: {
    businessName:'LOMOS',
    ownerPayPercent:20,
    emergencyPercent:10,
    defaultDomainCost:0,
    defaultHostingCost:0,
    paymentPlan:{advance:50,approval:20,deployment:30}
  },
  smartTasks:[],
  wallets: [
    {id:'personal',name:'Personal',type:'personal',balance:7000,reserved:0,icon:'◉'},
    {id:'lomos',name:'LOMOS',type:'business',balance:0,reserved:0,icon:'L'},
    {id:'tappy',name:'Tappy',type:'business',balance:0,reserved:0,icon:'T'},
    {id:'project-reserve',name:'Project Reserve',type:'project',balance:0,reserved:0,icon:'P'},
    {id:'reserve',name:'Emergency Reserve',type:'reserve',balance:0,reserved:0,icon:'↗'}
  ],
  categories:['Food','Transport','Going out','Shopping','Software','Domains','Hosting','Marketing','Project costs','Bills','Subscriptions','Other'],
  budgets:[
    {id:'b1',name:'Personal spending',category:'Other',limit:10000},
    {id:'b2',name:'Software & tools',category:'Software',limit:8000}
  ],
  projects:[],
  commitments:[],
  transactions:[
    {id:'opening',type:'income',amount:7000,walletId:'personal',category:'Opening balance',description:'Starting balance',date:today}
  ]
};

function cloneDefault(){ return JSON.parse(JSON.stringify(defaultState)); }
function normalizeState(raw){
  const base = cloneDefault();
  if(!raw || typeof raw !== 'object') return base;
  const s = {...base, ...raw};
  s.version = APP_VERSION;
  s.strictness = [1,2,3].includes(Number(s.strictness)) ? Number(s.strictness) : 2;
  s.brain = {...base.brain, ...(raw.brain||{})};
  s.brain.paymentPlan = {...base.brain.paymentPlan, ...((raw.brain||{}).paymentPlan||{})};
  s.smartTasks = Array.isArray(raw.smartTasks) ? raw.smartTasks.map(t => ({id:t.id||uid(),title:t.title||'Task',projectId:t.projectId||null,kind:t.kind||'general',status:t.status||'open',dueDate:t.dueDate||'',note:t.note||'',createdAt:t.createdAt||new Date().toISOString()})) : [];
  s.wallets = Array.isArray(s.wallets) && s.wallets.length ? s.wallets.map(w => ({
    id:w.id || uid(), name:w.name || 'Wallet', type:w.type || 'personal',
    balance:Number(w.balance || 0), reserved:Number(w.reserved || 0), icon:w.icon || '•'
  })) : base.wallets;
  s.categories = Array.isArray(s.categories) && s.categories.length ? [...new Set([...base.categories, ...s.categories])] : base.categories;
  s.budgets = Array.isArray(s.budgets) ? s.budgets.map(b => ({id:b.id || uid(),name:b.name || b.category || 'Budget',category:b.category || 'Other',limit:Number(b.limit || 0)})) : [];
  s.projects = Array.isArray(s.projects) ? s.projects.map(p => ({
    id:p.id || uid(), name:p.name || 'Project', client:p.client || '', contractValue:Number(p.contractValue || 0),
    legacyReceived:Number(p.legacyReceived ?? p.received ?? 0), legacyExpenses:Number(p.legacyExpenses ?? p.expenses ?? 0), status:p.status || 'active', serviceType:p.serviceType||'', lastPaymentStage:p.lastPaymentStage||''
  })) : [];
  s.commitments = Array.isArray(s.commitments) ? s.commitments.map(c => ({
    id:c.id || uid(), name:c.name || 'Commitment', amount:Number(c.amount || 0), walletId:c.walletId || s.wallets[0]?.id,
    category:c.category || 'Bills', dueDate:c.dueDate || today, frequency:c.frequency || 'one-off', active:c.active !== false, projectId:c.projectId||null, kind:c.kind||'general'
  })) : [];
  s.transactions = Array.isArray(s.transactions) ? s.transactions.map(t => ({...t,amount:Number(t.amount || 0),date:t.date || today})) : [];
  if(!s.wallets.some(w=>w.id==='project-reserve')) s.wallets.splice(Math.max(1,s.wallets.length-1),0,{id:'project-reserve',name:'Project Reserve',type:'project',balance:0,reserved:0,icon:'P'});
  return s;
}

function loadState(){
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return cloneDefault(); }
}
let state = loadState();
let currentFilter = 'all';
let deferredInstallPrompt = null;

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}
function wallet(id){ return state.wallets.find(w => w.id === id); }
function project(id){ return state.projects.find(p => p.id === id); }
function totalCash(){ return state.wallets.reduce((s,w) => s + Number(w.balance || 0), 0); }
function monthKey(date=today){ return String(date).slice(0,7); }
function monthSpent(category){
  const month = monthKey();
  return state.transactions.filter(t => t.type === 'expense' && t.category === category && String(t.date).startsWith(month)).reduce((s,t) => s + t.amount, 0);
}
function budgetFor(category){ return state.budgets.find(b => b.category === category); }
function parseDateLocal(str){ const [y,m,d] = String(str).split('-').map(Number); return new Date(y, (m||1)-1, d||1); }
function daysFromToday(str){ return Math.ceil((parseDateLocal(str) - parseDateLocal(today)) / 86400000); }
function dueCommitments(days=30){
  return state.commitments.filter(c => c.active !== false && daysFromToday(c.dueDate) <= days);
}
function commitmentsForWallet(walletId, days=30){
  return dueCommitments(days).filter(c => c.walletId === walletId).reduce((s,c) => s + c.amount, 0);
}
function walletSpendable(w){
  if(!w || w.type === 'reserve') return 0;
  return Math.max(0, w.balance - w.reserved - commitmentsForWallet(w.id));
}
function personalSafeToSpend(){ return state.wallets.filter(w => w.type === 'personal').reduce((s,w) => s + walletSpendable(w), 0); }
function businessAvailable(){ return state.wallets.filter(w => ['business','project'].includes(w.type)).reduce((s,w) => s + walletSpendable(w), 0); }
function lockedOrReserve(){
  return state.wallets.reduce((s,w) => s + (w.type === 'reserve' ? w.balance : Math.min(w.balance, w.reserved)), 0);
}
function upcomingCash(){ return dueCommitments(30).reduce((s,c) => s + c.amount, 0); }
function wifeyMoodState(){
  const safe=personalSafeToSpend();
  const overdue=state.commitments.filter(c=>c.active!==false&&daysFromToday(c.dueDate)<0).length;
  const blown=state.budgets.filter(b=>monthSpent(b.category)>b.limit).length;
  const open=openTasks().length;
  if(overdue||blown) return {emoji:'😒',label:'We need to talk',face:'😒',className:'side-eye',greeting:'Babe… explain this to me.',line:overdue?'You have overdue money promises. I already did the math.':`You crossed ${blown} budget ${blown===1?'line':'lines'}. Cute. Not happening again.`};
  if(safe<=0) return {emoji:'🥲',label:'Protective mode',face:'🥲',className:'side-eye',greeting:'No shopping today, love.',line:'Your personal money is already spoken for. I’m protecting future-you.'};
  if(safe<5000) return {emoji:'👀',label:'Watching you',face:'👀',className:'side-eye',greeting:'Easy, babe. We’re a little tight.',line:`You have ${money(safe)} I’m comfortable calling yours right now.`};
  if(open>4) return {emoji:'🫶',label:'Keeping us organised',face:'😌',className:'',greeting:'Money looks okay. Your projects need attention.',line:`You still have ${open} open business steps. Spend carefully and finish the work.`};
  return {emoji:'💋',label:'Proud of you',face:'😌',className:'proud',greeting:'Look at you behaving. I’m impressed.',line:`You have ${money(safe)} that is actually safe to spend. Don’t make me regret saying that.`};
}
function renderWifeyMood(){
  const mood=wifeyMoodState();
  const emoji=document.getElementById('wifeyMoodEmoji'), text=document.getElementById('wifeyMoodText'), face=document.getElementById('wifeyFace'), avatar=document.getElementById('wifeyAvatar'), greeting=document.getElementById('wifeyGreeting'), line=document.getElementById('wifeyOneLiner');
  if(emoji) emoji.textContent=mood.emoji; if(text) text.textContent=mood.label; if(face) face.textContent=mood.face;
  if(avatar) avatar.className=`wifey-avatar ${mood.className}`.trim(); if(greeting) greeting.textContent=mood.greeting; if(line) line.textContent=mood.line;
}
function projectStats(projectId){
  const p = project(projectId);
  const received = (p?.legacyReceived || 0) + state.transactions.filter(t => t.projectId === projectId && t.type === 'income').reduce((s,t) => s+t.amount,0);
  const expenses = (p?.legacyExpenses || 0) + state.transactions.filter(t => t.projectId === projectId && t.type === 'expense').reduce((s,t) => s+t.amount,0);
  return {received, expenses, profit:received-expenses};
}

function openTasks(projectId=null){
  return state.smartTasks.filter(t => t.status !== 'done' && (!projectId || t.projectId === projectId));
}
function projectCommitments(projectId){
  return state.commitments.filter(c => c.active !== false && c.projectId === projectId);
}
function addSmartTask({title,projectId=null,kind='general',dueDate='',note=''}){
  if(!title) return;
  const exists=state.smartTasks.some(t=>t.status!=='done'&&t.projectId===projectId&&t.kind===kind&&t.title===title);
  if(!exists) state.smartTasks.push({id:uid(),title,projectId,kind,status:'open',dueDate,note,createdAt:new Date().toISOString()});
}
function ensureWebsiteWorkflow(projectId){
  const p=project(projectId); if(!p) return;
  const tasks=[
    ['Collect content & assets','content'],
    ['Build core pages / functionality','build'],
    ['Complete revision rounds','revisions'],
    ['Get final client approval','approval'],
    ['Deploy project','deployment'],
    ['Collect remaining project balance','collection']
  ];
  tasks.forEach(([title,kind])=>addSmartTask({title,projectId,kind}));
}
function wifeyBriefs(){
  const briefs=[];
  const overdue=state.commitments.filter(c=>c.active!==false&&daysFromToday(c.dueDate)<0);
  if(overdue.length) briefs.push({tone:'danger',title:`${overdue.length} payment${overdue.length>1?'s are':' is'} overdue`,text:`${money(overdue.reduce((s,c)=>s+c.amount,0))} is already spoken for.`});
  state.projects.filter(p=>p.status!=='complete').forEach(p=>{
    const stats=projectStats(p.id), due=projectCommitments(p.id).reduce((s,c)=>s+c.amount,0), tasks=openTasks(p.id);
    const outstanding=Math.max(0,p.contractValue-stats.received);
    if(due>0) briefs.push({tone:'warning',title:`Protect ${p.name} costs`,text:`${money(due)} still needs to be paid for this project.`});
    if(tasks.length) briefs.push({tone:'neutral',title:`${p.name}: ${tasks[0].title}`,text:`${tasks.length} unfinished step${tasks.length===1?'':'s'} in the workflow.`});
    if(outstanding>0) briefs.push({tone:'neutral',title:`Still collect ${money(outstanding)}`,text:`${p.name} has money left to receive from the client.`});
  });
  const loan=state.commitments.filter(c=>c.active!==false&&c.kind==='debt').reduce((s,c)=>s+c.amount,0);
  if(loan>0) briefs.push({tone:'danger',title:'Borrowed money is not income',text:`You still need to repay ${money(loan)}.`});
  return briefs.slice(0,6);
}
function renderWifeyBriefing(){
  const el=document.getElementById('wifeyBriefing'); if(!el) return;
  const briefs=wifeyBriefs();
  el.innerHTML=briefs.length?briefs.map(b=>`<div class="brief-row ${b.tone}"><div><strong>${escapeHtml(b.title)}</strong><span>${escapeHtml(b.text)}</span></div></div>`).join(''):'<div class="empty">Nothing urgent. Wifey is suspiciously calm.</div>';
}
function smartProjectReminder(projectId){
  if(!projectId) return [];
  const p=project(projectId); if(!p) return [];
  const items=[];
  const commitments=projectCommitments(projectId);
  const tasks=openTasks(projectId);
  if(commitments.length) items.push(`${money(commitments.reduce((s,c)=>s+c.amount,0))} is still reserved for project costs.`);
  tasks.slice(0,2).forEach(t=>items.push(`Next: ${t.title}.`));
  const outstanding=Math.max(0,p.contractValue-projectStats(projectId).received);
  if(outstanding>0) items.push(`${money(outstanding)} is still to be collected from the client.`);
  return items;
}

const titles = {
  dashboard:'Okay babe, here’s the situation. 💋', ask:'Permission before purchase. 👀', transactions:'Show me the receipts. 🧾',
  wallets:'Our money, properly separated.', projects:'Client money is not shopping money.', budgets:'Boundaries are attractive. 😌',
  commitments:'Promises we already made.', settings:'Teach Wifey how you like it.'
};

document.querySelectorAll('[data-view-link]').forEach(el => el.addEventListener('click', e => {
  e.preventDefault(); showView(el.dataset.viewLink);
}));
function showView(name){
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
  document.querySelectorAll('.nav-item,.mobile-nav-item').forEach(v => v.classList.toggle('active', v.dataset.viewLink === name));
  document.getElementById('pageTitle').textContent = titles[name] || titles.dashboard;
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderAll(){
  document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('en-LK',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const personal = personalSafeToSpend();
  document.getElementById('safeToSpend').textContent = money(personal);
  document.getElementById('totalCash').textContent = money(totalCash());
  document.getElementById('totalCashMini').textContent = money(totalCash());
  document.getElementById('businessAvailable').textContent = money(businessAvailable());
  document.getElementById('lockedCash').textContent = money(lockedOrReserve());
  document.getElementById('upcomingCash').textContent = money(upcomingCash());
  document.getElementById('safeStatus').textContent = personal === 0 ? 'Nope. Hands off. 😌' : personal < 5000 ? 'Easy there, babe 👀' : 'Wifey-approved ✨';
  document.getElementById('safeMessage').textContent = personal === 0 ? 'Your personal money already has jobs. We are not stealing from future-us.' : personal < 5000 ? 'That is the most I’m comfortable letting you touch after bills, locks and promises.' : 'This is actually yours after the serious stuff is protected. Yes, I checked twice.';
  renderWallets(); renderTransactions(); renderBudgets(); renderProjects(); renderAskOptions(); renderRecent(); renderCommitments(); renderDataNotice(); renderWifeyBriefing(); renderWifeyMood();
  document.getElementById('strictness').value = state.strictness;
  document.getElementById('strictnessLabel').textContent = ['','Chill','Balanced','Strict'][state.strictness];
  if(document.getElementById('brainDomainCost')){
    document.getElementById('brainDomainCost').value=state.brain.defaultDomainCost||0;
    document.getElementById('brainHostingCost').value=state.brain.defaultHostingCost||0;
    document.getElementById('brainOwnerPay').value=state.brain.ownerPayPercent||0;
    document.getElementById('brainEmergency').value=state.brain.emergencyPercent||0;
    document.getElementById('brainAdvance').value=state.brain.paymentPlan.advance||0;
    document.getElementById('brainApproval').value=state.brain.paymentPlan.approval||0;
    document.getElementById('brainDeployment').value=state.brain.paymentPlan.deployment||0;
  }
}

function renderDataNotice(){
  const el = document.getElementById('dataNotice');
  const overdue = state.commitments.filter(c => c.active !== false && daysFromToday(c.dueDate) < 0).length;
  if(overdue){ el.classList.remove('hidden'); el.textContent = `${overdue} commitment${overdue>1?'s are':' is'} overdue. Wifey is counting them as money already spoken for.`; }
  else el.classList.add('hidden');
}

function walletCard(w, manage=false){
  const committed = commitmentsForWallet(w.id);
  const available = walletSpendable(w);
  return `<article class="wallet-card ${w.type==='reserve'?'reserve':''}">
    <div class="wallet-icon">${escapeHtml(w.icon || '•')}</div>
    <div>
      <span class="eyebrow">${escapeHtml(w.type)}</span>
      <strong>${money(w.balance)}</strong>
      <div class="wallet-meta"><span>${escapeHtml(w.name)}</span><span>${w.type==='reserve'?'Protected':`${money(available)} free`}</span></div>
      ${(w.reserved||committed) ? `<div class="wallet-available">${w.reserved?`${money(w.reserved)} locked`:''}${w.reserved&&committed?' · ':''}${committed?`${money(committed)} due soon`:''}</div>` : ''}
      ${manage ? `<div class="wallet-actions"><button class="small-btn" data-edit-wallet="${w.id}">Edit</button></div>` : ''}
    </div>
  </article>`;
}
function renderWallets(){
  document.getElementById('walletGrid').innerHTML = state.wallets.map(w => walletCard(w,false)).join('') || '<div class="empty">No wallets yet.</div>';
  document.getElementById('walletManageGrid').innerHTML = state.wallets.map(w => walletCard(w,true)).join('') || '<div class="empty">No wallets yet.</div>';
  document.querySelectorAll('[data-edit-wallet]').forEach(btn => btn.onclick = () => walletForm(btn.dataset.editWallet));
}

function renderTransactions(){
  let tx = [...state.transactions].sort((a,b) => `${b.date}${b.createdAt||''}`.localeCompare(`${a.date}${a.createdAt||''}`));
  if(currentFilter !== 'all') tx = tx.filter(t => t.type === currentFilter);
  document.getElementById('transactionList').innerHTML = tx.length ? tx.map(t => transactionRow(t,true)).join('') : '<div class="empty">No transactions here yet.</div>';
  document.querySelectorAll('[data-delete-tx]').forEach(btn => btn.onclick = () => deleteTransaction(btn.dataset.deleteTx));
}
function transactionRow(t, actions=false){
  let detail = '';
  if(t.type === 'transfer'){
    detail = `${wallet(t.fromWalletId)?.name || 'Wallet'} → ${wallet(t.toWalletId)?.name || 'Wallet'} · ${t.date}`;
  } else {
    const w = wallet(t.walletId);
    const p = t.projectId ? project(t.projectId) : null;
    detail = `${escapeHtml(t.category || t.type)} · ${escapeHtml(w?.name || 'Wallet')}${p?` · ${escapeHtml(p.name)}`:''} · ${t.date}`;
  }
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '↔';
  return `<div class="list-row ${actions?'with-actions':''}">
    <div><div class="list-title">${escapeHtml(t.description || t.category || 'Transaction')}</div><div class="list-sub">${detail}</div></div>
    <strong class="amount ${t.type}">${sign} ${money(t.amount)}</strong>
    ${actions && t.id !== 'opening' ? `<button class="small-btn danger" data-delete-tx="${t.id}">Delete</button>` : ''}
  </div>`;
}
function renderRecent(){
  const tx = [...state.transactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  document.getElementById('recentTransactions').innerHTML = tx.length ? tx.map(t => transactionRow(t,false)).join('') : '<div class="empty">Nothing yet.</div>';
  document.getElementById('budgetPulse').innerHTML = state.budgets.slice(0,4).map(b => budgetRow(b)).join('') || '<div class="empty">Add a budget to start.</div>';
  const due = dueCommitments(30).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,4);
  document.getElementById('commitmentPreview').innerHTML = due.length ? due.map(c => commitmentRow(c,false)).join('') : '<div class="empty">Nothing due in the next 30 days.</div>';
}

function budgetRow(b){
  const spent = monthSpent(b.category), pct = Math.min(100,Math.round((spent / b.limit) * 100) || 0), cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';
  return `<div class="list-row"><div><div class="list-title">${escapeHtml(b.name)}</div><div class="list-sub">${money(spent)} of ${money(b.limit)}</div><div class="progress ${cls}"><span style="width:${pct}%"></span></div></div><strong>${pct}%</strong></div>`;
}
function renderBudgets(){
  document.getElementById('budgetGrid').innerHTML = state.budgets.length ? state.budgets.map(b => {
    const spent = monthSpent(b.category), left = b.limit-spent, pct = Math.min(100,Math.round((spent/b.limit)*100)||0);
    return `<article class="budget-card"><span class="eyebrow">${escapeHtml(b.category)}</span><h3>${escapeHtml(b.name)}</h3><div class="money small">${money(left)}</div><div class="list-sub">left this month · ${money(spent)} spent</div><div class="progress ${pct>=100?'danger':pct>=80?'warning':''}"><span style="width:${pct}%"></span></div><div class="wallet-actions"><button class="small-btn danger" data-delete-budget="${b.id}">Delete</button></div></article>`;
  }).join('') : '<div class="empty">No budgets yet.</div>';
  document.querySelectorAll('[data-delete-budget]').forEach(btn => btn.onclick = () => {
    if(confirm('Delete this budget? Existing transactions stay untouched.')){ state.budgets = state.budgets.filter(b => b.id !== btn.dataset.deleteBudget); save(); }
  });
}
function renderProjects(){
  document.getElementById('projectGrid').innerHTML = state.projects.length ? state.projects.map(p => {
    const stats = projectStats(p.id); const outstanding = Math.max(0,p.contractValue-stats.received); const tasks=openTasks(p.id); const due=projectCommitments(p.id).reduce((sum,c)=>sum+c.amount,0);
    return `<article class="project-card"><div class="project-card-head"><div><span class="eyebrow">${escapeHtml(p.client || 'Client')}</span><h3>${escapeHtml(p.name)}</h3></div>${p.lastPaymentStage?`<span class="stage-badge">${escapeHtml(p.lastPaymentStage)}</span>`:''}</div><div class="metric-grid"><div class="metric"><span>Contract</span><strong>${money(p.contractValue)}</strong></div><div class="metric"><span>Received</span><strong>${money(stats.received)}</strong></div><div class="metric"><span>Known costs due</span><strong>${money(due)}</strong></div><div class="metric"><span>Current profit</span><strong>${money(stats.profit)}</strong></div></div>${tasks.length?`<div class="project-workflow"><span class="eyebrow">Wifey workflow</span>${tasks.slice(0,4).map(t=>`<button class="task-row" data-complete-task="${t.id}"><span>${escapeHtml(t.title)}</span><b>Done ✓</b></button>`).join('')}${tasks.length>4?`<span class="list-sub">+ ${tasks.length-4} more steps</span>`:''}</div>`:''}<div class="wallet-actions"><span class="list-sub">${money(outstanding)} still to receive</span></div></article>`;
  }).join('') : '<div class="empty">Add your first client project.</div>';
  document.querySelectorAll('[data-complete-task]').forEach(btn=>btn.onclick=()=>{const t=state.smartTasks.find(x=>x.id===btn.dataset.completeTask);if(t){t.status='done';save();toast('Done. Wifey crossed it off.');}});
}
function projectOptions(includeBlank=true){
  return `${includeBlank?'<option value="">No project</option>':''}${state.projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}`;
}
function renderAskOptions(){
  document.getElementById('askWallet').innerHTML = state.wallets.filter(w => w.type !== 'reserve').map(w => `<option value="${w.id}">${escapeHtml(w.name)} · ${money(walletSpendable(w))} free</option>`).join('');
  document.getElementById('askCategory').innerHTML = state.categories.map(c => `<option>${escapeHtml(c)}</option>`).join('');
  document.getElementById('askProject').innerHTML = projectOptions(true);
}

function commitmentRow(c, actions=true){
  const d = daysFromToday(c.dueDate); const when = d < 0 ? `${Math.abs(d)} day${Math.abs(d)===1?'':'s'} overdue` : d === 0 ? 'Due today' : `Due in ${d} day${d===1?'':'s'}`;
  return `<div class="list-row ${actions?'with-actions':''}"><div><div class="list-title">${escapeHtml(c.name)}</div><div class="list-sub">${escapeHtml(wallet(c.walletId)?.name || 'Wallet')} · ${when} · ${c.frequency === 'monthly' ? 'Monthly' : c.frequency==='annual'?'Annual':'One-off'}${c.projectId?` · ${escapeHtml(project(c.projectId)?.name||'Project')}`:''}</div></div><strong>${money(c.amount)}</strong>${actions?`<div class="row-actions"><button class="small-btn good" data-pay-commitment="${c.id}">Pay</button><button class="small-btn danger" data-delete-commitment="${c.id}">Delete</button></div>`:''}</div>`;
}
function renderCommitments(){
  const active = state.commitments.filter(c => c.active !== false).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  document.getElementById('commitmentList').innerHTML = active.length ? active.map(c => commitmentRow(c,true)).join('') : '<div class="empty">No active bills or subscriptions yet.</div>';
  document.querySelectorAll('[data-pay-commitment]').forEach(btn => btn.onclick = () => payCommitment(btn.dataset.payCommitment));
  document.querySelectorAll('[data-delete-commitment]').forEach(btn => btn.onclick = () => {
    if(confirm('Delete this commitment?')){ state.commitments = state.commitments.filter(c => c.id !== btn.dataset.deleteCommitment); save(); }
  });
}

function safetyBufferFor(w){
  if(w?.type !== 'personal') return 0;
  return state.strictness === 3 ? 5000 : state.strictness === 2 ? 2500 : 0;
}
function askWifey(amount,walletId,category,item,projectId=null){
  const w = wallet(walletId); if(!w) return {status:'rejected',title:'Pick a real wallet.',message:'Wifey cannot check money that has nowhere to live.'};
  const budget = budgetFor(category), spent = monthSpent(category), budgetLeft = budget ? budget.limit-spent : null;
  const matchingCommitment = projectId ? state.commitments.find(c=>c.active!==false&&c.projectId===projectId&&c.walletId===walletId&&c.category===category) : null;
  const committedAll = commitmentsForWallet(walletId);
  const committed = Math.max(0, committedAll - (matchingCommitment ? Math.min(matchingCommitment.amount, amount) : 0));
  const freeBefore = Math.max(0,w.balance-w.reserved-committed), after = freeBefore-amount, buffer = safetyBufferFor(w);
  const reminders=smartProjectReminder(projectId);
  let status='approved', title='Fine. You may have it. 💋', message=`You can buy ${item || 'this'} and still leave ${money(Math.max(0,after))} free in ${w.name}. Don’t make this a habit.`;
  if(amount > Math.max(0,w.balance-w.reserved) || after < 0){ status='rejected'; title='Absolutely not, babe. 😒'; message=`This would use money already locked or needed for commitments in ${w.name}.`; }
  else if(budgetLeft !== null && amount > budgetLeft){ status='rejected'; title='Your budget already said no. 👀'; message=`You only have ${money(Math.max(0,budgetLeft))} left in the ${category} budget this month.`; }
  else if(after < buffer){ status='caution'; title='Technically yes. Emotionally? No. 🥲'; message=`You would leave only ${money(Math.max(0,after))} free. Your ${['','chill','balanced','strict'][state.strictness]} setting wants a ${money(buffer)} personal buffer.`; }
  if(matchingCommitment && status!=='rejected') message += ` This matches a known ${category.toLowerCase()} obligation for the project.`;
  return {status,title,message,freeBefore,after,budgetLeft,committed,buffer,reminders,matchingCommitmentId:matchingCommitment?.id||null};
}

document.getElementById('askForm').addEventListener('submit', e => {
  e.preventDefault();
  const amount = Number(document.getElementById('askAmount').value), walletId = document.getElementById('askWallet').value, category = document.getElementById('askCategory').value, item = document.getElementById('askItem').value.trim(), projectId = document.getElementById('askProject').value || null;
  const r = askWifey(amount,walletId,category,item,projectId), card = document.getElementById('verdictCard');
  card.className = `verdict-card ${r.status}`; const icon = r.status === 'approved' ? '💋' : r.status === 'rejected' ? '😒' : '👀';
  card.innerHTML = `<span class="eyebrow">Wifey has spoken</span><div class="verdict-icon">${icon}</div><h2>${r.title}</h2><p>${r.message}</p>
    <div class="verdict-breakdown"><div class="mini-row"><span>Free before</span><strong>${money(r.freeBefore||0)}</strong></div><div class="mini-row"><span>Purchase</span><strong>− ${money(amount)}</strong></div><div class="mini-row"><span>Free after</span><strong>${money(Math.max(0,r.after||0))}</strong></div></div>
    ${r.reminders?.length?`<div class="wifey-reminders"><strong>Before you forget</strong>${r.reminders.map(x=>`<span>• ${escapeHtml(x)}</span>`).join('')}</div>`:''}
    ${r.status !== 'rejected' ? `<button class="primary-btn" id="logPurchaseBtn">${r.status==='approved'?'Okay Wifey, log it 💸':'I know… log it anyway 🥲'}</button>` : ''}`;
  document.getElementById('logPurchaseBtn')?.addEventListener('click', () => {
    addExpense({amount,walletId,category,description:item,projectId}); if(r.matchingCommitmentId){const c=state.commitments.find(x=>x.id===r.matchingCommitmentId);if(c){if(c.frequency==='annual'){const d=parseDateLocal(c.dueDate);d.setFullYear(d.getFullYear()+1);c.dueDate=localDate(d);}else c.active=false;save();}} toast('Noted. I saw that. 👀'); showView('dashboard');
  });
});

function addExpense({amount,walletId,category,description,date=today,projectId=null}){
  const w = wallet(walletId); if(!w) return false;
  w.balance -= Number(amount);
  state.transactions.push({id:uid(),type:'expense',amount:Number(amount),walletId,category,description,date,projectId:projectId||null,createdAt:new Date().toISOString()});
  save(); return true;
}
function addIncomeAllocation({amount,description,date=today,projectId=null,allocations,sourceType='other',groupId=null}){
  const total = allocations.reduce((s,a) => s + Number(a.amount||0),0);
  if(Math.abs(total-amount) > .001) throw new Error('Income must be allocated 100%.');
  groupId = groupId || uid();
  allocations.filter(a => Number(a.amount) > 0).forEach(a => {
    const w = wallet(a.walletId); const value = Number(a.amount); if(!w) return;
    w.balance += value;
    state.transactions.push({id:uid(),groupId,type:'income',sourceType,amount:value,walletId:a.walletId,category:'Allocated income',description,projectId:projectId||null,date,createdAt:new Date().toISOString()});
  });
  save();
}
function addTransfer({amount,fromWalletId,toWalletId,description='Wallet transfer',date=today}){
  const from = wallet(fromWalletId), to = wallet(toWalletId), value = Number(amount);
  if(!from || !to || from.id === to.id || value <= 0) return false;
  from.balance -= value; to.balance += value;
  state.transactions.push({id:uid(),type:'transfer',amount:value,fromWalletId,toWalletId,description,date,createdAt:new Date().toISOString()});
  save(); return true;
}

function deleteTransaction(id){
  const t = state.transactions.find(x => x.id === id); if(!t) return;
  if(!confirm('Delete this transaction and reverse its wallet balance?')) return;
  if(t.type === 'income'){ const w=wallet(t.walletId); if(w) w.balance -= t.amount; }
  if(t.type === 'expense'){ const w=wallet(t.walletId); if(w) w.balance += t.amount; }
  if(t.type === 'transfer'){ const from=wallet(t.fromWalletId),to=wallet(t.toWalletId); if(from) from.balance += t.amount; if(to) to.balance -= t.amount; }
  state.transactions = state.transactions.filter(x => x.id !== id); save(); toast('Transaction reversed and deleted.');
}

function modal(html){
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalBackdrop').classList.add('open');
  document.getElementById('modalBackdrop').setAttribute('aria-hidden','false');
  setTimeout(() => document.querySelector('#modalContent input, #modalContent select')?.focus(), 30);
}
function closeModal(){ document.getElementById('modalBackdrop').classList.remove('open'); document.getElementById('modalBackdrop').setAttribute('aria-hidden','true'); }
document.getElementById('closeModal').onclick = closeModal;
document.getElementById('modalBackdrop').addEventListener('click', e => { if(e.target.id === 'modalBackdrop') closeModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });

function expenseForm(){
  modal(`<span class="eyebrow">New expense</span><h2 id="modalTitle">Money went out.</h2><form id="txForm" class="form-grid">
    <label>Description<input id="txDesc" required placeholder="What was it?" autocomplete="off" /></label>
    <label>Amount<input id="txAmount" type="number" min="1" inputmode="numeric" required /></label>
    <label>Wallet<select id="txWallet">${state.wallets.map(w=>`<option value="${w.id}">${escapeHtml(w.name)} · ${money(w.balance)}</option>`).join('')}</select></label>
    <label>Category<select id="txCategory">${state.categories.map(c=>`<option>${escapeHtml(c)}</option>`).join('')}</select></label>
    <label>Project<select id="txProject">${projectOptions(true)}</select></label>
    <label>Date<input id="txDate" type="date" value="${today}" /></label>
    <button class="primary-btn full">Save expense</button></form>`);
  document.getElementById('txForm').onsubmit = e => {
    e.preventDefault(); const amount=Number(txAmount.value), w=wallet(txWallet.value);
    if(amount > w.balance && !confirm(`${w.name} will go negative. Log it anyway?`)) return;
    addExpense({amount,walletId:txWallet.value,category:txCategory.value,description:txDesc.value.trim(),date:txDate.value,projectId:txProject.value||null});
    closeModal(); toast('Okay. It’s in the books. 👀');
  };
}
function incomeAllocationForm(){
  const projectReserve=wallet('project-reserve') || state.wallets.find(w=>w.type==='project');
  modal(`<span class="eyebrow">Wifey money intake</span><h2 id="modalTitle">Wait. Where did this money come from?</h2><p class="subcopy">Wifey will ask what this money is for before she lets you treat it as spendable.</p>
    <form id="incomeForm" class="form-grid">
      <label>Money source<select id="incomeSource"><option value="client">Client / project payment</option><option value="lomos">LOMOS general income</option><option value="tappy">Tappy income</option><option value="personal">Personal income</option><option value="loan">Borrowed money / loan</option><option value="other">Other</option></select></label>
      <label>Who / what paid you?<input id="incomeDesc" required placeholder="e.g. Emerald Coast Travels" autocomplete="off" /></label>
      <label>Amount received<input id="incomeAmount" type="number" min="1" inputmode="numeric" required placeholder="60000" /></label>
      <label>Date<input id="incomeDate" type="date" value="${today}" /></label>

      <div id="clientQuestions" class="smart-question-box full">
        <div class="smart-question-head"><span class="eyebrow">Wifey asks</span><strong>Is this money already committed to a client job?</strong></div>
        <div class="form-grid compact">
          <label>Project<select id="incomeProject">${projectOptions(true)}<option value="__new__">+ Create new project</option></select></label>
          <label>Payment stage<select id="incomeStage"><option value="advance">Advance</option><option value="approval">Final approval / milestone</option><option value="deployment">Deployment / final payment</option><option value="other">Other</option></select></label>
          <div id="newProjectFields" class="smart-question-box full hidden"><span class="eyebrow">New project</span><div class="form-grid compact"><label>Project name<input id="newProjectName" placeholder="e.g. Emerald Coast Travels" /></label><label>Client<input id="newProjectClient" placeholder="Client name" /></label><label>Contract value<input id="newProjectContract" type="number" min="0" inputmode="numeric" placeholder="120000" /></label></div></div>
          <label>Service<select id="incomeService"><option value="website">Website</option><option value="webapp">Web app / software</option><option value="marketing">Marketing</option><option value="other">Other</option></select></label>
          <label>Domain status<select id="domainStatus"><option value="not-needed">Not needed</option><option value="paid">Already paid</option><option value="unpaid">Still need to pay</option></select></label>
          <label id="domainCostWrap" class="hidden">Expected domain cost<input id="domainCost" type="number" min="0" value="${Number(state.brain.defaultDomainCost||0)}" inputmode="numeric" /></label>
          <label>Hosting status<select id="hostingStatus"><option value="not-needed">Not needed</option><option value="paid">Already paid</option><option value="unpaid">Still need to pay</option></select></label>
          <label id="hostingCostWrap" class="hidden">Expected hosting cost<input id="hostingCost" type="number" min="0" value="${Number(state.brain.defaultHostingCost||0)}" inputmode="numeric" /></label>
          <label>Other known project cost<input id="otherProjectCost" type="number" min="0" value="0" inputmode="numeric" placeholder="0" /></label>
          <label>What is that cost?<input id="otherProjectCostName" placeholder="e.g. paid plugin / API" /></label>
        </div>
      </div>

      <div id="loanQuestions" class="smart-question-box full hidden">
        <div class="smart-question-head"><span class="eyebrow">Important</span><strong>Borrowed money is not income.</strong></div>
        <div class="form-grid compact"><label>Repayment due<input id="loanDueDate" type="date" value="${today}" /></label><label>Repay from<select id="loanRepayWallet">${state.wallets.filter(w=>w.type!=='reserve').map(w=>`<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('')}</select></label></div>
      </div>

      <div id="smartAdvice" class="smart-advice full"><span class="eyebrow">Wifey is thinking</span><p>Enter the amount and answer the questions. I’ll protect known costs before showing anything as free money.</p></div>

      <div class="allocation-box full"><div class="allocation-title"><div><span class="eyebrow">Suggested allocation</span><strong>You can change this, but 100% must have a job.</strong></div><button class="small-btn" type="button" id="suggestAllocationBtn">Recalculate</button></div><div class="allocation-rows">${state.wallets.map(w=>`<label class="allocation-row"><span>${escapeHtml(w.name)}</span><input class="allocation-input" data-wallet="${w.id}" type="number" min="0" value="0" inputmode="numeric" /></label>`).join('')}</div><div class="allocation-summary invalid" id="allocationSummary"><span>Still to allocate</span><strong id="allocationRemaining">Rs. 0</strong></div></div>
      <button class="primary-btn full" id="saveIncomeBtn" disabled>Let Wifey save it</button>
    </form>`);

  const source=document.getElementById('incomeSource'), totalInput=document.getElementById('incomeAmount'), projectSelect=document.getElementById('incomeProject');
  const clientBox=document.getElementById('clientQuestions'), loanBox=document.getElementById('loanQuestions'), advice=document.getElementById('smartAdvice'), newProjectFields=document.getElementById('newProjectFields');
  const domainStatus=document.getElementById('domainStatus'), hostingStatus=document.getElementById('hostingStatus');
  const domainCostWrap=document.getElementById('domainCostWrap'), hostingCostWrap=document.getElementById('hostingCostWrap');
  const inputs=[...document.querySelectorAll('.allocation-input')], saveBtn=document.getElementById('saveIncomeBtn'), summary=document.getElementById('allocationSummary'), remainingEl=document.getElementById('allocationRemaining');
  const inputFor=id=>inputs.find(i=>i.dataset.wallet===id);
  const setAllocation=(id,value)=>{const i=inputFor(id);if(i)i.value=Math.max(0,Math.round(Number(value||0)));};
  const recalc=()=>{ const total=Number(totalInput.value||0), allocated=inputs.reduce((sum,i)=>sum+Number(i.value||0),0), remaining=total-allocated, valid=total>0&&Math.abs(remaining)<.001; remainingEl.textContent=valid?'Fully allocated ✓':remaining<0?`${money(Math.abs(remaining))} over`:money(remaining); summary.classList.toggle('valid',valid); summary.classList.toggle('invalid',!valid); saveBtn.disabled=!valid; };
  const knownCosts=()=> Number((domainStatus.value==='unpaid'?document.getElementById('domainCost').value:0)||0)+Number((hostingStatus.value==='unpaid'?document.getElementById('hostingCost').value:0)||0)+Number(document.getElementById('otherProjectCost').value||0);
  const suggest=()=>{
    const total=Number(totalInput.value||0); inputs.forEach(i=>i.value=0); if(!total){recalc();return;}
    const emergency=Math.round(total*Number(state.brain.emergencyPercent||0)/100);
    const personal=Math.round(total*Number(state.brain.ownerPayPercent||0)/100);
    if(source.value==='client'){
      const protectedCost=Math.min(total,knownCosts());
      if(projectReserve) setAllocation(projectReserve.id,protectedCost);
      let remaining=total-protectedCost;
      const e=Math.min(remaining,emergency); setAllocation('reserve',e); remaining-=e;
      const p=Math.min(remaining,personal); setAllocation('personal',p); remaining-=p;
      setAllocation('lomos',remaining);
      const selectedProject=projectSelect.value==='__new__'?null:project(projectSelect.value); const stage=document.getElementById('incomeStage').value; const pct=Number(state.brain.paymentPlan?.[stage]||0); const contract=selectedProject?.contractValue||Number(document.getElementById('newProjectContract')?.value||0); const expected=contract&&pct?Math.round(contract*pct/100):0;
      advice.innerHTML=`<span class="eyebrow">Wifey’s read</span><p>${protectedCost?`${money(protectedCost)} is being protected for known project costs. `:''}${expected?`Your LOMOS ${stage} stage is ${pct}% (${money(expected)}). You received ${money(total)}. `:''}Client money is not profit until the job is delivered.</p>`;
    } else if(source.value==='tappy'){
      const e=Math.min(total,emergency); setAllocation('reserve',e); setAllocation('tappy',total-e); advice.innerHTML=`<span class="eyebrow">Wifey’s read</span><p>I’m keeping a ${state.brain.emergencyPercent}% safety slice and leaving the rest inside Tappy.</p>`;
    } else if(source.value==='personal'){
      const e=Math.min(total,emergency); setAllocation('reserve',e); setAllocation('personal',total-e); advice.innerHTML=`<span class="eyebrow">Wifey’s read</span><p>This is personal income, but I’m still protecting ${money(e)} as reserve.</p>`;
    } else if(source.value==='loan'){
      setAllocation('personal',total); advice.innerHTML=`<span class="eyebrow">Wifey says</span><p>I can hold this money, but I will also create a ${money(total)} repayment obligation. Your balance can go up without your net position improving.</p>`;
    } else {
      const e=Math.min(total,emergency); setAllocation('reserve',e); setAllocation(source.value==='lomos'?'lomos':'personal',total-e); advice.innerHTML=`<span class="eyebrow">Wifey’s read</span><p>${money(e)} protected. The rest goes to the most likely wallet. Change it if that is not the real purpose.</p>`;
    }
    recalc();
  };
  const toggleQuestions=()=>{const isClient=source.value==='client', isLoan=source.value==='loan'; clientBox.classList.toggle('hidden',!isClient); loanBox.classList.toggle('hidden',!isLoan); suggest();};
  const toggleCosts=()=>{domainCostWrap.classList.toggle('hidden',domainStatus.value!=='unpaid');hostingCostWrap.classList.toggle('hidden',hostingStatus.value!=='unpaid');suggest();};
  source.addEventListener('change',toggleQuestions); projectSelect.addEventListener('change',()=>{newProjectFields.classList.toggle('hidden',projectSelect.value!=='__new__');suggest();}); document.getElementById('incomeStage').addEventListener('change',suggest); document.getElementById('newProjectContract').addEventListener('input',suggest); domainStatus.addEventListener('change',toggleCosts); hostingStatus.addEventListener('change',toggleCosts); totalInput.addEventListener('input',suggest);
  ['domainCost','hostingCost','otherProjectCost'].forEach(id=>document.getElementById(id)?.addEventListener('input',suggest));
  document.getElementById('suggestAllocationBtn').onclick=suggest; inputs.forEach(i=>i.addEventListener('input',recalc)); toggleQuestions(); toggleCosts();

  document.getElementById('incomeForm').onsubmit=e=>{
    e.preventDefault(); const amount=Number(totalInput.value), allocations=inputs.map(i=>({walletId:i.dataset.wallet,amount:Number(i.value||0)}));
    let projectId=source.value==='client'?(projectSelect.value||null):null;
    if(source.value==='client'&&!projectId){toast('Choose the client project so Wifey knows what this money owes.');return;}
    if(projectId==='__new__'){
      const name=document.getElementById('newProjectName').value.trim(); if(!name){toast('Give the new project a name.');return;}
      projectId=uid(); state.projects.push({id:projectId,name,client:document.getElementById('newProjectClient').value.trim()||document.getElementById('incomeDesc').value.trim(),contractValue:Number(document.getElementById('newProjectContract').value||0),legacyReceived:0,legacyExpenses:0,status:'active',serviceType:'',lastPaymentStage:''});
    }
    try{
      const groupId=uid();
      addIncomeAllocation({amount,description:document.getElementById('incomeDesc').value.trim(),date:document.getElementById('incomeDate').value,projectId,allocations,sourceType:source.value,groupId});
      if(projectId){
        const p=project(projectId); if(p){p.serviceType=document.getElementById('incomeService').value;p.lastPaymentStage=document.getElementById('incomeStage').value; const st=document.getElementById('incomeStage').value,pct=Number(state.brain.paymentPlan?.[st]||0),expected=Math.round((p.contractValue||0)*pct/100); if(expected&&amount<expected)addSmartTask({title:`Collect ${money(expected-amount)} remaining for ${st} stage`,projectId,kind:'collection'});}
        if(document.getElementById('incomeService').value==='website') ensureWebsiteWorkflow(projectId);
        const reserveWallet=projectReserve?.id||'lomos';
        if(domainStatus.value==='unpaid'&&Number(document.getElementById('domainCost').value)>0){
          const val=Number(document.getElementById('domainCost').value); state.commitments.push({id:uid(),name:`${project(projectId)?.name||'Project'} domain`,amount:val,walletId:reserveWallet,category:'Domains',dueDate:today,frequency:'one-off',active:true,projectId,kind:'project-cost'}); addSmartTask({title:'Register / pay project domain',projectId,kind:'domain'});
        }
        if(hostingStatus.value==='unpaid'&&Number(document.getElementById('hostingCost').value)>0){
          const val=Number(document.getElementById('hostingCost').value); state.commitments.push({id:uid(),name:`${project(projectId)?.name||'Project'} hosting`,amount:val,walletId:reserveWallet,category:'Hosting',dueDate:today,frequency:'annual',active:true,projectId,kind:'project-cost'}); addSmartTask({title:'Set up project hosting',projectId,kind:'hosting'});
        }
        const other=Number(document.getElementById('otherProjectCost').value||0); if(other>0){const nm=document.getElementById('otherProjectCostName').value.trim()||'Known project cost';state.commitments.push({id:uid(),name:nm,amount:other,walletId:reserveWallet,category:'Project costs',dueDate:today,frequency:'one-off',active:true,projectId,kind:'project-cost'});}
      }
      if(source.value==='loan') state.commitments.push({id:uid(),name:`Repay ${document.getElementById('incomeDesc').value.trim()||'borrowed money'}`,amount,walletId:document.getElementById('loanRepayWallet').value,category:'Bills',dueDate:document.getElementById('loanDueDate').value,frequency:'one-off',active:true,projectId:null,kind:'debt'});
      save();closeModal();toast('Money received. I already gave it jobs. 💅');
    }catch(err){toast(err.message);}
  };
}
function transferForm(){
  modal(`<span class="eyebrow">Move money</span><h2 id="modalTitle">Transfer between wallets.</h2><form id="transferForm" class="form-grid">
    <label>From<select id="transferFrom">${state.wallets.map(w=>`<option value="${w.id}">${escapeHtml(w.name)} · ${money(w.balance)}</option>`).join('')}</select></label>
    <label>To<select id="transferTo">${state.wallets.map((w,i)=>`<option value="${w.id}" ${i===1?'selected':''}>${escapeHtml(w.name)}</option>`).join('')}</select></label>
    <label>Amount<input id="transferAmount" type="number" min="1" inputmode="numeric" required /></label>
    <label>Date<input id="transferDate" type="date" value="${today}" /></label>
    <label class="full">Note<input id="transferDesc" placeholder="e.g. Owner draw" /></label>
    <button class="primary-btn full">Transfer</button></form>`);
  document.getElementById('transferForm').onsubmit=e=>{e.preventDefault(); const from=wallet(transferFrom.value), amount=Number(transferAmount.value); if(transferFrom.value===transferTo.value){toast('Choose two different wallets.');return;} if(amount>Math.max(0,from.balance-from.reserved)){toast('That would use locked money.');return;} if(amount>walletSpendable(from)&&!confirm('This transfer uses money Wifey considers committed. Continue anyway?'))return; addTransfer({amount,fromWalletId:transferFrom.value,toWalletId:transferTo.value,description:transferDesc.value.trim()||'Wallet transfer',date:transferDate.value});closeModal();toast('Moved. And yes, I’m still watching. 👀');};
}
function walletForm(id=null){
  const current=id?wallet(id):null;
  modal(`<span class="eyebrow">${current?'Edit':'New'} wallet</span><h2 id="modalTitle">${current?'Adjust the rules.':'Give this money a home.'}</h2><form id="walletForm" class="form-grid">
    <label>Name<input id="walletName" required value="${escapeAttr(current?.name||'')}" placeholder="e.g. Project Reserve" /></label>
    <label>Type<select id="walletType">${['personal','business','project','reserve'].map(t=>`<option value="${t}" ${current?.type===t?'selected':''}>${t[0].toUpperCase()+t.slice(1)}</option>`).join('')}</select></label>
    ${current?'':`<label>Opening balance<input id="walletBalance" type="number" min="0" value="0" /></label>`}
    <label>Locked amount<input id="walletReserved" type="number" min="0" value="${current?.reserved||0}" /></label>
    <button class="primary-btn full">${current?'Save wallet':'Create wallet'}</button></form>`);
  document.getElementById('walletForm').onsubmit=e=>{e.preventDefault(); if(current){current.name=walletName.value.trim();current.type=walletType.value;current.reserved=Math.max(0,Number(walletReserved.value||0));}else{const opening=Number(walletBalance.value||0),newWallet={id:uid(),name:walletName.value.trim(),type:walletType.value,balance:opening,reserved:Number(walletReserved.value||0),icon:'•'};state.wallets.push(newWallet);if(opening>0)state.transactions.push({id:uid(),type:'income',amount:opening,walletId:newWallet.id,category:'Opening balance',description:`${newWallet.name} opening balance`,date:today});}save();closeModal();toast(current?'Wallet updated. Cute and organised. ✨':'New wallet. New boundary. 💋');};
}
function budgetForm(){
  modal(`<span class="eyebrow">New budget</span><h2 id="modalTitle">Set the ceiling.</h2><form id="budgetForm" class="form-grid"><label>Name<input id="budgetName" required /></label><label>Category<select id="budgetCategory">${state.categories.map(c=>`<option>${escapeHtml(c)}</option>`).join('')}</select></label><label>Monthly limit<input id="budgetLimit" type="number" min="1" inputmode="numeric" required /></label><button class="primary-btn full">Create budget</button></form>`);
  document.getElementById('budgetForm').onsubmit=e=>{e.preventDefault();const category=budgetCategory.value;if(state.budgets.some(b=>b.category===category)){toast('That category already has a budget.');return;}state.budgets.push({id:uid(),name:budgetName.value.trim(),category,limit:Number(budgetLimit.value)});save();closeModal();toast('Boundary set. Love that for us. 😌');};
}
function projectForm(){
  modal(`<span class="eyebrow">New project</span><h2 id="modalTitle">Track what it really makes.</h2><form id="projectForm" class="form-grid"><label>Project name<input id="projectName" required /></label><label>Client<input id="projectClient" /></label><label>Contract value<input id="projectContract" type="number" min="0" inputmode="numeric" /></label><button class="primary-btn full">Add project</button></form>`);
  document.getElementById('projectForm').onsubmit=e=>{e.preventDefault();state.projects.push({id:uid(),name:projectName.value.trim(),client:projectClient.value.trim(),contractValue:Number(projectContract.value||0),legacyReceived:0,legacyExpenses:0,status:'active'});save();closeModal();toast('Project added. Client money stays client money. 💼');};
}
function commitmentForm(){
  modal(`<span class="eyebrow">New commitment</span><h2 id="modalTitle">Tell Wifey what is already promised.</h2><form id="commitmentForm" class="form-grid">
    <label>Name<input id="commitmentName" required placeholder="e.g. Hosting renewal" /></label>
    <label>Amount<input id="commitmentAmount" type="number" min="1" inputmode="numeric" required /></label>
    <label>Pay from<select id="commitmentWallet">${state.wallets.filter(w=>w.type!=='reserve').map(w=>`<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('')}</select></label>
    <label>Category<select id="commitmentCategory">${state.categories.map(c=>`<option>${escapeHtml(c)}</option>`).join('')}</select></label>
    <label>Next due date<input id="commitmentDate" type="date" value="${today}" required /></label>
    <label>Frequency<select id="commitmentFrequency"><option value="one-off">One-off</option><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>
    <button class="primary-btn full">Save commitment</button></form>`);
  document.getElementById('commitmentForm').onsubmit=e=>{e.preventDefault();state.commitments.push({id:uid(),name:commitmentName.value.trim(),amount:Number(commitmentAmount.value),walletId:commitmentWallet.value,category:commitmentCategory.value,dueDate:commitmentDate.value,frequency:commitmentFrequency.value,active:true});save();closeModal();toast('Promise saved. I’ll keep that money safe. 🫶');};
}
function payCommitment(id){
  const c=state.commitments.find(x=>x.id===id); if(!c)return; const w=wallet(c.walletId); if(c.amount>w.balance&&!confirm(`${w?.name||'Wallet'} will go negative. Record payment anyway?`))return;
  addExpense({amount:c.amount,walletId:c.walletId,category:c.category,description:c.name,date:today,projectId:c.projectId||null});
  if(c.frequency==='monthly'){const d=parseDateLocal(c.dueDate);d.setMonth(d.getMonth()+1);c.dueDate=localDate(d);c.active=true;}else if(c.frequency==='annual'){const d=parseDateLocal(c.dueDate);d.setFullYear(d.getFullYear()+1);c.dueDate=localDate(d);c.active=true;}else c.active=false;
  save();toast(c.frequency==='monthly'?'Paid. Next month is scheduled.':'Paid and cleared.');
}

// Primary actions
document.getElementById('quickExpenseBtn').onclick = expenseForm;
document.getElementById('quickIncomeBtn').onclick = incomeAllocationForm;
document.getElementById('addTransactionBtn').onclick = expenseForm;
document.getElementById('mobileAddBtn').onclick = expenseForm;
['transferBtn','walletTransferBtn','dashboardTransferBtn'].forEach(id => document.getElementById(id).onclick = transferForm);
document.getElementById('addWalletBtn').onclick = () => walletForm();
document.getElementById('addBudgetBtn').onclick = budgetForm;
document.getElementById('addProjectBtn').onclick = projectForm;
document.getElementById('addCommitmentBtn').onclick = commitmentForm;

document.querySelectorAll('.filter').forEach(b => b.onclick = () => { document.querySelectorAll('.filter').forEach(x => x.classList.remove('active')); b.classList.add('active'); currentFilter=b.dataset.filter; renderTransactions(); });
document.getElementById('strictness').addEventListener('input', e => { state.strictness=Number(e.target.value); save(); });
const brainForm=document.getElementById('brainForm');
if(brainForm) brainForm.addEventListener('submit',e=>{e.preventDefault();const a=Number(document.getElementById('brainAdvance').value||0),b=Number(document.getElementById('brainApproval').value||0),c=Number(document.getElementById('brainDeployment').value||0);if(a+b+c!==100){toast('LOMOS payment stages must total 100%.');return;}state.brain.defaultDomainCost=Number(document.getElementById('brainDomainCost').value||0);state.brain.defaultHostingCost=Number(document.getElementById('brainHostingCost').value||0);state.brain.ownerPayPercent=Number(document.getElementById('brainOwnerPay').value||0);state.brain.emergencyPercent=Number(document.getElementById('brainEmergency').value||0);state.brain.paymentPlan={advance:a,approval:b,deployment:c};save();toast('Got it, babe. I learned the LOMOS rules. 🧠💋');});

document.getElementById('exportBtn').onclick = () => {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`ask-wifey-backup-${today}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); toast('Backup safe. Responsible looks good on you. ✨');
};
document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
document.getElementById('importFile').addEventListener('change', async e => {
  const file=e.target.files?.[0]; if(!file)return;
  try{const raw=JSON.parse(await file.text()); if(!Array.isArray(raw.wallets)||!Array.isArray(raw.transactions))throw new Error('Not an Ask Wifey backup.'); if(!confirm('Restore this backup? Your current local data will be replaced.'))return; state=normalizeState(raw);save();toast('We’re back. I remembered everything. 💌');}
  catch(err){toast(err.message||'Could not restore backup.');} finally{e.target.value='';}
});
document.getElementById('resetBtn').onclick = () => { if(confirm('Reset all Ask Wifey local data? This cannot be undone unless you exported a backup.')){ state=cloneDefault(); save(); toast('Local data reset.'); } };

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt=e; const btn=document.getElementById('installBtn'); btn.hidden=false; document.getElementById('installCopy').textContent='Ask Wifey is ready to install on this device.'; });
document.getElementById('installBtn').onclick = async () => { if(!deferredInstallPrompt)return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; document.getElementById('installBtn').hidden=true; };
window.addEventListener('appinstalled', () => { document.getElementById('installCopy').textContent='Ask Wifey is installed on this device.'; });

function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2200); }
function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(s=''){ return escapeHtml(s).replace(/`/g,'&#96;'); }

if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
renderAll();
