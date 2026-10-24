// ===== Industrialist: the rules of the game (no screen code) =====
// Four mines with twelve shafts each. Shafts dig ore into deposits, the elevator lifts it to a stockpile and the
// warehouse sells it. Managers run stages on their own; claims reset a mine for gold ingots. This module owns the
// Industrialist state and nothing else; the Industrialist module below draws it and connects it to the app.
// Numbers are shown with the app's fmt(); money here is dollars.
const IndLogic=(function(){
'use strict';

/* ---------- static data ---------- */
const O=(n,c)=>[n,c];
const REGIONS=[
 {id:'ridge',name:'Ridgeback Hills',short:'Ridgeback',mech:null,mat:'bars',value:1,out:1,depth:120,
  blurb:'A steady hillside mine. Everything works the way the field guide says.',
  ores:[O('Coal','#6a615a'),O('Copper','#c8743f'),O('Tin','#9aa3a6'),O('Iron','#a5725a'),O('Silver','#d5d9dc'),O('Gold','#f2c14e'),O('Platinum','#e4e1d6'),O('Ruby','#e0435d'),O('Sapphire','#4f7fe6'),O('Emerald','#2fbf75'),O('Diamond','#bfeaf2'),O('Painite','#c4593a')]},
 {id:'glacier',name:'Frostvein Glacier',short:'Frostvein',mech:'freeze',mat:'crystal',value:1.75,out:1,depth:150,
  blurb:'Ore sells for 75% more, but ore left waiting in a deposit freezes solid and is lost, faster the deeper the shaft. Elevator speed decides everything here.',
  ores:[O('Rime quartz','#b9d4e0'),O('Blue salt','#7fa8d8'),O('Cryolite','#d9e8ee'),O('Rime iron','#8fa3ad'),O('Moonsilver','#e3ecf2'),O('Aurorite','#7fe0c4'),O('Glacial opal','#c9e6f5'),O('Snow beryl','#f0f6fa'),O('Polar jade','#7ec8a5'),O('Ice sapphire','#6aa0f0'),O('Frost diamond','#e6fbff'),O('Everfrost','#a8f0ff')]},
 {id:'caldera',name:'Ember Caldera',short:'Ember',mech:'heat',mat:'obsidian',value:1,out:2,depth:120,
  blurb:'Shafts dig twice as much, but they heat up while working and shut down to cool when they hit 100°. Vent them by hand to keep them running.',
  ores:[O('Basalt','#5d5450'),O('Sulfur','#e6d34a'),O('Pumice','#b8aea0'),O('Magnetite','#59585e'),O('Cinnabar','#c2392e'),O('Fire opal','#f07a3a'),O('Garnet','#9c2b3a'),O('Sunstone','#f0a050'),O('Spinel','#d0405e'),O('Red beryl','#e05070'),O('Magma pearl','#ff8a4a'),O('Heartstone','#ff5a3a')]},
 {id:'trench',name:'Abyssal Trench',short:'Abyssal',mech:'route',mat:'pearl',value:2.4,out:1,depth:300,
  blurb:'Ore sells for 140% more, but the pressure elevator can only stop at a few shafts per trip and deposits fill up. Choose which shafts are on the route.',
  ores:[O('Black shale','#4a4a52'),O('Manganese','#8a6f8a'),O('Cobalt','#3d5fb8'),O('Nickel','#a8a89a'),O('Vanadium','#6a8ac0'),O('Abyssal gold','#d8b040'),O('Benitoite','#4a7ae0'),O('Tanzanite','#6a50c0'),O('Black opal','#5a6a8a'),O('Grandidierite','#5ab0a0'),O('Red diamond','#e04050'),O('Void crystal','#9a80ff')]},
];
const MATS={bars:{name:'Steel bars',short:'Bars',color:'#a9b4bd'},crystal:{name:'Ice crystals',short:'Crystals',color:'#8fd3e8'},obsidian:{name:'Obsidian',short:'Obsidian',color:'#b06a9a'},pearl:{name:'Deep pearls',short:'Pearls',color:'#d8d0f0'}};
const MIL=[10,25,50,100,150,200,300,400,500];
/* every-shaft milestones: when every shaft of a mine (at least the first three) reaches a MIL level, all its shafts dig ×2.
   Kept for the claim once reached, so sinking a new shaft never takes one away. Keeps the shallow shafts worth levelling */
const R_SHAFT=1.2,R_E=1.15,R_W=1.15,BASE_CYCLE=4,OT_CD=900,OFFLINE_CAP=86400,STOCK_TRIPS=20,CLAIM_MIN=1e7;
const RANK_S=[1,1,2,4],RANK_EW=[1,1,1.5,2.5],RANK_NAME=['None','Manager','Senior','Chief'],RANK_COST=[0,1,250,25000];
const SPEC={
 s:{a:{name:'Foreman',abil:'Rich vein',desc:'Active. Tap the ability to quadruple this shaft’s output for a burst.'},p:{name:'Steady hand',desc:'Passive. This shaft always digs 40% more, offline too.'}},
 e:{a:{name:'Operator',abil:'Express run',desc:'Active. Tap the ability to make the elevator three times as fast for a burst.'},p:{name:'Loader',desc:'Passive. The elevator always carries 40% more, offline too.'}},
 w:{a:{name:'Broker',abil:'Bulk deal',desc:'Active. Tap the ability to make the warehouse carry three times as much for a burst.'},p:{name:'Dispatcher',desc:'Passive. The warehouse always carries 40% more, offline too.'}},
};
const DOCT={
 rush:{name:'Rush',desc:'Manager abilities recharge 30% faster and Overtime digs ×2.5 here.'},
 steady:{name:'Steady',desc:'Passive managers give +60% here instead of +40%.'},
 haul:{name:'Haulage',desc:'Elevator and warehouse carry 30% more here.'},
};
const ITEMS={dyn:{name:'Dynamite',desc:'Blasts 20 digs of ore into every deposit of this mine'},coffee:{name:'Strong coffee',desc:'Every mine runs twice as fast for 2 min'},lamp:{name:'Lucky lamp',desc:'Ore sells for triple in every mine for 60 s'},card:{name:'Time card',desc:'Pays 5 min of this mine’s idle income now'}};
const ITEM_W=[['dyn',35],['coffee',30],['lamp',20],['card',15]];
/* lab levels are spread over the mine's depth: level L belongs to shaft labAt() and opens once that shaft is open,
   priced at f × that shaft's opening price, so research stays a real spend all the way down instead of maxing early */
const LAB=[
 {id:'bits',name:'Diamond drill bits',desc:'Shafts dig 25% more ore per level',max:20,f:1.5},
 {id:'blast',name:'Blasting crews',desc:'Digs finish 15% faster per level',max:10,f:6},
 {id:'cage',name:'Counterweights',desc:'The elevator moves 15% faster per level',max:10,f:1.5},
 {id:'conv',name:'Conveyor belts',desc:'Warehouse trips are 15% faster per level',max:10,f:1.5},
 {id:'grade',name:'Ore grading',desc:'Ore sells for 10% more per level',max:20,f:6},
 {id:'oil',name:'Lamp oil',desc:'Manager abilities recharge 10% faster per level',max:5,f:6},
 {id:'flux',name:'Refinery flux',desc:'The refinery makes 25% more per level',max:10,f:3},
 {id:'seams',name:'Reworked seams',desc:'The four shallowest shafts dig twice as much per level',max:6,f:3},
 {id:'insul',name:'Insulated deposits',desc:'Deposits freeze 10% slower per level (freezing can be at most halved)',max:5,f:1.5,only:'freeze'},
 {id:'sinks',name:'Heat sinks',desc:'Shafts heat up 9% slower per level (heating can be cut by at most 45%)',max:5,f:1.5,only:'heat'},
 {id:'ballast',name:'Ballast tanks',desc:'The elevator can make 1 more stop per level',max:2,f:6,only:'route'},
];
const PERKS=[
 {need:4,a:{id:'head',name:'Head start',desc:'Each claim starts with $2,500 and the second shaft open'},b:{id:'hands',name:'Trusted hands',desc:'Managers and promotions cost 60% less'}},
 {need:20,a:{id:'long',name:'Long shifts',desc:'Overtime lasts 10 minutes instead of 5'},b:{id:'night',name:'Night crew',desc:'Offline earnings are doubled'}},
 {need:60,a:{id:'cage3',name:'Heavy cage',desc:'Elevators carry three times as much'},b:{id:'wagon3',name:'Wide wagons',desc:'Warehouses carry three times as much'}},
 {need:150,a:{id:'keen',name:'Keen eye',desc:'Events turn up twice as often and nuggets pay triple'},b:{id:'vets',name:'Veterans',desc:'Manager abilities last twice as long'}},
 {need:400,a:{id:'assay',name:'Assay guild',desc:'Lab research costs 75% less'},b:{id:'charts',name:'Deep charts',desc:'New shafts and their managers cost 90% less'}},
 {need:1000,a:{id:'lode',name:'Mother lode',desc:'Level milestones multiply output by 2.5 instead of 2'},b:{id:'crown',name:'Crown contract',desc:'Ore sells for three times as much'}},
];
const EQUIP=[
 {id:'drill',name:'Diamond drill heads',desc:'Every shaft digs 15% more per level',cost:{bars:60},max:10},
 {id:'winch',name:'Hydraulic winch',desc:'Every elevator moves 12% faster per level',cost:{bars:60,crystal:40},max:10},
 {id:'rail',name:'Freight rail',desc:'Every warehouse carries and stores 20% more per level',cost:{bars:90},max:10},
 {id:'clock',name:'Night-shift clock',desc:'Offline earnings +10% per level',cost:{bars:80,crystal:80},max:10},
 {id:'heater',name:'Heater coils',desc:'Frostvein ore freezes 8% slower per level (freezing can be at most halved)',cost:{crystal:100},max:6},
 {id:'coolant',name:'Coolant pumps',desc:'Ember shafts heat up 7% slower per level (heating can be cut by at most 45%)',cost:{obsidian:100,crystal:60},max:6},
 {id:'assay',name:'Assay kit',desc:'Every refinery makes 15% more per level',cost:{obsidian:150},max:10},
 {id:'hull',name:'Pressure hull',desc:'Abyssal deposits hold 25% more and the elevator gets +1 stop every 3 levels',cost:{pearl:100,obsidian:80},max:8},
 {id:'charm',name:'Prospector’s charm',desc:'Events come 8% sooner and pay 15% more per level',cost:{pearl:150},max:10},
];
const PROJ=[
 {id:'glacier',name:'Survey Frostvein Glacier',desc:'Opens a second mine where ore freezes if the elevator is slow. Produces ice crystals.',ingots:15,cost:{bars:80},mine:1},
 {id:'shop1',name:'Workshop wing',desc:'A third equipment slot.',ingots:60,cost:{bars:600,crystal:300},slot:1},
 {id:'caldera',name:'Survey Ember Caldera',desc:'Opens a volcanic mine where shafts overheat. Produces obsidian.',ingots:200,cost:{bars:2000,crystal:2500},mine:2},
 {id:'shop2',name:'Second workshop wing',desc:'A fourth equipment slot.',ingots:500,cost:{bars:3000,crystal:5000,obsidian:3000},slot:1},
 {id:'trench',name:'Survey Abyssal Trench',desc:'Opens a deep mine where you route the pressure elevator. Produces deep pearls.',ingots:1000,cost:{bars:6000,crystal:15000,obsidian:12000},mine:3},
 {id:'shop3',name:'Third workshop wing',desc:'A fifth equipment slot.',ingots:2500,cost:{obsidian:20000,pearl:10000},slot:1},
 {id:'core',name:'Deep Core bore',desc:'An endless project. Each stage adds 10% to ore prices in every mine. Stage 3 extends offline time to 36 h, stage 6 raises every equipment cap by 5 levels, stage 10 adds a sixth slot.',ingots:3000,cost:{bars:30000,crystal:30000,obsidian:30000,pearl:20000},repeat:1.35},
];
const FEATS=[
 ['overtime',s=>s.st.hires>=1,'Overtime','Double all digging for a few minutes, free to call every 15 minutes.'],
 ['events',s=>anyMine(m=>m.shafts.length>=2),'Mine events','Nuggets, cave-ins, rush orders and geodes turn up every few minutes in the mine you are watching. React to them for rewards.'],
 ['lab',s=>anyMine(m=>m.shafts.length>=3),'Assay lab','Pick a doctrine and research boosts for this claim in the Lab tab. Research resets with each new claim.'],
 ['refinery',s=>anyMine(m=>m.shafts.length>=3),'Refinery','Build a refinery on the warehouse to turn part of your ore into materials. Materials pay for projects and equipment in the Works tab.'],
 ['ranks',s=>anyMine(m=>m.shafts.length>=4),'Promotions','Tap a manager’s stars to promote them to Senior or Chief for a large permanent bonus to their stage.'],
 ['perks',s=>totalIngots()>=4,'Charter perks','Your ingots unlock guild perks. Pick one of each pair in the Guild tab.'],
];
const A=(id,name,desc,val,target)=>({id,name,desc,val,target});
const best=f=>()=>Math.max(...S.mines.filter(m=>m.open).map(f));
const ACH=[
 A('earn3','First paycheck','Earn $1,000 in total',()=>S.total,1e3),
 A('earn6','Millionaire','Earn $1M in total',()=>S.total,1e6),
 A('earn9','Billionaire','Earn $1B in total',()=>S.total,1e9),
 A('earn12','Tycoon','Earn $1T in total',()=>S.total,1e12),
 A('earn15','Magnate','Earn $1Qa in total',()=>S.total,1e15),
 A('earn18','Mineral empire','Earn $1Qi in total',()=>S.total,1e18),
 A('earn24','Planetary concern','Earn $1Sp in total',()=>S.total,1e24),
 A('sh3','Going deeper','Open 3 shafts in one mine',best(m=>m.shafts.length),3),
 A('sh6','Halfway down','Open 6 shafts in one mine',best(m=>m.shafts.length),6),
 A('sh9','Into the gems','Open 9 shafts in one mine',best(m=>m.shafts.length),9),
 A('sh12','Bedrock','Open all 12 shafts in one mine',best(m=>m.shafts.length),12),
 A('lv25','Seasoned shaft','Raise any shaft to Lv 25',best(m=>Math.max(...m.shafts.map(x=>x.lvl))),25),
 A('lv100','Century','Raise any shaft to Lv 100',best(m=>Math.max(...m.shafts.map(x=>x.lvl))),100),
 A('lv250','Deep veteran','Raise any shaft to Lv 250',best(m=>Math.max(...m.shafts.map(x=>x.lvl))),250),
 A('m3','Delegation','Have 3 managers in one mine',best(m=>keysOf(m).filter(k=>stageOf(m,k).mgr).length),3),
 A('m14','Fully staffed','Staff all 14 stages of a full mine',best(m=>keysOf(m).filter(k=>stageOf(m,k).mgr).length),14),
 A('chief','Chief of staff','Promote any manager to Chief',best(m=>Math.max(...keysOf(m).map(k=>stageOf(m,k).mgr))),3),
 A('mi10','Contractor','Complete 10 missions',()=>S.st.missions,10),
 A('mi50','Reliable outfit','Complete 50 missions',()=>S.st.missions,50),
 A('mi200','Company of record','Complete 200 missions',()=>S.st.missions,200),
 A('ev5','Quick hands','Handle 5 mine events',()=>S.st.events,5),
 A('ev50','Troubleshooter','Handle 50 mine events',()=>S.st.events,50),
 A('ev200','Old hand','Handle 200 mine events',()=>S.st.events,200),
 A('nug10','Prospector','Grab 10 gold nuggets',()=>S.st.nuggets,10),
 A('ab25','Leadership','Use 25 manager abilities',()=>S.st.abil,25),
 A('ab500','Inspiring','Use 500 manager abilities',()=>S.st.abil,500),
 A('vent50','Pressure valve','Vent overheating shafts 50 times',()=>S.st.vents,50),
 A('cl1','Staked','Stake your first new claim',()=>S.st.claims,1),
 A('cl10','Claim jumper','Stake 10 new claims',()=>S.st.claims,10),
 A('cl40','Land baron','Stake 40 new claims',()=>S.st.claims,40),
 A('in50','Ingot stack','Hold 50 gold ingots across your mines',()=>totalIngots(),50),
 A('in1000','Bullion vault','Hold 1,000 gold ingots across your mines',()=>totalIngots(),1000),
 A('in10k','Gold standard','Hold 10,000 gold ingots across your mines',()=>totalIngots(),10000),
 A('mine2','Cold feet','Open Frostvein Glacier',()=>openCount(),2),
 A('mine3','Fire walker','Open Ember Caldera',()=>openCount(),3),
 A('mine4','Deep diver','Open the Abyssal Trench',()=>openCount(),4),
 A('craft','Toolmaker','Craft a piece of equipment',()=>Object.values(S.equip).reduce((a,b)=>a+b,0),1),
 A('craft30','Master smith','Reach 30 total equipment levels',()=>Object.values(S.equip).reduce((a,b)=>a+b,0),30),
 A('core5','Into the core','Finish 5 stages of the Deep Core bore',()=>S.proj.core||0,5),
 A('lab','Mad scientist','Max out any research',best(m=>LAB.filter(d=>m.lab[d.id]>=d.max).length),1),
 A('cr25','Quartermaster','Open 25 supply crates',()=>S.st.crates,25),
 A('day7','Regular','Collect the supply drop 7 days in a row',()=>S.daily.streak,7),
];

/* ---------- state ---------- */
let S=null,acc=0;const subs=[];const api={};
const R=()=>api.rng();
function emit(t,d){for(const f of subs){try{f(t,d||{})}catch(e){console.error(e)}}}
const newShaft=()=>({lvl:1,dep:0,mgr:0,spec:'a',t:-1,ab:{until:0,ready:0},cave:0,heat:0,hot:0,route:1});
const newStage=()=>({lvl:1,mgr:0,spec:'a',t:-1,load:0,ab:{until:0,ready:0}});
function freshRun(){return{cash:0,run:0,shafts:[newShaft()],E:Object.assign(newStage(),{plan:null,k:0,wait:0}),W:Object.assign(newStage(),{T:4}),stock:0,
  lab:{bits:0,blast:0,cage:0,conv:0,grade:0,oil:0,flux:0,insul:0,sinks:0,ballast:0,seams:0},doct:null,ref:0,allMil:0,
  rs:{earned:0,dug:0,sold:0,played:0,missions:0,events:0,peak:0,lost:0,mat:0}}}
function newMine(i){return Object.assign({i,open:i===0,ingots:0,claims:0,split:0,best:1,mastered:0,life:0},freshRun())}
function fresh(){return{v:3,clock:0,cur:0,mines:REGIONS.map((_,i)=>newMine(i)),total:0,
  perks:[null,null,null,null,null,null],perkLock:[0,0,0,0,0,0],items:{dyn:0,coffee:0,lamp:0,card:0},
  mats:{bars:0,crystal:0,obsidian:0,pearl:0},equip:{},slots:[null,null],proj:{},ach:{},feat:{},
  st:{dug:0,sold:0,eTrips:0,wTrips:0,taps:0,upgrades:0,events:0,nuggets:0,missions:0,abil:0,items:0,crates:0,played:0,bestRate:0,hires:0,claims:0,vents:0,mats:0},
  ot:{until:0,ready:0},buff:{coffee:0,lamp:0,surge:0},ev:{next:60,cur:null},missions:[],swapReady:0,
  daily:{last:'',streak:0},mDone:0,mSerial:0,tut:0,pending:null,buy:'1',ui:{},last:Date.now()}}

/* ---------- helpers ---------- */

const regOf=m=>REGIONS[m.i];
const cur=()=>S.mines[S.cur];
const anyMine=f=>S.mines.some(m=>m.open&&f(m));
const openCount=()=>S.mines.filter(m=>m.open).length;
const totalIngots=()=>S.mines.reduce((a,m)=>a+m.ingots,0);
const on=o=>S.clock<o.until;
const stageOf=(m,k)=>k==='e'?m.E:k==='w'?m.W:m.shafts[+k.slice(1)];
const keysOf=m=>[...m.shafts.map((_,i)=>'s'+i),'e','w'];
const keyName=(m,k)=>k==='e'?'elevator':k==='w'?'warehouse':regOf(m).ores[+k.slice(1)][0]+' shaft';
function perk(id){for(let t=0;t<PERKS.length;t++){const p=S.perks[t];if(p&&PERKS[t][p].id===id&&totalIngots()>=PERKS[t].need)return true}return false}
const eq=id=>S.slots.includes(id)?(S.equip[id]||0):0;
const nextMil=L=>{for(const x of MIL)if(L<x)return x;return null};
function allWeakest(m){const n=Math.max(3,m.shafts.length);let lo=0,lv=m.shafts[0].lvl;for(let i=1;i<n;i++){const L=m.shafts[i]?m.shafts[i].lvl:0;if(L<lv){lo=i;lv=L}}return{i:lo,lvl:lv}}
function allMilCheck(m){const lv=allWeakest(m).lvl;let got=0;while(m.allMil<MIL.length&&lv>=MIL[m.allMil]){m.allMil++;got++}return got}
function milMult(L){const f=perk('lode')?2.5:2;let m=1;for(const x of MIL)if(L>=x)m*=f;return m}
const spd=L=>Math.min(3,1+(L-1)*.02);
const coffee=st=>!st&&S.clock<S.buff.coffee?2:1;
const passive=m=>m.doct==='steady'?1.6:1.4;
const specMul=(m,s)=>s.mgr&&s.spec==='p'?passive(m):1;
const abOn=(s,st)=>!st&&s.mgr&&s.spec==='a'&&on(s.ab);
const haul=m=>m.doct==='haul'?1.3:1;
const coreStages=()=>S.proj.core||0;

/* ---------- production numbers (one mine) ---------- */
function shaftOut(m,i,st){const s=m.shafts[i],r=regOf(m);
  let p=5*Math.pow(12,i)*s.lvl*milMult(s.lvl)*Math.pow(2,(m.allMil|0)+(i<4?m.lab.seams|0:0))*RANK_S[s.mgr]*specMul(m,s)*(1+.25*m.lab.bits)*(1+.15*eq('drill'))*r.out;
  if(!st){if(s.cave)return 0;if(abOn(s,st))p*=4;if(on(S.ot))p*=m.doct==='rush'?2.5:2}return p}
const cycle=(m,st)=>BASE_CYCLE/((1+.15*m.lab.blast)*coffee(st));
const eSpeed=(m,st)=>spd(m.E.lvl)*(1+.15*m.lab.cage)*(1+.12*eq('winch'))*coffee(st)*(abOn(m.E,st)?3:1);
const eCap=m=>40*Math.pow(1.17,m.E.lvl-1)*RANK_EW[m.E.mgr]*specMul(m,m.E)*(perk('cage3')?3:1)*haul(m);
const wCap=(m,st)=>30*Math.pow(1.17,m.W.lvl-1)*RANK_EW[m.W.mgr]*specMul(m,m.W)*(perk('wagon3')?3:1)*(1+.2*eq('rail'))*haul(m)*(abOn(m.W,st)?3:1);
const wTrip=(m,st)=>4/(spd(m.W.lvl)*(1+.15*m.lab.conv)*coffee(st));
const stockCap=m=>wCap(m,true)*STOCK_TRIPS;
const floorTime=m=>regOf(m).mech==='route'?1.05:.7;
const loadTime=m=>regOf(m).mech==='route'?1.5:.5;
const routeList=m=>m.shafts.map((s,i)=>i).filter(i=>regOf(m).mech!=='route'||m.shafts[i].route);
function eRound(m,st){const L=routeList(m);if(!L.length)return Infinity;const s=eSpeed(m,st),deep=L[L.length-1]+1;return (2*deep*floorTime(m)+L.length*loadTime(m))/s}
const maxStops=m=>2+m.lab.ballast+Math.floor(eq('hull')/3);
const depCap=(m,i)=>regOf(m).mech==='route'?shaftOut(m,i,true)*40*(1+.25*eq('hull')):Infinity;
/* Frostvein: deposits lose ore continuously, deeper shafts faster. Research and equipment can at most halve it, so the elevator always matters. */
const freezeCut=m=>Math.max(.5,1-.1*m.lab.insul-.08*eq('heater'));
const freezeK=(m,i)=>regOf(m).mech==='freeze'?.025*(1+i)*freezeCut(m):0;
const keptAfterWait=(k,T)=>k>0&&isFinite(T)?(k*T<1e-6?1:(1-Math.exp(-k*T))/(k*T)):1;
/* Ember: shafts heat while digging and stop to cool at 100. Research and equipment can cut heating by at most 45%, so venting keeps its value. */
const heatCut=m=>Math.max(.55,1-.09*m.lab.sinks-.07*eq('coolant'));
const heatRate=(m,s)=>4*(abOn(s,false)?2.5:1)*heatCut(m);
const COOL=9,IDLE_COOL=6,VENT=35;
function heatUptime(m){if(regOf(m).mech!=='heat')return 1;const hr=4*heatCut(m);const on=100/hr,off=100/COOL;return on/(on+off)}
const achCount=()=>Object.keys(S.ach).length;
function value(m,st){let v=resonance('industrialist')*(m.mastered?1.5:1)*(1+.1*m.ingots)*(1+.1*m.lab.grade)*(1+.01*achCount())*(perk('crown')?3:1)*(1+.1*coreStages())*regOf(m).value;
  if(!st){if(S.clock<S.buff.surge)v*=2;if(S.clock<S.buff.lamp)v*=3}return v}
/* steady-state flow of one mine. autoOnly: count only managed stages (idle/offline view). */
/* ore the elevator moves per second. A car that fills before the bottom of its route turns back there, so when the
   shafts above that stop make enough to fill it, its round trip is shorter (and the stops below it get nothing) */
function eRate(m,st,autoOnly){const L=routeList(m);if(!L.length)return 0;const cap=eCap(m),c=cycle(m,st),up=heatUptime(m),s=eSpeed(m,st),T=eRound(m,st);let sup=0;
  for(let j=0;j<L.length;j++){const i=L[j],sh=m.shafts[i],Tj=(2*(i+1)*floorTime(m)+(j+1)*loadTime(m))/s;if(!autoOnly||sh.mgr)sup+=shaftOut(m,i,st)/c*up*keptAfterWait(freezeK(m,i),T);if(sup*Tj>=cap)return cap/Tj}
  return cap/T}
function rates(m,autoOnly,st){
  let sr=0;const c=cycle(m,st),L=routeList(m),up=heatUptime(m),T=eRound(m,st);
  for(const i of L){const s=m.shafts[i];if(!autoOnly||s.mgr)sr+=shaftOut(m,i,st)/c*up*keptAfterWait(freezeK(m,i),T)}
  const er=(!autoOnly||m.E.mgr)&&isFinite(T)?eRate(m,st,autoOnly):0, wr=(!autoOnly||m.W.mgr)?wCap(m,st)/wTrip(m,st):0;
  const ore=Math.min(sr,er,wr),keep=1-m.split*(m.ref>0?1:0);
  return{sr,er,wr,ore,income:ore*value(m,st)*keep,gross:ore*value(m,st),bn:ore===sr?'Shafts':ore===er?'Elevator':'Warehouse'};
}
/* share of dug ore that freezes before the elevator collects it, weighted by each shaft's output */
function freezeLoss(m){if(regOf(m).mech!=='freeze')return 0;const T=eRound(m,true);let tot=0,kept=0;for(const i of routeList(m)){const o=shaftOut(m,i,true);tot+=o;kept+=o*keptAfterWait(freezeK(m,i),T)}return tot?1-kept/tot:0}
const incomeNow=m=>Math.max(1.25,rates(m,false,true).income);
function matRate(m){if(!m.ref)return 0;return .003*m.ref*(1+.15*(m.shafts.length-1))*(1+.25*m.lab.flux)*(1+.15*eq('assay'))*(1+.05*coreStages())}

/* ---------- costs ---------- */
const shaftUpC0=i=>i?100*Math.pow(12,i):40;
const depthPrice=i=>500*Math.pow(50,i-1)*Math.pow(1.3,(i-1)*(i-2)/2);
const unlockCost=(m,i)=>depthPrice(i)*(perk('charts')?.1:1);
const mgrBase=(m,k)=>{if(k==='e')return 120;if(k==='w')return 150;const i=+k.slice(1);return i?unlockCost(m,i)*.5:60};
const mgrCost=(m,k,rank)=>mgrBase(m,k)*RANK_COST[rank]*(perk('hands')?.4:1);
function bulk(c0,r,L,cash,mode){mode=mode||S.buy;const base=c0*Math.pow(r,L-1);let k;
  if(mode==='max'){k=Math.floor(Math.log(cash*(r-1)/base+1)/Math.log(r)+1e-9);if(!(k>=1))k=1}else k=+mode;
  return{k,cost:base*(Math.pow(r,k)-1)/(r-1)}}
function upInfo(m,k,mode){const s=stageOf(m,k);if(k==='e')return bulk(40,R_E,s.lvl,m.cash,mode);if(k==='w')return bulk(50,R_W,s.lvl,m.cash,mode);return bulk(shaftUpC0(+k.slice(1)),R_SHAFT,s.lvl,m.cash,mode)}
const labAt=(m,d)=>2+9*m.lab[d.id]/d.max; // fractional shaft index; the lab itself opens with the third shaft
const labShaft=(m,id)=>Math.floor(labAt(m,LAB.find(x=>x.id===id)))+1; // shafts needed for the next level
const labCost=(m,id)=>{const d=LAB.find(x=>x.id===id);return d.f*depthPrice(labAt(m,d))*(1+.1*m.ingots)*(perk('assay')?.25:1)};
const labReady=(m,id)=>{const d=LAB.find(x=>x.id===id);return!!d&&(!d.only||d.only===regOf(m).mech)&&m.lab[id]<d.max&&m.shafts.length>=labShaft(m,id)};
const refCost=m=>2e4*Math.pow(3,m.ref);
const abDur=()=>45*(perk('vets')?2:1);
const abCd=m=>180*(1-.1*m.lab.oil)*(m.doct==='rush'?.7:1);
const otDur=()=>perk('long')?600:300;
/* Ingots follow what a mine has earned over all its claims (life + this run), and a claim pays the difference.
   So many small claims earn no more than one big one: rebuilding after a claim is cheap, and paying each run on its
   own made claiming every minute or two by far the best play */
const CLAIM_P=.24,ingotsFor=L=>L<CLAIM_MIN?0:Math.floor(4*Math.pow(L/CLAIM_MIN,CLAIM_P)+1e-9);
const claimGain=m=>m.run<CLAIM_MIN?0:Math.max(0,ingotsFor(m.life+m.run)-m.ingots);
const ingotAt=(m,g)=>Math.max(CLAIM_MIN,CLAIM_MIN*Math.pow(Math.max(4,m.ingots+g)/4,1/CLAIM_P)-m.life); // this claim's earnings for +g
const nextIngotAt=m=>ingotAt(m,claimGain(m)+1);
const itemCount=()=>Object.values(S.items).reduce((a,b)=>a+b,0);
function equipCost(id){const d=EQUIP.find(x=>x.id===id),L=S.equip[id]||0,f=Math.pow(1.75,L);const c={};for(const k in d.cost)c[k]=Math.ceil(d.cost[k]*f);return c}
function projCost(id){const d=PROJ.find(x=>x.id===id),n=S.proj[id]||0,f=d.repeat?Math.pow(d.repeat,n):1;const c={};for(const k in d.cost)c[k]=Math.ceil(d.cost[k]*f);return c}
const canPay=c=>Object.keys(c).every(k=>S.mats[k]>=c[k]);
const pay=c=>{for(const k in c)S.mats[k]-=c[k]};
const slotCount=()=>2+PROJ.filter(p=>p.slot&&S.proj[p.id]).length+(coreStages()>=10?1:0);
const eqMax=d=>d.max+(coreStages()>=6?5:0);
const offlineCap=()=>OFFLINE_CAP+(coreStages()>=3?43200:0);
const projDone=id=>{const d=PROJ.find(x=>x.id===id);return !d.repeat&&!!S.proj[id]};

/* ---------- economy ---------- */
function earn(m,x){if(!(x>0))return;m.cash+=x;m.run+=x;S.total+=x;m.rs.earned+=x}
function addMat(m,x){if(!(x>0))return;const k=regOf(m).mat;S.mats[k]+=x;S.st.mats+=x;m.rs.mat+=x;bump('refine',x,m)}
function planElev(m){const s=eSpeed(m,false),f=floorTime(m)/s,l=loadTime(m)/s,L=routeList(m);const stops=[];let t=0,p=0;
  for(const i of L){t+=(i+1-p)*f;p=i+1;stops.push({i,arrive:t,done:t+l});t+=l}
  return{stops,down:t,total:t+p*f,f,deep:p}}
function startElev(m){const E=m.E;E.plan=planElev(m);E.t=0;E.k=0;E.load=0}
function startWh(m){const W=m.W;W.load=Math.min(m.stock,wCap(m,false));m.stock-=W.load;W.T=wTrip(m,false);W.t=0}
function sell(m,load,dur){
  const v=value(m,false),keep=m.ref>0?1-m.split:1,money=load*v*keep;
  earn(m,money);S.st.sold+=load;m.rs.sold+=load;S.st.wTrips++;bump('sell',money,m);
  if(m.ref>0&&m.split>0){const a=m.split*2*matRate(m)*dur;addMat(m,a);if(a>0)emit('mat',{mi:m.i,amount:a})}
  const c=S.ev.cur;if(c&&c.mi===m.i&&c.type==='rush'&&c.accepted){c.prog+=load;if(c.prog>=c.target){earn(m,c.reward);emit('rushDone',{c});endEvent(true)}}
  emit('sell',{mi:m.i,load,money});
}
function stepMine(m,dt){
  const r=regOf(m),cyc=cycle(m,false);
  for(let i=0;i<m.shafts.length;i++){const s=m.shafts[i];
    if(r.mech==='heat'){
      if(s.hot){s.heat-=COOL*dt;if(s.heat<=0){s.heat=0;s.hot=0}}
      else if(s.t>=0||s.mgr){s.heat+=heatRate(m,s)*dt;if(s.heat>=100){s.heat=100;s.hot=1;emit('overheat',{mi:m.i,i})}}
      else s.heat=Math.max(0,s.heat-IDLE_COOL*dt);
    }
    const k=freezeK(m,i);if(k&&s.dep>0){const lost=s.dep*(1-Math.exp(-k*dt));s.dep-=lost;m.rs.lost+=lost}
    if(s.hot)continue;
    if(s.t<0&&s.mgr)s.t=0;
    if(s.t>=0){s.t+=dt;if(s.t>=cyc){let p=shaftOut(m,i,false);const cap=depCap(m,i);
      if(s.dep+p>cap){m.rs.lost+=s.dep+p-cap;p=Math.max(0,cap-s.dep)}
      s.dep+=p;S.st.dug+=p;m.rs.dug+=p;const manual=!s.mgr;s.t=manual?-1:Math.min(s.t-cyc,cyc*.99);
      if(manual){S.st.taps++;bump('dig',1,m)}emit('dig',{mi:m.i,i,p,manual})}}
  }
  const E=m.E;
  if(E.t===-2){unloadElev(m)}
  if(E.t===-1&&E.mgr&&routeList(m).some(i=>m.shafts[i].dep>0))startElev(m);
  if(E.t>=0){E.t+=dt;const P=E.plan,cap=eCap(m);
    while(E.k<P.stops.length&&E.t>=P.stops[E.k].done){const sh=m.shafts[P.stops[E.k].i];if(sh){const take=Math.min(sh.dep,Math.max(0,cap-E.load));sh.dep-=take;E.load+=take}E.k++;
      // a full car heads straight back up from here: the stops below are left for the next trip
      if(E.load>=cap*.999&&E.k<P.stops.length){const st=P.stops[E.k-1];P.stops=P.stops.slice(0,E.k);P.down=st.done;P.deep=st.i+1;P.total=P.down+P.deep*P.f}}
    if(E.t>=P.total){S.st.eTrips++;emit('lift',{mi:m.i,load:E.load});E.t=-2;unloadElev(m)}}
  const W=m.W;
  if(W.t<0&&W.mgr&&m.stock>0)startWh(m);
  if(W.t>=0){W.t+=dt;if(W.t>=W.T){const l=W.load;W.load=0;W.t=-1;if(l>0)sell(m,l,W.T)}}
}
function unloadElev(m){const E=m.E,room=Math.max(0,stockCap(m)-m.stock),put=Math.min(room,E.load);m.stock+=put;E.load-=put;
  if(E.load<=1e-9){E.load=0;E.t=-1;E.wait=0}else E.wait=1}
function step(dt){
  if(!(dt>0))return;
  S.clock+=dt;S.st.played+=dt;
  for(const m of S.mines)if(m.open){m.rs.played+=dt;stepMine(m,dt)}
  tickEvents();
  acc+=dt;if(acc>=.5){acc=0;check()}
}
function elevPos(m){const E=m.E;if(E.t<0||!E.plan)return 0;const P=E.plan;
  if(E.t>=P.down)return Math.max(0,P.deep-(E.t-P.down)/P.f);
  let p=0,t=0;for(const st of P.stops){if(E.t<st.arrive)return p+(E.t-t)/P.f;p=st.i+1;if(E.t<st.done)return p;t=st.done}return p}

/* ---------- player actions (all act on mine index mi, default = current) ---------- */
const M=mi=>S.mines[mi==null?S.cur:mi];
const act={
  dig(i,mi){const m=M(mi),s=m.shafts[i];if(!s||s.mgr||s.t>=0||s.hot)return false;s.t=0;return true},
  vent(i,mi){const m=M(mi),s=m.shafts[i];if(!s||regOf(m).mech!=='heat'||s.heat<=0)return false;s.heat=Math.max(0,s.heat-VENT);if(s.hot&&s.heat<=0)s.hot=0;S.st.vents++;bump('vent',1,m);emit('vent',{mi:m.i,i});return true},
  send(k,mi){const m=M(mi);if(k==='e'){if(m.E.t!==-1||m.E.mgr)return false;if(!routeList(m).length)return'route';startElev(m);return true}
    if(m.W.t>=0||m.W.mgr)return false;if(m.stock<=0)return'empty';startWh(m);return true},
  up(k,mi){const m=M(mi),s=stageOf(m,k);if(!s)return false;const u=upInfo(m,k);if(!(m.cash>=u.cost))return false;m.cash-=u.cost;const old=s.lvl;s.lvl+=u.k;S.st.upgrades+=u.k;
    let mil=0;if(k[0]==='s')for(const x of MIL)if(old<x&&s.lvl>=x)mil++;emit('upgrade',{mi:m.i,k,levels:u.k,mil,lvl:s.lvl});
    const all=k[0]==='s'?allMilCheck(m):0;if(all)emit('allmil',{mi:m.i,got:all,at:MIL[m.allMil-1]});return true},
  hire(k,spec,mi){const m=M(mi),s=stageOf(m,k);if(!s||s.mgr)return false;const c=mgrCost(m,k,1);if(!(m.cash>=c))return false;m.cash-=c;s.mgr=1;s.spec=spec==='p'?'p':'a';S.st.hires++;emit('hire',{mi:m.i,k});return true},
  retrain(k,mi){const m=M(mi),s=stageOf(m,k);if(!s||!s.mgr)return false;const c=mgrCost(m,k,1);if(!(m.cash>=c))return false;m.cash-=c;s.spec=s.spec==='a'?'p':'a';s.ab.until=0;emit('retrain',{mi:m.i,k});return true},
  promote(k,mi){const m=M(mi),s=stageOf(m,k);if(!S.feat.ranks||!s||s.mgr<1||s.mgr>=3)return false;const c=mgrCost(m,k,s.mgr+1);if(!(m.cash>=c))return false;m.cash-=c;s.mgr++;emit('promote',{mi:m.i,k,rank:s.mgr});return true},
  ability(k,mi){const m=M(mi),s=stageOf(m,k);if(!s||!s.mgr||s.spec!=='a'||S.clock<s.ab.ready)return false;s.ab.until=S.clock+abDur();s.ab.ready=S.clock+abCd(m);S.st.abil++;bump('ability',1,m);emit('ability',{mi:m.i,k});return true},
  abilAll(mi){const m=M(mi);let n=0;for(const k of keysOf(m))if(act.ability(k,m.i))n++;return n},
  overtime(){if(!S.feat.overtime||on(S.ot)||S.clock<S.ot.ready)return false;S.ot.until=S.clock+otDur();S.ot.ready=S.ot.until+OT_CD;emit('overtime');return true},
  unlock(mi){const m=M(mi),n=m.shafts.length;if(n>=12)return false;const c=unlockCost(m,n);if(!(m.cash>=c))return false;m.cash-=c;const s=newShaft();
    if(regOf(m).mech==='route')s.route=routeList(m).length<maxStops(m)?1:0;m.shafts.push(s);m.best=Math.max(m.best,m.shafts.length);emit('unlock',{mi:m.i,i:n});if(n===11&&!m.mastered){m.mastered=1;emit('mastered',{mi:m.i})}return true},
  route(i,mi){const m=M(mi),s=m.shafts[i];if(!s||regOf(m).mech!=='route')return false;if(!s.route&&routeList(m).length>=maxStops(m))return'full';s.route=s.route?0:1;return true},
  swapRoute(i,j,mi){const m=M(mi),a=m.shafts[i],b=m.shafts[j];if(!a||!b||regOf(m).mech!=='route'||!a.route||b.route)return false;a.route=0;b.route=1;return true},
  research(id,mi){const m=M(mi);if(!S.feat.lab||!labReady(m,id))return false;const c=labCost(m,id);if(!(m.cash>=c))return false;m.cash-=c;m.lab[id]++;bump('lab',1,m);emit('research',{mi:m.i,id,lvl:m.lab[id]});return true},
  doctrine(id,mi){const m=M(mi);if(!S.feat.lab||m.doct||!DOCT[id])return false;m.doct=id;emit('doctrine',{mi:m.i,id});return true},
  buildRef(mi){const m=M(mi);if(!S.feat.refinery)return false;const c=refCost(m);if(!(m.cash>=c))return false;m.cash-=c;m.ref++;if(m.ref===1&&!m.split)m.split=.25;emit('refinery',{mi:m.i,lvl:m.ref});return true},
  setSplit(v,mi){const m=M(mi);v=+v;if(![0,.1,.25,.5].includes(v))return false;m.split=v;return true},
  useItem(id,mi){const m=M(mi);if(!(S.items[id]>0))return false;S.items[id]--;S.st.items++;bump('item',1,m);let amt=0;
    if(id==='dyn')m.shafts.forEach((s,i)=>{s.dep=Math.min(depCap(m,i),s.dep+shaftOut(m,i,true)*20)});
    else if(id==='coffee')S.buff.coffee=Math.max(S.clock,S.buff.coffee)+120;
    else if(id==='lamp')S.buff.lamp=Math.max(S.clock,S.buff.lamp)+60;
    else if(id==='card'){const r=rates(m,true,true);amt=Math.max(r.income,incomeNow(m)*.25)*300;earn(m,amt)}
    emit('item',{mi:m.i,id,amt});return true},
  claimMission(id){const i=S.missions.findIndex(x=>x.id===id);if(i<0)return false;const ms=S.missions[i];if(!ms.done)return false;const m=S.mines[ms.mi]||cur();
    earn(m,ms.reward.cash);let items=[];if(ms.reward.crate)items=crate(1);
    S.st.missions++;m.rs.missions++;S.mDone++;let bonus=[];if(S.mDone%5===0)bonus=crate(2);
    S.missions.splice(i,1);refill();emit('missionClaim',{m:ms,items,bonus});return{m:ms,items,bonus}},
  swapMission(id){if(S.clock<S.swapReady)return false;const i=S.missions.findIndex(x=>x.id===id);if(i<0||S.missions[i].done)return false;const old=S.missions[i];S.missions.splice(i,1);
    S.missions.splice(i,0,genMission(old.type));S.swapReady=S.clock+300;return true},
  claimDaily(){if(!dailyReady())return false;const y=dayStr(-1);S.daily.streak=S.daily.last===y?S.daily.streak+1:1;S.daily.last=dayStr(0);S.daily.at=Date.now();
    const n=S.daily.streak>=7?3:S.daily.streak>=3?2:1,m=cur();const cash=nice(Math.max(100,incomeNow(m)*300));earn(m,cash);const items=crate(n);emit('daily',{cash,items});return{cash,items}},
  ev(){const c=S.ev.cur;if(!c)return false;const m=S.mines[c.mi];
    if(c.type==='nugget'){earn(m,c.reward);S.st.nuggets++;emit('nugget',{c});endEvent(true);return true}
    if(c.type==='cave'){c.need--;emit('rubble',{c});if(c.need<=0){if(m.shafts[c.shaft])m.shafts[c.shaft].cave=0;earn(m,c.reward);emit('caveClear',{c});endEvent(true)}return true}
    if(c.type==='geode'){c.need--;emit('geodeHit',{c});if(c.need<=0){const items=crate(1);addMat(m,c.mat||0);emit('geode',{c,items});endEvent(true)}return true}
    if(c.type==='rush'&&!c.accepted){c.accepted=true;c.until=S.clock+90;c.dur=90;emit('rushAccept',{c});return true}
    return false},
  evDecline(){const c=S.ev.cur;if(!c||c.type!=='rush'||c.accepted)return false;endEvent(false);return true},
  pickPerk(t,ch){const P=PERKS[t];if(!P||totalIngots()<P.need||S.perkLock[t]||!P[ch])return false;S.perks[t]=ch;S.perkLock[t]=1;emit('perk',{t,ch});return true},
  claim(mi){const m=M(mi),g=claimGain(m);if(g<1)return false;m.life+=m.run;const keep=[m.shafts[0],m.E,m.W].map(s=>s.mgr?s.spec:null);const r=freshRun();for(const k in r)m[k]=r[k];
    [m.shafts[0],m.E,m.W].forEach((s,j)=>{if(keep[j]){s.mgr=1;s.spec=keep[j]}});m.ingots+=g;m.claims++;S.st.claims++;S.perkLock=S.perkLock.map(()=>0);
    if(perk('head')){m.cash=2500;m.shafts.push(newShaft())}
    if(S.ev.cur&&S.ev.cur.mi===m.i)S.ev.cur=null;
    S.missions=S.missions.filter(x=>x.mi!==m.i);refill();emit('claim',{mi:m.i,g});return g},
  collect(){const p=S.pending;if(!p)return null;S.pending=null;p.mines.forEach(r=>{const m=S.mines[r.mi];if(m)earn(m,r.cash)});return p},
  setBuy(x){if(['1','10','max'].includes(x))S.buy=x},
  view(i){const m=S.mines[i];if(!m||!m.open)return false;S.cur=i;emit('view',{mi:i});return true},
  craft(id){const d=EQUIP.find(x=>x.id===id);if(!d||!S.feat.works)return false;if((S.equip[id]||0)>=eqMax(d))return false;const c=equipCost(id);if(!canPay(c))return false;pay(c);S.equip[id]=(S.equip[id]||0)+1;
    if(S.equip[id]===1){const e=S.slots.indexOf(null);if(e>=0)S.slots[e]=id}emit('craft',{id,lvl:S.equip[id]});return true},
  slot(id,idx){if(!S.equip[id])return false;if(idx<0||idx>=S.slots.length)return false;const prev=S.slots.indexOf(id);if(prev>=0)S.slots[prev]=null;S.slots[idx]=id;emit('slot',{id,idx});return true},
  unslot(idx){if(idx<0||idx>=S.slots.length)return false;S.slots[idx]=null;return true},
  project(id){const d=PROJ.find(x=>x.id===id);if(!d||projDone(id))return false;if(totalIngots()<d.ingots)return false;const c=projCost(id);if(!canPay(c))return false;pay(c);S.proj[id]=(S.proj[id]||0)+1;
    if(d.mine!=null){S.mines[d.mine].open=true;S.mines[d.mine].cash=Math.max(S.mines[d.mine].cash,500)}while(S.slots.length<slotCount())S.slots.push(null);emit('project',{id,stage:S.proj[id],mine:d.mine});return true},
};

/* ---------- crates, daily ---------- */
function crate(n){const got=[];for(let i=0;i<n;i++){const k=pickW(ITEM_W);S.items[k]++;got.push(k)}S.st.crates++;return got}
function dayStr(off){const d=new Date();d.setDate(d.getDate()+off);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()}
const dailyReady=()=>S.daily.last!==dayStr(0)&&Date.now()>=(S.daily.at||0); // at: when it was last claimed, so turning the clock back can't hand out another
const offMult=()=>(perk('night')?2:1)*(1+.1*eq('clock'));

/* ---------- missions ---------- */
function mk(m,type,target,extra,secs,crateFlag,fixed){
  return Object.assign({id:++S.mSerial,mi:m.i,type,target,prog:0,done:false,reward:{cash:fixed||nice(Math.max(30,incomeNow(m)*secs)),crate:!!crateFlag}},extra||{})}
const TUT=[
  m=>mk(m,'dig',3,{},0,0,15),m=>mk(m,'sell',20,{},0,0,40),m=>mk(m,'level',5,{shaft:0},0,0,60),
  m=>mk(m,'hire',1,{key:'s0'},0,0,90),m=>mk(m,'hire',1,{key:'e'},0,0,120),m=>mk(m,'unlock',1,{idx:1},0,0,300),
];
function levelTarget(c0,r,L,B,mil){const base=c0*Math.pow(r,L-1);let k=Math.floor(Math.log(B*(r-1)/base+1)/Math.log(r));k=Math.max(3,Math.min(40,k));
  const nm=mil?nextMil(L):null;if(nm&&nm-L<=k*1.6)return nm;return L+k}
function genMission(exclude){
  const m=cur(),inc=incomeNow(m),B=Math.max(inc*360,m.cash*.5,60),reg=regOf(m);
  const have=new Set(S.missions.filter(x=>x.mi===m.i).map(x=>x.type));if(exclude)have.add(exclude);
  const c=[],add=(t,w,f)=>{if(!have.has(t))c.push([f,w])};const n=m.shafts.length;
  add('level',4,()=>{let i=n-1;if(n>1&&R()<.5)i=Math.floor(R()*n);return mk(m,'level',levelTarget(shaftUpC0(i),R_SHAFT,m.shafts[i].lvl,B,1),{shaft:i},60)});
  add('elevLv',2,()=>mk(m,'elevLv',levelTarget(40,R_E,m.E.lvl,B*.6),{},45));
  add('whLv',2,()=>mk(m,'whLv',levelTarget(50,R_W,m.W.lvl,B*.6),{},45));
  add('sell',2,()=>mk(m,'sell',nice(Math.max(50,inc*180)),{},45));
  if(n<12&&unlockCost(m,n)<=B*4)add('unlock',5,()=>mk(m,'unlock',1,{idx:n},120,1));
  const hk=keysOf(m).find(k=>!stageOf(m,k).mgr&&mgrCost(m,k,1)<=B*3);if(hk)add('hire',4,()=>mk(m,'hire',1,{key:hk},60));
  if(S.feat.ranks){const rk=keysOf(m).find(k=>{const s=stageOf(m,k);return s.mgr>=1&&s.mgr<3&&mgrCost(m,k,s.mgr+1)<=B*6});if(rk)add('rank',3,()=>mk(m,'rank',stageOf(m,rk).mgr+1,{key:rk},120,1))}
  if(keysOf(m).some(k=>{const s=stageOf(m,k);return s.mgr&&s.spec==='a'}))add('ability',2,()=>mk(m,'ability',3+Math.floor(R()*4),{},60));
  if(S.feat.events)add('events',2,()=>mk(m,'events',2,{},90,1));
  if(S.feat.lab&&LAB.some(d=>labReady(m,d.id)&&labCost(m,d.id)<=B*5))add('lab',3,()=>mk(m,'lab',1,{},60));
  if(m.ref>0&&m.split>0){const mr=matRate(m)*m.split*2;add('refine',2,()=>mk(m,'refine',Math.max(2,Math.ceil(mr*300)),{},60))}
  if(reg.mech==='heat')add('vent',2,()=>mk(m,'vent',8+Math.floor(R()*8),{},60));
  if(itemCount()>0)add('item',1,()=>mk(m,'item',1,{},30));
  if(!c.length)return mk(m,'sell',nice(Math.max(50,inc*180)),{},45);
  return pickW(c)();
}
function refill(){while(S.missions.length<3)S.missions.push(S.tut<TUT.length&&S.cur===0?TUT[S.tut++](S.mines[0]):genMission())}
function missionProg(x){const m=S.mines[x.mi];if(!m)return 0;switch(x.type){
  case'level':return m.shafts[x.shaft]?m.shafts[x.shaft].lvl:0;
  case'elevLv':return m.E.lvl;case'whLv':return m.W.lvl;
  case'unlock':return m.shafts.length>x.idx?1:0;
  case'hire':{const s=stageOf(m,x.key);return s&&s.mgr>=1?1:0}
  case'rank':{const s=stageOf(m,x.key);return s?s.mgr:0}
  default:return x.prog}}
function missionText(x){const m=S.mines[x.mi],o=i=>regOf(m).ores[i][0];switch(x.type){
  case'dig':return`Dig by hand ${x.target} times (tap a shaft’s bar)`;
  case'sell':return`Sell ${money(x.target)} worth of ore`;
  case'level':return`Raise the ${o(x.shaft)} shaft to Lv ${x.target}`;
  case'elevLv':return`Raise the elevator to Lv ${x.target}`;
  case'whLv':return`Raise the warehouse to Lv ${x.target}`;
  case'unlock':return`Open the ${o(x.idx)} shaft`;
  case'hire':return`Hire a manager for the ${keyName(m,x.key)}`;
  case'rank':return`Promote the ${keyName(m,x.key)} manager to ${RANK_NAME[x.target]}`;
  case'ability':return`Use manager abilities ${x.target} times`;
  case'events':return`Handle ${x.target} mine events`;
  case'lab':return'Complete a research project in the lab';
  case'refine':return`Refine ${num(x.target)} ${MATS[regOf(m).mat].short.toLowerCase()}`;
  case'vent':return`Vent hot shafts ${x.target} times`;
  case'item':return'Use a supply item';}}
function bump(type,amt,m){for(const x of S.missions)if(x.type===type&&!x.done&&(!m||x.mi===m.i))x.prog+=amt}

/* ---------- events (only in the mine being watched) ---------- */
const EVW=[['nugget',35],['cave',20],['surge',18],['rush',17],['geode',10]];
const charm=()=>1+.15*eq('charm');
function spawnEvent(){const m=cur(),n=m.shafts.length,type=pickW(EVW),c={type,mi:m.i,start:S.clock};
  if(type==='nugget'){c.shaft=Math.floor(R()*n);c.until=S.clock+20;c.reward=nice(Math.max(30,incomeNow(m)*60*(perk('keen')?3:1)*charm()))}
  else if(type==='cave'){c.shaft=Math.floor(R()*n);c.need=4;c.until=S.clock+45;m.shafts[c.shaft].cave=1;c.reward=nice(Math.max(20,incomeNow(m)*30*charm()))}
  else if(type==='surge'){c.until=S.clock+60;S.buff.surge=c.until}
  else if(type==='rush'){c.target=nice(Math.max(30,rates(m,false,true).ore*75));c.until=S.clock+20;c.accepted=false;c.prog=0;c.reward=nice(Math.max(100,incomeNow(m)*120*charm()))}
  else{c.need=6;c.until=S.clock+30;c.mat=m.ref?Math.ceil(matRate(m)*600):0}
  c.dur=c.until-S.clock;S.ev.cur=c;emit('event',{c});
  if(type==='surge'){S.st.events++;m.rs.events++;bump('events',1,m)}}
function endEvent(handled){const c=S.ev.cur;if(!c)return;const m=S.mines[c.mi];
  if(handled&&c.type!=='surge'){S.st.events++;m.rs.events++;bump('events',1,m)}
  if(c.type==='cave'&&m.shafts[c.shaft])m.shafts[c.shaft].cave=0;
  S.ev.cur=null;S.ev.next=S.clock+(180+R()*180)*(perk('keen')?.5:1)*Math.pow(.92,eq('charm'));emit('eventEnd',{c,handled})}
function tickEvents(){if(!S.feat.events)return;const c=S.ev.cur;if(!c){if(S.clock>=S.ev.next&&cur().shafts.length>=2)spawnEvent();return}if(S.clock>=c.until)endEvent(false)}

/* ---------- progress checks ---------- */
function check(){
  for(const [id,cond,name,desc] of FEATS)if(!S.feat[id]&&cond(S)){S.feat[id]=1;if(id==='events')S.ev.next=S.clock+40;emit('feature',{id,name,desc})}
  if(!S.feat.works&&(S.mats.bars>0||S.feat.refinery&&totalIngots()>=4)){S.feat.works=1;emit('feature',{id:'works',name:'Works',desc:'Spend refined materials on mine surveys and equipment in the Works tab.'})}
  for(const x of S.missions)if(!x.done&&missionProg(x)>=x.target){x.done=true;emit('missionDone',{m:x})}
  for(const a of ACH)if(!S.ach[a.id]&&a.val()>=a.target){S.ach[a.id]=1;emit('ach',{a})}
  let tot=0;for(const m of S.mines)if(m.open){const inc=rates(m,false,true).income;tot+=inc;if(inc>m.rs.peak)m.rs.peak=inc}
  if(tot>S.st.bestRate)S.st.bestRate=tot;
}

/* ---------- offline / away ----------
   Away time is simulated with each mine's steady flow using only managed stages. Timed boosts
   (overtime, coffee, lucky lamp, price surge, manager abilities) count only for the part of the
   absence they were still running: the window is split at every boost expiry. */
function offline(secs){
  if(!(secs>0))return null;secs=Math.min(secs,offlineCap());
  if(S.ev.cur){const c=S.ev.cur,m=S.mines[c.mi];if(c.type==='cave'&&m&&m.shafts[c.shaft])m.shafts[c.shaft].cave=0;S.ev.cur=null}
  const t0=S.clock,t1=t0+secs,cuts=new Set([t0,t1]);
  const addCut=u=>{if(u>t0&&u<t1)cuts.add(u)};
  addCut(S.ot.until);addCut(S.buff.coffee);addCut(S.buff.lamp);addCut(S.buff.surge);
  for(const m of S.mines)if(m.open)for(const k of keysOf(m))addCut(stageOf(m,k).ab.until);
  const pts=[...cuts].sort((a,b)=>a-b),mult=secs>=300?offMult():1; // the night-shift bonuses are for real time away, not a quick hop to another mode
  const out=S.mines.filter(m=>m.open).map(m=>({mi:m.i,cash:0,ore:0,mat:0}));
  for(let j=0;j<pts.length-1;j++){const a=pts[j],b=pts[j+1],d=b-a;S.clock=a+1e-6;
    for(const o of out){const m=S.mines[o.mi],r=rates(m,true,false);o.ore+=r.ore*d;o.cash+=r.income*d*mult;
      if(m.ref>0&&m.split>0&&m.W.mgr&&r.ore>0)o.mat+=m.split*2*matRate(m)*d}}
  S.clock=t1;
  if(secs>=60)for(const m of S.mines)if(m.open)for(const s of m.shafts){s.heat=0;s.hot=0}
  for(const o of out){const m=S.mines[o.mi];if(o.mat>0)addMat(m,o.mat);S.st.dug+=o.ore;S.st.sold+=o.ore;m.rs.dug+=o.ore;m.rs.sold+=o.ore}
  S.ev.next=Math.max(S.ev.next,S.clock+30+R()*60);
  const res={secs,mines:out.filter(o=>o.cash>0||o.mat>0)};
  if(res.mines.length){if(S.pending){for(const o of res.mines){const p=S.pending.mines.find(x=>x.mi===o.mi);if(p){p.cash+=o.cash;p.ore+=o.ore;p.mat+=o.mat}else S.pending.mines.push(o)}S.pending.secs+=secs}else S.pending=res}
  return res}
/* wall-clock bookkeeping: returns seconds that should be credited since `last`, defending
   against a clock moved backwards, invalid timestamps and absurd future dates */
function awaySeconds(last,now){if(!isFinite(last)||last<=0||last>now+864e5)return 0;const d=(now-last)/1000;return d>0?d:0}

/* ---------- save / load ---------- */
function merge(def,obj){if(obj===undefined||obj===null)return def;if(typeof def!=='object'||def===null||Array.isArray(def))return typeof obj===typeof def||def===null?obj:def;if(typeof obj!=='object')return def;
  const out={};for(const k in def)out[k]=merge(def[k],obj[k]);for(const k in obj)if(!(k in out))out[k]=obj[k];return out}
function clean(o){for(const k in o){const v=o[k];if(typeof v==='number'){if(!isFinite(v))o[k]=0}else if(v&&typeof v==='object')clean(v)}}
/* loadInfo.fresh is true when a save was given but could not be used, so the caller can keep a copy of it */
const loadInfo={fresh:false,reason:''};
function load(o){
  let n;loadInfo.fresh=false;loadInfo.reason='';
  if(!o||typeof o!=='object'){n=fresh();if(o!=null){loadInfo.fresh=true;loadInfo.reason='unreadable'}}
  else if(o.v===3&&Array.isArray(o.mines)){n=merge(fresh(),o);n.mines=REGIONS.map((_,i)=>{const src=o.mines[i]||{},m=merge(newMine(i),src);
      m.i=i;m.shafts=(Array.isArray(src.shafts)&&src.shafts.length?src.shafts:[{}]).slice(0,12).map(s=>merge(newShaft(),s));
      m.E=merge(newMine(i).E,src.E||{});m.W=merge(newMine(i).W,src.W||{});return m});
    n.slots=Array.isArray(o.slots)?o.slots.slice(0,6):[null,null];}
  else{n=fresh();loadInfo.fresh=true;loadInfo.reason='unknown version'}
  clean(n);n.v=3;n.mines[0].open=true;if(!n.mines[n.cur]||!n.mines[n.cur].open)n.cur=0;
  for(const m of n.mines){if(!(m.life>0))m.life=m.ingots>0?CLAIM_MIN*Math.pow(m.ingots/4,1/CLAIM_P):0;for(const d of LAB)m.lab[d.id]=Math.max(0,Math.min(d.max,m.lab[d.id]|0));if(m.cash<0)m.cash=0;if(m.E.t!==-1&&!(m.E.plan&&m.E.plan.stops)){m.E.t=-1;m.E.load=0}}
  S=n;while(S.slots.length<slotCount())S.slots.push(null);S.slots=S.slots.slice(0,slotCount());
  for(const m of S.mines)if(regOf(m).mech==='route'){const on=routeList(m);if(on.length>maxStops(m))on.slice(0,on.length-maxStops(m)).forEach(i=>m.shafts[i].route=0)}
  S.missions=(S.missions||[]).filter(x=>x&&x.type&&S.mines[x.mi]&&S.mines[x.mi].open);refill();return S}
/* ---------- upgrade value: income gained by one more level ---------- */
function upgradeGain(m,k){const s=stageOf(m,k),before=rates(m,false,true).income;s.lvl++;const after=rates(m,false,true).income;s.lvl--;return before>0?after/before-1:0}
function bestShaftUpgrade(m){let best=null;for(const i of routeList(m)){const k='s'+i,c=upInfo(m,k,'1').cost,g=upgradeGain(m,k);if(g>0&&(!best||g/c>best.g/best.c))best={k,c,g}}return best}

const serialize=()=>JSON.stringify(S);

/* ---------- formatting: whole numbers below a thousand, then the app's fmt(); money is dollars ---------- */
const num=n=>n<1e3?(n<10&&n%1>.05?(Math.floor(n*10)/10).toFixed(1):String(Math.floor(n+1e-9))):fmt(n);
const money=n=>'$'+num(n);
function nice(x){if(x<100)return Math.ceil(x);const p=Math.pow(10,Math.floor(Math.log10(x))-1);return Math.ceil(x/p)*p}
function pickW(list){let t=0;for(const x of list)t+=x[1];let r=R()*t;for(const x of list){r-=x[1];if(r<=0)return x[0]}return list[list.length-1][0]}

api.rng=Math.random;
Object.assign(api,{REGIONS,MATS,MIL,LAB,PERKS,ACH,ITEMS,SPEC,DOCT,EQUIP,PROJ,RANK_NAME,RANK_S,RANK_EW,CLAIM_MIN,act,step,offline,awaySeconds,load,
  fresh:()=>{S=fresh();refill();return S},serialize,state:()=>S,on:f=>subs.push(f),money,nice,
  cur,regOf,rates,value,stageOf,keyName,keysOf,upInfo,mgrCost,unlockCost,labCost,labReady,labShaft,refCost,claimGain,nextIngotAt,ingotAt,eCap,wCap,wTrip,eRound,cycle,shaftOut,eRate,
  nextMil,allWeakest,elevPos,abDur,abCd,otDur,isOn:o=>on(o),missionProg,missionText,dailyReady,offMult,itemCount,perk,incomeNow,achCount,stockCap,depCap,maxStops,routeList,
  upgradeGain,bestShaftUpgrade,loadInfo,  freezeK,freezeLoss,heatUptime,heatCut,freezeCut,matRate,equipCost,projCost,canPay,slotCount,eqMax,offlineCap,projDone,totalIngots,eq,clock:()=>S.clock});
return api;
})();
if(typeof module!=='undefined')module.exports=IndLogic;

// ===== Industrialist: four mines of twelve shafts, managers, claims and gold ingots =====
// The rules live in IndLogic above. This module draws them and connects them to the app through the object
// it returns at the bottom (see MODE INTERFACE in the app section), so changing it can't affect the other modes.
const Industrialist = (() => {
  const G = IndLogic;
  let S = G.fresh();
  const MI = () => S.mines[S.cur];
  // numbers as this game shows them: whole below a thousand (one decimal below ten when there's a fraction), then the app's short form
  const num = (n) => (n < 1e3 ? (n < 10 && n % 1 > 0.05 ? (Math.floor(n * 10) / 10).toFixed(1) : String(Math.floor(n + 1e-9))) : fmt(n));
  const usd = (n) => '$' + num(n);
  const mmss = (s) => {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const matOf = (m) => G.MATS[G.regOf(m).mat];
  const openMines = () => S.mines.filter((m) => m.open);
  const multi = () => openMines().length > 1;
  const CASH_COLOR = '#d9b27a';
  const here = () => typeof mode !== 'undefined' && mode === Industrialist; // the app has this mode open

  // ===== Tabs (in tab-bar order; swiping moves through them in this order) =====
  const TABS = [
    { key: 'mine', name: 'Mine', icon: 'headframe', color: '#d9b27a', desc: 'Dig, lift and sell. The slowest stage sets your income.' },
    { key: 'missions', name: 'Missions', icon: 'clipboard', color: '#c9a088', desc: 'Short jobs for cash and supply crates, and the daily drop.' },
    { key: 'lab', name: 'Lab', icon: 'flask', color: '#93c4bd', desc: 'This mine’s doctrine and research. Both reset with each claim.' },
    { key: 'works', name: 'Works', icon: 'anvil', color: '#a9b4bd', desc: 'Spend refined materials on new mines and equipment.' },
    { key: 'opus', name: 'Guild', icon: 'landmark', color: '#d9a6b1', desc: 'Stake new claims for gold ingots, pick perks, see your records.' },
  ];

  // ===== Tutorial (the first two pages on the first visit; the whole guide from Settings) =====
  const TUTORIAL = [
    ['Welcome to Industrialist', "<p>Run a mining company from one hillside shaft to four mines, each with twelve shafts and its own rules. Your mines keep running while you're away.</p><p>Move between tabs with the bar at the bottom, or swipe left and right anywhere below the top boxes.</p><p>Industrialist is one of the three modes of <b>Deepforge</b>. The button at the far right of the tab bar switches to the next one, <b>Capitalist</b>. Each mode is a separate game with its own progress, and each keeps producing while you play another.</p>"],
    ['The production chain', '<p>Tap a <b>shaft</b>’s bar to dig ore into its deposit. Tap the <b>elevator</b> to bring the ore up to the stockpile, and the <b>warehouse</b> to haul it to market.</p><p>Income is set by the slowest of the three: the strip at the top of the Mine tab shows which one is holding you back. <b>Hire a manager</b> for a stage and it runs on its own, offline too.</p>'],
    ['Managers', '<p>Each manager is <b>active</b> (an ability you tap for a burst) or <b>passive</b> (a smaller bonus that always works, offline included). Once a mine has four shafts, tap a manager’s stars to promote them to Senior or Chief. You can retrain them later.</p><p>Shaft levels 10, 25, 50, 100 and up double that shaft’s output.</p>'],
    ['Lab and refinery', '<p>With three shafts open, each mine gets a <b>lab</b>: pick a doctrine and research boosts. Both reset with each new claim.</p><p>The <b>refinery</b> on the warehouse turns a share of your ore into materials. Materials pay for new mines and equipment in the <b>Works</b> tab.</p>'],
    ['Claims and ingots', '<p>Once a mine has earned $10M in one claim, stake a <b>new claim</b> on the Guild tab. The mine starts over, keeps the managers of its first shaft, elevator and warehouse, and pays <b>gold ingots</b> that raise its ore price for good.</p><p>Ingots across all your mines unlock <b>charter perks</b>, and Works projects need them to open new mines.</p>'],
    ['Missions and events', '<p><b>Missions</b> pay cash and supply crates; the supply drop is free once a day. <b>Events</b> turn up in the mine on screen: grab nuggets, clear cave-ins, crack geodes and fill rush orders.</p><p>Your game saves automatically. Use <b>Export</b> in Settings, at the bottom of the Guild tab, now and then to keep a backup code.</p>'],
  ];

  // ===== The Mines tab view: built once, updated in place =====
  let rows = [], shownMine = -1, rowH = 0, animOn = false;
  const R = {};
  const q = (sel) => $('indMine').querySelector(sel);
  const stageBtns = (k) =>
    `<div class="im-btns"><button class="ib" data-a="up" data-i="${k}"><span></span><small></small></button><button class="ib" data-a="mgrbtn" data-i="${k}"><span></span><small></small></button></div>`;
  function buildUI() {
    $('indMine').innerHTML =
      `<button class="im-reg" id="im-reg" data-a="iregmore" data-i="0" hidden></button>` +
      `<div class="im-flow"><div class="fs" id="imf-s"><span>Shafts</span><b></b><i><u></u></i></div><em>›</em>` +
      `<div class="fs" id="imf-e"><span>Elevator</span><b></b><i><u></u></i></div><em>›</em>` +
      `<div class="fs" id="imf-w"><span>Warehouse</span><b></b><i><u></u></i></div></div>` +
      `<p class="im-idle" id="im-idle"></p>` +
      `<div class="im-tools"><div class="modes" id="im-buy">${['1', '10', 'max'].map((x) => `<button data-a="ibuy" data-i="${x}">${x === 'max' ? 'Max' : '×' + x}</button>`).join('')}</div>` +
      `<button class="im-pill" id="im-ot" data-a="overtime" data-i="0" hidden></button><button class="im-pill" id="im-ab" data-a="abilAll" data-i="0" hidden></button></div>` +
      `<div class="im-sup" id="im-sup" hidden></div>` +
      // the mine: the elevator shaft runs down the left. At the top, the elevator's own row (level, manager, capacity,
      // load, upgrades), then the warehouse, which the car docks beside to unload; the shafts line up right below
      `<section class="im-mine" id="im-mine"><div class="im-track" id="im-track"><div class="im-cable" id="im-cable"></div><div class="im-car" id="im-car" data-a="send" data-i="e"><div class="bar px up" data-a="send" data-i="e" style="--c:#a6825c"><i id="im-load"></i></div></div></div>` +
      `<div class="im-top" id="im-top">` +
      `<div class="im-erow" id="im-e"><div class="im-line"><span class="im-nm">Elevator</span><button class="im-chip" data-a="mgr" data-i="e" hidden></button><span class="im-lv"></span><span class="im-info" id="im-einfo"></span></div>` +
      `<div class="bar im-bar px im-send" data-a="send" data-i="e" style="--c:#a6825c"><i></i><span></span><b></b></div>${stageBtns('e')}</div>` +
      `<section class="im-wh" id="im-wh"><div class="im-line"><span class="im-nm">Warehouse</span><button class="im-chip" data-a="mgr" data-i="w" hidden></button><span class="im-lv"></span><span class="im-info" id="im-winfo"></span></div>` +
      `<div class="im-line"><span class="im-lab">Stockpile</span><span class="im-dep" id="im-stock"></span></div><div class="im-meter" id="im-meter"><i></i></div>` +
      `<div class="im-barwrap"><div class="bar im-bar px move" data-a="send" data-i="w" style="--c:${CASH_COLOR}"><i></i><span></span></div></div>${stageBtns('w')}` +
      `<div class="im-ref" id="im-ref" hidden></div><button class="im-geode" id="im-geode" data-a="ev" data-i="0" hidden></button></section>` +
      `</div>` +
      `<div id="im-shafts"></div><div class="im-unlock"><button class="big buy" id="im-unl" data-a="unlock" data-i="0"></button></div></section>` +
      `<details class="fold" data-fold="ind-guide"><summary data-a="fold" data-i="ind-guide">Field guide</summary>` +
      `<p>Shafts dig ore into their deposits. The elevator loads the deposits from the top down and brings the ore up to the stockpile, and the warehouse hauls the stockpile to market. Income is set by the slowest of the three, shown in the strip at the top.</p>` +
      `<p>If the stockpile is full, the elevator waits at the top until the warehouse makes room. Tap a stage’s bar to run it once by hand; a manager runs it on its own, offline too.</p>` +
      `<p>Shaft levels 10, 25, 50, 100, 150, 200, 300, 400 and 500 double that shaft’s output. When every shaft in a mine (at least the first three) reaches one of those levels, all its shafts dig ×2 for the rest of the claim. Every mine keeps running while you watch another; events only happen in the mine on screen.</p></details>`;
    const stageRefs = (key, root) => ({ key, root, chip: root.querySelector('.im-chip'), lv: root.querySelector('.im-lv'), bar: root.querySelector('.im-bar'), fill: root.querySelector('.im-bar > i'), txt: root.querySelector('.im-bar > span'), up: root.querySelector('[data-a="up"]'), mb: root.querySelector('[data-a="mgrbtn"]') });
    R.e = stageRefs('e', q('#im-e'));
    R.e.txt = q('.im-send > span');
    R.e.val = q('.im-send > b');
    R.e.fill = q('.im-send > i');
    R.w = stageRefs('w', q('#im-wh'));
    for (const id of ['im-reg', 'im-idle', 'im-buy', 'im-ot', 'im-ab', 'im-sup', 'im-wh', 'im-winfo', 'im-stock', 'im-meter', 'im-ref', 'im-geode', 'im-track', 'im-cable', 'im-car', 'im-load', 'im-einfo', 'im-shafts', 'im-unl', 'im-top']) R[id] = q('#' + id);
    // a sheet for choices that need more room than a button: hiring, a manager's details, crates
    const sh = document.createElement('div');
    sh.id = 'indSheet';
    sh.hidden = true;
    sh.innerHTML = `<div class="sh-bg" data-a="sheetX" data-i="0"></div><div class="sh-c" role="dialog" aria-modal="true"><h3 id="sh-t"></h3><div id="sh-b"></div><button class="sh-x" data-a="sheetX" data-i="0">Close</button></div>`;
    document.body.appendChild(sh);
  }
  const refsOf = (k) => (k === 'e' ? R.e : k === 'w' ? R.w : rows[+k.slice(1)]);
  function renderShafts() {
    const m = MI(), reg = G.regOf(m), mech = reg.mech;
    R['im-shafts'].innerHTML = m.shafts
      .map((s, i) => {
        const [name, col] = reg.ores[i];
        return (
          `<div class="im-row" style="--d:${(i / 11).toFixed(3)};--c:${col}"><div class="im-line"><span class="im-nm">${name}</span><span class="im-depth">${(i + 1) * reg.depth} m</span>` +
          (mech === 'route' ? `<button class="im-route" data-a="route" data-i="${i}"></button>` : '') +
          `<button class="im-chip" data-a="mgr" data-i="s${i}" hidden></button><span class="im-lv"></span><span class="im-dep"><i style="background:${col}"></i><span></span></span></div>` +
          `<div class="im-barwrap"><div class="bar im-bar px dig" data-a="dig" data-i="${i}"><i></i><span></span>${mech === 'heat' ? '<em></em>' : ''}</div>` +
          (mech === 'heat' ? `<button class="im-vent" data-a="vent" data-i="${i}" hidden>Vent</button>` : '') +
          `<button class="im-rubble" data-a="ev" data-i="0" hidden></button><button class="im-nug" data-a="ev" data-i="0" hidden>Grab nugget</button></div>${stageBtns('s' + i)}</div>`
        );
      })
      .join('');
    rows = [...R['im-shafts'].children].map((el, i) => ({
      key: 's' + i, root: el, chip: el.querySelector('.im-chip'), lv: el.querySelector('.im-lv'), bar: el.querySelector('.im-bar'), fill: el.querySelector('.im-bar > i'), txt: el.querySelector('.im-bar > span'),
      up: el.querySelector('[data-a="up"]'), mb: el.querySelector('[data-a="mgrbtn"]'), dep: el.querySelector('.im-dep > span'), depBox: el.querySelector('.im-dep'),
      rubble: el.querySelector('.im-rubble'), nug: el.querySelector('.im-nug'), heat: el.querySelector('.im-bar > em'), vent: el.querySelector('.im-vent'), route: el.querySelector('.im-route'),
    }));
    if (shownMine !== S.cur) Polish.restart(q('#im-mine'), 'reveal');
    shownMine = S.cur;
    rowH = 0;
  }
  function setBtn(b, label, sub, cls) {
    setText(b.children[0], label);
    setText(b.children[1], sub);
    if (b.className !== cls) b.className = cls;
  }
  function updStage(m, r, bn) {
    const k = r.key, s = G.stageOf(m, k), u = G.upInfo(m, k), now = G.clock();
    setBtn(r.up, `+${u.k} Lv`, usd(u.cost), 'ib' + (m.cash >= u.cost ? ' can' : ' dis') + (bn ? ' bn' : ''));
    setText(r.lv, 'Lv ' + s.lvl);
    if (!s.mgr) {
      const c = G.mgrCost(m, k, 1);
      setBtn(r.mb, 'Hire', usd(c), 'ib hire' + (m.cash >= c ? ' can' : ''));
      r.chip.hidden = true;
    } else {
      if (s.spec === 'a') {
        const a = s.ab, on = now < a.until, cd = a.ready - now;
        setBtn(r.mb, G.SPEC[k[0]].a.abil, on ? mmss(a.until - now) : cd > 0 ? mmss(cd) : 'Ready', 'ib abil' + (on ? ' live' : cd <= 0 ? ' can' : ''));
      } else setBtn(r.mb, 'Passive', '+' + Math.round((m.doct === 'steady' ? 1.6 : 1.4) * 100 - 100) + '%', 'ib pass');
      r.chip.hidden = false;
      setText(r.chip, '★'.repeat(s.mgr));
      const promo = S.feat.ranks && s.mgr < 3 && m.cash >= G.mgrCost(m, k, s.mgr + 1), cls = 'im-chip' + (s.spec === 'p' ? ' p' : '') + (promo ? ' promo' : '');
      if (r.chip.className !== cls) r.chip.className = cls;
    }
    r.root.classList.toggle('boosted', !!(s.mgr && s.spec === 'a' && G.isOn(s.ab)) || (k[0] === 's' && G.isOn(S.ot)));
  }
  function updMine() {
    const m = MI(), reg = G.regOf(m), E = m.E, W = m.W, now = G.clock(), r = G.rates(m, false, false);
    if (shownMine !== S.cur || rows.length !== m.shafts.length) renderShafts();
    // the flow strip: the slowest stage sets the income
    const mx = Math.max(r.sr, r.er, r.wr, 1e-9);
    [['imf-s', r.sr, 'Shafts'], ['imf-e', r.er, 'Elevator'], ['imf-w', r.wr, 'Warehouse']].forEach(([id, v, n]) => {
      const el = q('#' + id);
      el.classList.toggle('bn', r.bn === n);
      setText(el.children[1], num(v) + '/s');
      fillTo(el.children[2].firstChild, Math.max(3, (v / mx) * 100));
    });
    const idle = G.rates(m, true, true);
    // one line: what ore sells for, offline income, and (once three shafts are sunk) the next every-shaft milestone
    const wk = G.allWeakest(m), goal = G.MIL[m.allMil];
    const every = m.shafts.length < 3 ? '' : goal ? ` · <b>all shafts ×2</b> at Lv ${goal} <i>(${reg.ores[wk.i][0]} ${wk.lvl})</i>` : ` · every shaft milestone: <b>×${num(2 ** m.allMil)}</b>`;
    setHTML(R['im-idle'], `Ore ${usd(G.value(m, false))} each · offline ${usd(idle.income * G.offMult())}/s` + (m.ref && m.split ? ` · ${Math.round(m.split * 100)}% refined` : '') + every);
    const sb = r.bn === 'Shafts' ? G.bestShaftUpgrade(m) : null, tagKey = r.bn === 'Shafts' ? sb && sb.k : r.bn === 'Elevator' ? 'e' : 'w';
    // the mine's own rule: one live line, tap for the explanation
    const rn = R['im-reg'];
    rn.hidden = !reg.mech;
    if (reg.mech) {
      let h = '', more = '';
      if (reg.mech === 'freeze') (h = icon('snowflake', 16) + `<span><b>${Math.round(G.freezeLoss(m) * 100)}% of dug ore is freezing</b> before the elevator collects it.`), (more = 'Deeper deposits freeze faster. A faster elevator, Express run, Insulated deposits and Heater coils all cut the loss; research and equipment can at most halve it.');
      if (reg.mech === 'heat') {
        const hot = m.shafts.filter((s) => s.hot).length;
        h = icon('flame', 16) + `<span><b>${hot ? hot + ' shaft' + (hot > 1 ? 's' : '') + ' cooling down' : 'Shafts run ' + Math.round(G.heatUptime(m) * 100) + '% of the time'}</b> when left alone.`;
        more = 'Shafts overheat at 100° and stop to cool. Tap Vent to cool one by hand. Rich vein heats a shaft 2.5× faster.';
      }
      if (reg.mech === 'route') (h = icon('route', 16) + `<span><b>Route: ${G.routeList(m).length} of ${G.maxStops(m)} stops used</b> by the pressure elevator.`), (more = 'Each stop takes a slow pressure lock. Shafts off the route fill their deposit and stop. Tap a shaft’s route tag to change it.');
      setHTML(rn, h + (S.ui.regOpen ? `<i>${more}</i></span>` : '</span>'));
      rn.className = 'im-reg ' + reg.mech;
    }
    updStage(m, R.w, tagKey === 'w');
    updStage(m, R.e, tagKey === 'e');
    setText(R['im-winfo'], `${num(G.wCap(m, false))} per ${G.wTrip(m, false).toFixed(1)}s`);
    const sc = G.stockCap(m), full = m.stock >= sc * 0.98;
    setText(R['im-stock'], `${num(m.stock)} / ${num(sc)} ore`);
    R['im-stock'].classList.toggle('full', full);
    fillTo(R['im-meter'].firstChild, (m.stock / sc) * 100);
    R['im-meter'].classList.toggle('full', full);
    setText(R.w.txt, W.t >= 0 ? `Hauling ${num(W.load)} ore · ${usd(W.load * G.value(m, false) * (m.ref ? 1 - m.split : 1))}` : W.mgr ? 'Waiting for ore' : m.stock > 0 ? 'Tap to haul ore to market' : 'Stockpile empty');
    setText(R['im-einfo'], `${num(G.eCap(m))} per ${G.eRound(m, false).toFixed(1)}s trip`);
    // what the car is doing on the left (it gives way first on a narrow screen), the load on the right (always whole)
    setText(R.e.txt, E.wait ? 'Stockpile full' : E.t >= 0 ? (E.load >= G.eCap(m) * 0.999 ? 'Full, heading up' : 'In the shaft') : E.mgr ? 'Waiting for ore' : 'Tap to send the cage down');
    setText(R.e.val, E.wait ? `${num(E.load)} on board` : E.t >= 0 ? `${num(E.load)} / ${num(G.eCap(m))}` : '');
    R.e.txt.parentNode.classList.toggle('can', E.t < 0 && !E.mgr);
    fillTo(R.e.fill, (E.load / G.eCap(m)) * 100, E.t >= 0 && E.load > 0); // the load against the true capacity, like the car
    R.e.root.classList.toggle('blocked', !!E.wait);
    R['im-wh'].classList.toggle('surge', now < S.buff.surge || now < S.buff.lamp);
    // the refinery, folded once it's built
    const rb = R['im-ref'];
    rb.hidden = !S.feat.refinery;
    if (S.feat.refinery) {
      const c = G.refCost(m), mk = matOf(m), open = !m.ref || !!S.ui.open_ref;
      setPane(
        rb,
        `<button class="im-sum" data-a="itoggle" data-i="ref"><span>Refinery</span><small>${live(m.ref ? `Lv ${m.ref} · ${num(G.matRate(m) * m.split * 2 * 3600)} ${mk.short.toLowerCase()} per hour` : `Makes ${mk.name.toLowerCase()}`)}</small><i>${open ? '−' : '+'}</i></button>` +
          (open
            ? `<small class="im-lab">Share of ore sent to the refinery instead of market</small><div class="modes">${[0, 0.1, 0.25, 0.5].map((v) => `<button class="${m.split === v ? 'on' : ''}${m.ref ? '' : ' dis'}" data-a="split" data-i="${v}">${v * 100}%</button>`).join('')}</div>` +
              `<button class="ib wide${m.cash >= c ? ' can' : ' dis'}" data-a="ref" data-i="0"><span>${m.ref ? `Upgrade the refinery to Lv ${m.ref + 1}` : 'Build the refinery'}</span><small>${live(usd(c))}</small></button>`
            : ''),
      );
    }
    const ev = S.ev.cur && S.ev.cur.mi === S.cur ? S.ev.cur : null;
    m.shafts.forEach((s, i) => {
      const rr = rows[i];
      if (!rr) return;
      updStage(m, rr, tagKey === 's' + i);
      const capD = G.depCap(m, i), isFull = isFinite(capD) && s.dep >= capD * 0.98;
      setText(rr.dep, num(s.dep)); // a full deposit turns amber and its bar says so: no word needed here
      rr.depBox.className = 'im-dep' + (isFull ? ' full' : reg.mech === 'freeze' && s.dep > 0 ? ' cold' : '');
      const nm = G.nextMil(s.lvl), cs = G.cycle(m, false);
      let t = s.hot ? 'Overheated, cooling' : (s.mgr || s.t >= 0 ? 'Digging ' : 'Tap to dig ') + '+' + num(G.shaftOut(m, i, false)) + ' / ' + cs.toFixed(1) + 's' + (nm ? ` · ×${G.perk('lode') ? 2.5 : 2} at Lv ${nm}` : '');
      if (isFull) t = s.route ? 'Deposit full: the elevator can’t keep up' : 'Deposit full: put it on the route';
      setText(rr.txt, t);
      rr.root.classList.toggle('blocked', !!(s.hot || isFull));
      if (rr.heat) {
        fillTo(rr.heat, s.heat);
        rr.vent.hidden = s.heat < 20;
        rr.vent.classList.toggle('urgent', s.heat >= 80);
      }
      if (rr.route) {
        setText(rr.route, s.route ? 'On route' : 'Off route');
        rr.route.classList.toggle('on', !!s.route);
        rr.root.classList.toggle('off', !s.route);
      }
      const cave = ev && ev.type === 'cave' && ev.shaft === i, nug = ev && ev.type === 'nugget' && ev.shaft === i;
      rr.rubble.hidden = !cave;
      if (cave) setText(rr.rubble, `Cave-in! Tap to clear rubble (${ev.need})`);
      rr.nug.hidden = !nug;
    });
    R['im-geode'].hidden = !(ev && ev.type === 'geode');
    if (R['im-geode'].hidden) R['im-geode'].style.setProperty('--cracks', 0);
    if (ev && ev.type === 'geode') setText(R['im-geode'], String(ev.need));
    const n = m.shafts.length, ub = R['im-unl'];
    ub.parentNode.hidden = n >= 12;
    if (n < 12) {
      const c = G.unlockCost(m, n);
      setHTML(ub, `Sink the ${reg.ores[n][0]} shaft · ${(n + 1) * reg.depth} m<br><small>${usd(c)}</small>`);
      ub.classList.toggle('dis', m.cash < c);
    }
    // overtime and abilities
    const ot = R['im-ot'];
    ot.hidden = !S.feat.overtime;
    if (S.feat.overtime) {
      const on = G.isOn(S.ot), ready = now >= S.ot.ready;
      setHTML(ot, icon('lightning', 15) + (on ? 'Overtime ' + mmss(S.ot.until - now) : ready ? 'Call overtime' : 'Overtime in ' + mmss(S.ot.ready - now)));
      ot.className = 'im-pill' + (on ? ' on' : ready ? ' live' : ' dis');
    }
    const act = G.keysOf(m).filter((k) => {
      const s = G.stageOf(m, k);
      return s.mgr && s.spec === 'a';
    }), ready = act.filter((k) => now >= G.stageOf(m, k).ab.ready).length, ab = R['im-ab'];
    ab.hidden = !act.length;
    if (act.length) {
      setHTML(ab, icon('star', 15) + (ready ? `Use ${ready} abilit${ready > 1 ? 'ies' : 'y'}` : 'Abilities recharging'));
      ab.className = 'im-pill' + (ready ? ' live' : ' dis');
    }
    // supplies
    const sup = R['im-sup'], ic = G.itemCount();
    sup.hidden = !ic && !S.st.crates;
    if (!sup.hidden) {
      const open = !!S.ui.open_sup;
      setHTML(
        sup,
        `<button class="im-sum" data-a="itoggle" data-i="sup">${icon('crate', 16)}<span>Supplies</span><small>${ic ? ic + ' ready' : 'none'}</small><i>${open ? '−' : '+'}</i></button>` +
          (open ? `<div class="im-items">${Object.keys(G.ITEMS).map((k) => `<button class="${S.items[k] ? '' : 'dis'}" data-a="item" data-i="${k}" title="${G.ITEMS[k].desc}">${icon(ITEM_ICON[k], 16)}<span>${G.ITEMS[k].name}</span><b>${S.items[k]}</b></button>`).join('')}</div>` : ''),
      );
    }
    for (const b of R['im-buy'].children) b.classList.toggle('on', b.dataset.i === S.buy);
  }
  const ITEM_ICON = { dyn: 'dynamite', coffee: 'coffee', lamp: 'lamp', card: 'timecard' };
  // The cage and the progress bars move every frame while the Mine tab is open
  // The mine's moving parts, once per frame. A value is only written when it differs from what is on screen, so a
  // frame where little moved costs next to nothing, and the cycle length is looked up a few times a second
  const sty = (el, k, v) => {
    const c = el._s || (el._s = {});
    if (c[k] !== v) el.style[k] = c[k] = v;
  };
  const cls = (el, k, on) => {
    const c = el._k || (el._k = {});
    if (c[k] !== on) el.classList.toggle(k, (c[k] = on));
  };
  // The game advances ten times a second but the screen draws sixty: the car and the bars show where things have got
  // to since the last step (a tenth of a second at most), so they glide instead of moving in ten jumps a second
  let tickAt = 0, cycAt = 0, cycV = 1, topH = 0, dockH = 0, carH = 47, catching = false;
  function anim(now) {
    if (!here() || tab !== 'mine' || document.hidden || !rows.length) return void (animOn = false);
    const m = MI();
    if (!rowH) rowH = rows[0].root.offsetHeight || 119;
    if (now - cycAt > 250) (cycAt = now), (cycV = G.cycle(m, false));
    if (!topH) {
      // sizes are read once and then kept up to date by a ResizeObserver: reading layout inside the animation would
      // make the browser lay the page out mid-frame, a hitch several times a second
      const measure = () => ((dockH = R['im-wh'].offsetTop - R['im-top'].offsetTop + R['im-wh'].offsetHeight / 2), (topH = R['im-top'].offsetHeight || rowH));
      measure();
      carH = R['im-car'].offsetHeight || 47;
      if (window.ResizeObserver && !R['im-top']._ro) {
        R['im-top']._ro = new ResizeObserver(measure);
        R['im-top']._ro.observe(R['im-top']);
      }
    }
    sty(R['im-track'], 'height', topH + m.shafts.length * rowH + 'px');
    const ahead = Math.min(0.12, Math.max(0, (performance.now() - tickAt) / 1000)), E = m.E, W = m.W;
    const eT = E.t, wT = W.t;
    if (eT >= 0) E.t = eT + ahead;
    const pos = G.elevPos(m); // the car's place a moment on from the last step
    E.t = eT;
    // stop 0 is the dock beside the warehouse; stop k is shaft k (topH counts the elevator's row too)
    const c0 = dockH, c1 = topH + rowH / 2, y = (pos <= 1 ? c0 + pos * (c1 - c0) : c1 + (pos - 1) * rowH) - carH / 2;
    sty(R['im-car'], 'transform', `translateY(${y.toFixed(1)}px)`);
    sty(R['im-cable'], 'height', Math.max(0, y).toFixed(1) + 'px');
    // the car shows its real load against its real capacity: full only when it is (and then it turns back up)
    fillTo(R['im-load'], Math.min(100, (E.load / G.eCap(m)) * 100), eT >= 0 && E.load > 0);
    cls(R['im-car'], 'fast', !!(E.mgr && E.spec === 'a' && G.isOn(E.ab)));
    cls(R['im-car'], 'wait', !!E.wait);
    fillTo(R.w.fill, wT >= 0 ? ((wT + ahead) / W.T) * 100 : 0, wT >= 0);
    for (let i = 0; i < m.shafts.length; i++) {
      const s = m.shafts[i];
      // a shaft cycling faster than the eye can follow holds a full seam that twinkles and sheds chips instead of flickering
      if (rows[i]) fillTo(rows[i].fill, s.t >= 0 && cycV >= 0.3 ? ((s.t + ahead) / cycV) * 100 : 0, s.t >= 0);
    }
    requestAnimationFrame(anim);
  }
  function startAnim() {
    if (animOn) return; // one loop at a time, however often the tab is opened
    animOn = true;
    requestAnimationFrame(anim);
  }

  // ===== A sheet for hiring, a manager's details and crates =====
  function openSheet(title, html) {
    setText($('sh-t'), title);
    $('sh-b').innerHTML = html;
    $('indSheet').hidden = false;
    Polish.restart($('indSheet').lastElementChild, 'reveal');
  }
  const closeSheet = () => ($('indSheet').hidden = true);
  function hireSheet(k) {
    const m = MI(), c = G.mgrCost(m, k, 1), spec = G.SPEC[k[0]], can = m.cash >= c;
    openSheet(
      `Hire for the ${G.keyName(m, k)}`,
      `<p class="tip">Cost ${usd(c)}. Active managers are stronger while you play; passive ones also count offline. You can retrain later.</p>` +
        row(spec.a.name, `${spec.a.desc} Lasts ${G.abDur()} s, recharges in ${Math.round(G.abCd(m))} s.`, btn('hire', k + '.a', 'Hire', can)) +
        row(spec.p.name, spec.p.desc, btn('hire', k + '.p', 'Hire', can)),
    );
  }
  function mgrSheet(k) {
    const m = MI(), s = G.stageOf(m, k), kind = k[0], sp = G.SPEC[kind][s.spec], other = G.SPEC[kind][s.spec === 'a' ? 'p' : 'a'];
    const bonus = (r) => (kind === 's' ? `output ×${G.RANK_S[r]}` : `capacity ×${G.RANK_EW[r]}`);
    const next = s.mgr < 3 ? s.mgr + 1 : 0, cost = next ? G.mgrCost(m, k, next) : 0, rc = G.mgrCost(m, k, 1);
    openSheet(
      `${cap(G.keyName(m, k))} manager`,
      `<p class="tip"><b>${G.RANK_NAME[s.mgr]} ${sp.name}</b> runs the ${G.keyName(m, k)}.${s.mgr > 1 ? ' Rank bonus: ' + bonus(s.mgr) + '.' : ''} ${sp.desc}${s.spec === 'a' ? ` Lasts ${G.abDur()} s, recharges in ${Math.round(G.abCd(m))} s.` : ''}</p>` +
        (next
          ? S.feat.ranks
            ? row(`Promote to ${G.RANK_NAME[next]}`, `${cap(bonus(next))}`, btn('promote', k, usd(cost), m.cash >= cost))
            : tip('Promotions open once any mine has 4 shafts.')
          : tip('This is a Chief, the top rank.')) +
        row(`Retrain as a ${other.name}`, other.desc, btn('retrain', k, usd(rc), m.cash >= rc)),
    );
  }
  function crateSheet(title, items, extra = '') {
    if (!items.length && !extra) return;
    openSheet(title, extra + items.map((k) => row(`${icon(ITEM_ICON[k], 16)} ${G.ITEMS[k].name}`, G.ITEMS[k].desc, '')).join('') + tip('Stowed in your supplies on the Mine tab.'));
    Polish.sparks(30);
  }

  // ===== Player actions. Every button carries data-a (action) and data-i (its argument) =====
  const no = () => toast('Not enough cash yet');
  const ACTIONS = {
    ibuy: (x) => G.act.setBuy(x),
    iview: (i) => G.act.view(+i),
    dig: (i) => G.act.dig(+i),
    vent: (i) => G.act.vent(+i),
    route(i) {
      if (G.act.route(+i) === 'full') toast(`The elevator can only make ${G.maxStops(MI())} stops. Take a shaft off the route first`);
    },
    send(k) {
      const r = G.act.send(k);
      if (r === 'empty') toast('The stockpile is empty. Send the elevator first');
      else if (r === 'route') toast('Put at least one shaft on the route');
    },
    up: (k) => G.act.up(k) || no(),
    mgrbtn(k) {
      const s = G.stageOf(MI(), k);
      if (!s.mgr) hireSheet(k);
      else if (s.spec === 'a') G.act.ability(k) || toast('That ability is still recharging');
      else mgrSheet(k);
    },
    mgr: (k) => mgrSheet(k),
    hire(v) {
      const [k, spec] = v.split('.');
      if (G.act.hire(k, spec)) closeSheet();
      else no();
    },
    promote: (k) => (G.act.promote(k) ? mgrSheet(k) : no()),
    retrain: (k) => (G.act.retrain(k) ? mgrSheet(k) : no()),
    sheetX: () => closeSheet(),
    abilAll: () => G.act.abilAll(),
    overtime: () => G.act.overtime(),
    unlock: () => G.act.unlock() || no(),
    ref: () => G.act.buildRef() || no(),
    split: (v) => G.act.setSplit(+v),
    item: (id) => G.act.useItem(id),
    itoggle(box) {
      S.ui['open_' + box] = S.ui['open_' + box] ? 0 : 1;
    },
    iregmore() {
      S.ui.regOpen = S.ui.regOpen ? 0 : 1;
    },
    ev: () => G.act.ev(),
    evno: () => G.act.evDecline(),
    research: (id) => G.act.research(id) || no(),
    doct(id) {
      if (confirmTap('doct-' + id)) G.act.doctrine(id);
    },
    daily() {
      const r = G.act.claimDaily();
      if (r) crateSheet('Supply drop', r.items, tip(`Day ${S.daily.streak} of your streak. Plus <b>${usd(r.cash)}</b> for ${G.REGIONS[S.cur].short}.`));
    },
    mclaim(id) {
      const r = G.act.claimMission(+id);
      if (!r) return;
      toast(`Mission reward: +${usd(r.m.reward.cash)}`);
      if (r.items.length) crateSheet('Mission crate', r.items);
      if (r.bonus.length) crateSheet('Bonus crate: 5 missions done', r.bonus);
    },
    mswap: (id) => G.act.swapMission(+id),
    project(id) {
      const p = G.PROJ.find((x) => x.id === id);
      if (G.totalIngots() < p.ingots) return toast(`Hold ${num(p.ingots)} ingots across your mines first`);
      if (!G.act.project(id)) toast('Not enough materials yet');
    },
    craft: (id) => G.act.craft(id) || toast('Not enough materials yet'),
    equip(id) {
      const free = S.slots.indexOf(null);
      if (free < 0) return toast('All slots are full. Tap a slot to empty it');
      G.act.slot(id, free);
    },
    unequip(id) {
      const i = S.slots.indexOf(id);
      if (i >= 0) G.act.unslot(i);
    },
    unslot: (i) => G.act.unslot(+i),
    perk(v) {
      const [t, c] = v.split('.');
      if (!confirmTap('perk-' + v)) return;
      if (G.act.pickPerk(+t, c)) toast(`${G.PERKS[+t][c].name}: ${G.PERKS[+t][c].desc}`);
    },
    claim() {
      if (G.claimGain(MI()) < 1 || !confirmTap('claim')) return;
      G.act.claim();
    },
  };

  // ===== Feedback from the game: effects for the mine on screen, toasts for the rest =====
  const visible = (el) => {
    if (!el || document.hidden) return null;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width > 0 ? r : null;
  };
  const center = (r) => [r.left + r.width / 2, r.top + r.height / 2];
  // ----- Production feedback: every stage says so when it finishes a cycle -----
  // A floating number rises from the stage that made something (the same one Capitalist uses), only when the cycle
  // really produced. Stages that cycle faster than it can be read just show fewer
  const calm = () => reducedMotion || !settings.effects;
  const produce = (bar, text, color, key) => Polish.pop(bar && bar.parentElement, text, color, 'i' + key, false, 'pl');
  // the mine picker: the mine that just sold lights up, so production in a mine you are not looking at shows too
  const salePick = [];
  function pickPulse(mi) {
    const now = performance.now();
    if (calm() || now - (salePick[mi] || 0) < 450) return;
    const b = $('strip').querySelector(`.im-mb [data-i="${mi}"]`);
    if (!b || !b.animate) return;
    salePick[mi] = now;
    b.animate([{ boxShadow: `inset 0 0 0 1.5px ${CASH_COLOR}` }, { boxShadow: `inset 0 0 0 0 ${CASH_COLOR}00` }], { duration: 600, easing: 'ease-out' });
  }
  G.on((t, d) => {
    if (!here() || catching) return;
    const same = d.mi == null || d.mi === S.cur, vis = tab === 'mine' && same;
    switch (t) {
      case 'dig': {
        if (!same || !(d.p > 0)) break; // a full deposit digs nothing: no sign of production
        const rr = rows[d.i];
        if (!vis || !rr) break;
        const col = G.regOf(MI()).ores[d.i][1];
        if (d.manual) {
          const r = visible(rr.bar);
          if (r) {
            Polish.burst(r.left + r.width * 0.9, r.top + r.height / 2, col, 8, 30);
            Polish.floatText(r.left + r.width * 0.75, r.top, '+' + num(d.p), col);
          }
          break;
        }
        produce(rr.bar, '+' + num(d.p), col, d.i);
        break;
      }
      case 'lift': {
        if (!same || !(d.load > 0)) break;
        if (!vis) break;
        Polish.pop(R.e.root, '+' + num(d.load), '#cbd3da', 'ie', false, 'pc');
        break;
      }
      case 'sell': {
        if (!(d.money > 0)) break;
        pickPulse(d.mi);
        if (!vis) break;
        produce(R.w.bar, '+' + usd(d.money), CASH_COLOR, 'w');
        break;
      }
      case 'mat': {
        if (!same || !vis || !(d.amount > 0)) break;
        const mk = matOf(S.mines[d.mi]);
        Polish.pop(R['im-ref'], '+' + num(d.amount) + ' ' + mk.short.toLowerCase(), mk.color, 'imat', false, 'pl');
        break;
      }
      case 'upgrade': {
        const rr = same && refsOf(d.k);
        if (!rr) break;
        Polish.restart(rr.root, 'bump');
        Polish.restart(rr.lv, 'tick');
        const r = visible(rr.up);
        if (r) Polish.floatText(...center(r), '+' + d.levels + ' Lv', CASH_COLOR);
        if (d.mil) {
          toast(`${G.regOf(MI()).ores[+d.k.slice(1)][0]} output ×${Math.pow(G.perk('lode') ? 2.5 : 2, d.mil)}`);
          Polish.unlock(rr.root, CASH_COLOR);
        }
        break;
      }
      case 'allmil':
        toast(`Every shaft at Lv ${d.at}: all shafts ×${2 ** d.got}`);
        break;
      case 'hire': {
        const rr = same && refsOf(d.k);
        if (rr) Polish.unlock(rr.root, '#a3c4a0');
        toast(`The ${G.keyName(S.mines[d.mi], d.k)} now runs itself`);
        break;
      }
      case 'promote':
        toast(`Promoted to ${G.RANK_NAME[d.rank]}`);
        Polish.sparks(30);
        break;
      case 'retrain':
        toast('Manager retrained');
        break;
      case 'overheat': {
        const r = vis && rows[d.i] && visible(rows[d.i].bar);
        if (r) Polish.floatText(...center(r), 'Overheated', '#e3a08c');
        break;
      }
      case 'overtime':
        toast('Overtime! Every mine digs twice as much');
        Polish.sparks(30);
        break;
      case 'unlock':
        if (!same) {
          toast(`${G.regOf(S.mines[d.mi]).ores[d.i][0]} shaft open in ${G.REGIONS[d.mi].short}`);
          break;
        }
        renderShafts();
        updMine();
        setTimeout(() => rows[d.i] && Polish.unlock(rows[d.i].root, G.regOf(MI()).ores[d.i][1]), 30);
        toast(`${G.regOf(MI()).ores[d.i][0]} shaft open at ${(d.i + 1) * G.regOf(MI()).depth} m`);
        break;
      case 'mastered':
        toast(`${G.REGIONS[d.mi].name} mastered: all 12 shafts open. Ore here sells for 50% more, for good`);
        Polish.sparks(80);
        break;
      case 'research':
        toast(`${G.LAB.find((x) => x.id === d.id).name} Lv ${d.lvl}`);
        break;
      case 'doctrine':
        toast(`${G.DOCT[d.id].name} doctrine adopted`);
        break;
      case 'refinery':
        toast(d.lvl === 1 ? 'Refinery built' : `Refinery Lv ${d.lvl}`);
        break;
      case 'item':
        toast(d.id === 'dyn' ? 'Boom. Every deposit is loaded' : d.id === 'card' ? `Time card: +${usd(d.amt)}` : G.ITEMS[d.id].name + ' is working');
        break;
      case 'missionDone':
        toast('Mission complete: ' + G.missionText(d.m));
        break;
      case 'event':
        if (d.c.type === 'surge') toast('Buyers in town: ore prices doubled for 60 s');
        break;
      case 'nugget':
        toast(`Nugget: +${usd(d.c.reward)}`);
        Polish.sparks(20);
        break;
      case 'rubble': {
        // each blow knocks rock chips and dust off the pile, and it jolts
        const rr = d.c.mi === S.cur && rows[d.c.shaft], sb = $('strip').querySelector('[data-a="ev"]');
        let b = rr && rr.rubble, r = b && visible(b);
        if (!r) (b = sb), (r = b && visible(b)); // the pile is off screen: the chips fly from the button you tapped
        if (!r) break;
        Polish.restart(b, 'hit');
        Polish.chips(r.left + r.width * (0.3 + Math.random() * 0.4), r.top + r.height / 2, ['#7d6c5e', '#5e5148', '#9a8a7c', '#4a3f37', '#3a332e'], 9);
        break;
      }
      case 'caveClear': {
        toast(`Rubble cleared: +${usd(d.c.reward)}`);
        const rr = rows[d.c.shaft], r = rr && visible(rr.bar);
        if (r) Polish.chips(r.left + r.width / 2, r.top + r.height / 2, ['#7d6c5e', '#5e5148', '#9a8a7c', '#4a3f37', '#3a332e'], 22, 1.2);
        break;
      }
      case 'geodeHit': {
        // the geode cracks a little more with each tap, and shards fly
        let b = R['im-geode'], r = b && visible(b);
        b.style.setProperty('--cracks', Math.min(1, Math.max(0, 1 - d.c.need / 6)).toFixed(2)); // a geode takes six blows
        if (!r) (b = $('strip').querySelector('[data-a="ev"]')), (r = b && visible(b));
        if (!r) break;
        Polish.restart(b, 'hit');
        Polish.chips(r.left + r.width / 2, r.top + r.height / 2, ['#b18cf0', '#d9c6ff', '#7f5bc4', '#5b3d8a', '#8fd3e8'], 8);
        break;
      }
      case 'geode': {
        const b = R['im-geode'], r = b && visible(b);
        if (r) Polish.chips(r.left + r.width / 2, r.top + r.height / 2, ['#b18cf0', '#d9c6ff', '#7f5bc4', '#8fd3e8', '#ffffff'], 26, 1.3);
        if (b) b.style.setProperty('--cracks', 0);
      }
        crateSheet('The geode held supplies', d.items, d.c.mat ? tip(`Plus <b>${num(d.c.mat)}</b> ${matOf(S.mines[d.c.mi]).name.toLowerCase()}.`) : '');
        break;
      case 'rushAccept':
        toast('Rush order accepted. Sell fast');
        break;
      case 'rushDone':
        toast('Rush order filled');
        Polish.sparks(40);
        break;
      case 'eventEnd':
        if (!d.handled && d.c.type === 'rush' && d.c.accepted) toast('Rush order missed. No penalty');
        break;
      case 'ach':
        toast(`Achievement: ${d.a.name} · ore +1%`);
        break;
      case 'claim': {
        shownMine = -1;
        const m = S.mines[d.mi];
        spectacle('transmute', 'New claim staked', `+${d.g} gold ingot${d.g > 1 ? 's' : ''} · ${G.REGIONS[d.mi].short} ore now sells at ×${(1 + 0.1 * m.ingots).toFixed(1)}`);
        break;
      }
      case 'craft':
        toast(d.lvl === 1 ? `${G.EQUIP.find((x) => x.id === d.id).name} crafted` : `${G.EQUIP.find((x) => x.id === d.id).name} Lv ${d.lvl}`);
        break;
      case 'project':
        if (d.mine != null) spectacle('ascend', `${G.REGIONS[d.mine].name} is open`, G.REGIONS[d.mine].blurb);
        else toast(`${G.PROJ.find((x) => x.id === d.id).name} complete`);
        break;
      case 'view':
        shownMine = -1;
        break;
    }
  });

  // ===== The panes: Missions, Lab, Works and the Guild =====
  const chips = (c) => `<div class="price">${Object.keys(c).map((k) => `<span class="pc${S.mats[k] < c[k] ? ' short' : ''}">${num(c[k])} ${G.MATS[k].short}</span>`).join('')}</div>`;
  const PANES = {
    missions() {
      const dr = G.dailyReady(), st = S.daily.streak, now = G.clock();
      let h =
        `<div class="row panel"><div><b>${icon('crate', 16)} Supply drop</b><small>A free crate every day you visit. 3 days in a row gives 2 items, 7 days gives 3. ${st ? `Streak: ${st} day${st > 1 ? 's' : ''}.` : ''}</small></div>${btn('daily', 0, dr ? 'Open' : 'Tomorrow', dr)}</div>` +
        section('Missions');
      h += S.missions
        .map((x) => {
          const p = Math.min(G.missionProg(x), x.target), prog = x.type === 'sell' ? `${usd(p)} / ${usd(x.target)}` : `${num(p)} / ${num(x.target)}`;
          const ok = now >= S.swapReady;
          return (
            `<div class="row im-mis${x.done ? ' ready' : ''}"><div><b>${multi() ? `<i class="tag">${G.REGIONS[x.mi].short}</i> ` : ''}${G.missionText(x)}</b>` +
            `<small>${x.done ? 'Complete' : live(prog)} · ${usd(x.reward.cash)}${x.reward.crate ? ' + a crate' : ''}</small><div class="bar thin">${liveBar((p / x.target) * 100)}</div></div>` +
            (x.done ? btn('mclaim', x.id, 'Collect', true) : `<button class="${ok ? 'q' : 'dis'}" data-a="mswap" data-i="${x.id}">${ok ? 'Swap' : live(mmss(S.swapReady - now))}</button>`) +
            `</div>`
          );
        })
        .join('');
      h += tip(`Every fifth mission also pays a crate with two supplies: ${S.mDone % 5} of 5 so far. New missions come from the mine you are watching.`);
      return [h];
    },
    lab() {
      const m = MI(), reg = G.regOf(m);
      if (!S.feat.lab) return [tip('Open 3 shafts in any mine to build the lab. Research boosts the whole mine, and you rebuild it every claim.')];
      let h = `<div class="row panel"><div><b>${icon('flask', 16)} ${reg.name} lab</b><small>This mine only</small></div></div>`;
      if (m.doct) h += row(`Doctrine: ${G.DOCT[m.doct].name}`, G.DOCT[m.doct].desc, owned_('Adopted'));
      else h += section('Choose a doctrine') + tip('One per claim. It stays until you stake a new claim here.') + Object.keys(G.DOCT).map((id) => row(G.DOCT[id].name, G.DOCT[id].desc, btn('doct', id, armed === 'doct-' + id ? 'Tap again' : 'Adopt', true))).join('');
      h += section('Research') + tip('More levels open as this mine goes deeper.');
      h += G.LAB.filter((d) => !d.only || d.only === reg.mech)
        .map((d) => {
          const L = m.lab[d.id], c = G.labCost(m, d.id);
          const right = L >= d.max ? owned_('Maxed') : G.labReady(m, d.id) ? btn('research', d.id, live(usd(c)), m.cash >= c) : owned_(`Shaft ${G.labShaft(m, d.id)}`);
          return row(`${d.name}${d.only ? ` <i class="tag">${reg.short} only</i>` : ''}`, `${d.desc} · ${L} / ${d.max}`, right);
        })
        .join('');
      return [h];
    },
    works() {
      if (!S.feat.works) return [tip('Build a refinery on a warehouse (it unlocks with 3 shafts) to start making materials. Materials pay for new mines and equipment here.')];
      const ti = G.totalIngots();
      const rates = openMines().filter((m) => m.ref).map((m) => `${G.REGIONS[m.i].short} +${num(G.matRate(m) * m.split * 2 * 3600)} ${matOf(m).short.toLowerCase()}/h`).join(' · ');
      let h =
        `<div class="row panel"><div><b>Materials</b><div class="price">${Object.keys(G.MATS).map((k) => `<span class="pc">${live(num(S.mats[k]))} ${G.MATS[k].short}</span>`).join('')}</div>` +
        `<small>${live(rates || 'No refineries running. Build one on a warehouse.')}</small></div></div>`;
      h += section(`Projects · ${num(ti)} ingots held`);
      h += G.PROJ.filter((p) => !G.projDone(p.id))
        .slice(0, 3)
        .map((p) => {
          const c = G.projCost(p.id), need = ti < p.ingots, n = S.proj[p.id] || 0;
          return row(`${p.name}${p.repeat ? ` · stage ${n + 1}` : ''}`, p.desc + chips(c), btn('project', p.id, need ? `${num(p.ingots)} ingots` : 'Start', !need && G.canPay(c)));
        })
        .join('');
      const done = G.PROJ.filter((p) => S.proj[p.id]).map((p) => (p.repeat ? `${p.name} (stage ${S.proj[p.id]})` : p.name));
      if (done.length) h += tip('Finished: ' + done.join(', ') + '.');
      h += section('Equipment') + tip('Only equipped items work. Tap a slot to empty it.');
      h += `<div class="im-slots">${S.slots.map((id, i) => `<button class="${id ? 'on' : ''}" data-a="unslot" data-i="${i}">${id ? G.EQUIP.find((d) => d.id === id).name : 'Empty slot'}</button>`).join('')}</div>`;
      h += G.EQUIP.map((d) => {
        const L = S.equip[d.id] || 0, mx = G.eqMax(d), c = G.equipCost(d.id), on = S.slots.includes(d.id);
        const right = (L < mx ? btn('craft', d.id, L ? 'Upgrade' : 'Craft', G.canPay(c)) : '') + (L ? btn(on ? 'unequip' : 'equip', d.id, on ? 'Unequip' : 'Equip', true) : '');
        return row(`${d.name} · Lv ${L} / ${mx}`, d.desc + (L < mx ? chips(c) : ''), `<span class="bp">${right}</span>`, on ? ' im-on' : '');
      }).join('');
      return [h];
    },
    // The Guild: claims and charter perks, then the ledger, achievements and (below the panes) Settings
    opus() {
      const m = MI(), reg = G.regOf(m), ti = G.totalIngots(), g = G.claimGain(m), nx = G.nextIngotAt(m), prev = g >= 1 ? G.ingotAt(m, g) : 0;
      let h =
        `<div class="row panel"><b>${icon('crown', 16)} ${reg.name}: ${num(m.ingots)} ingots</b>` +
        `<small>Stake a new claim to sell this mine and start it fresh. Cash, shafts, levels, research and the refinery reset; the managers of the first shaft, elevator and warehouse stay. Ingots stay forever and each adds 10% to ${reg.short} ore prices.</small>` +
        `<div class="bar">${liveBar(Math.min(100, ((m.run - prev) / (nx - prev)) * 100))}<span>${live(`${usd(m.run)} this claim · next ingot at ${usd(nx)}`)}</span></div></div>` +
        bigButton('claim', armed === 'claim' ? 'Tap again to stake the claim' : g >= 1 ? `Stake a new claim for +${g} ingot${g > 1 ? 's' : ''}` : `Earn ${usd(G.CLAIM_MIN)} this claim to stake`, g >= 1);
      if (g >= 1) h += `<p class="hint">Ore here would sell at ×${((1 + 0.1 * (m.ingots + g)) / (1 + 0.1 * m.ingots)).toFixed(2)} the price it does now. ${(1 + 0.1 * (m.ingots + g)) / (1 + 0.1 * m.ingots) >= 1.5 ? 'Good time to stake.' : 'Most players wait for ×1.5 or more.'}</p>`;
      if (multi()) h += section('Ingots by mine') + openMines().map((x) => row(G.REGIONS[x.i].name, `${x.claims} claim${x.claims === 1 ? '' : 's'}`, `<b>${num(x.ingots)}</b>`, ' st')).join('');
      h += section('Charter perks') + tip('Pairs unlock as your ingots across all mines grow, and apply to every mine. A pick stays until your next claim in any mine.');
      h += G.PERKS.map((P, t) => {
        const open = ti >= P.need, pick = S.perks[t], lock = S.perkLock[t];
        return (
          `<p class="im-tier">${num(P.need)} ingots · ${!open ? 'locked' : lock ? 'chosen until your next claim' : 'pick one'}</p>` +
          ['a', 'b']
            .map((c) => row(P[c].name, P[c].desc, pick === c ? owned_('Chosen') : open && !lock ? btn('perk', t + '.' + c, armed === `perk-${t}.${c}` ? 'Tap again' : 'Choose', true) : '', open ? '' : ' done'))
            .join('')
        );
      }).join('');
      const st = S.st;
      const stats = statRows([
        ['Total earnings', usd(S.total)],
        ['Earned this claim', usd(m.rs.earned)],
        ['Ore dug', num(st.dug)],
        ['Ore sold', num(st.sold)],
        ['Materials refined', num(st.mats)],
        ['Best income', usd(st.bestRate) + '/s'],
        ['Missions completed', num(st.missions)],
        ['Events handled', num(st.events)],
        ['Time played', duration(st.played)],
        ['Elevator trips', num(st.eTrips)],
        ['Digs by hand', num(st.taps)],
        ['Levels bought', num(st.upgrades)],
        ['Abilities used', num(st.abil)],
        ['Crates opened', num(st.crates)],
        ['Claims staked', num(st.claims)],
      ]);
      return [h + stats, achievementSection(G.ACH, S.ach, 'ore prices')];
    },
  };

  // ===== Red dots on the tab bar =====
  const goodClaim = (m) => {
    const g = G.claimGain(m);
    return g >= 1 && (1 + 0.1 * (m.ingots + g)) / (1 + 0.1 * m.ingots) >= 1.5;
  };
  const TAB_BADGES = {
    // an event in this mine (it won't wait), else a shaft, manager, promotion or refinery level it can afford.
    // Plain stage levels are left out: one is almost always affordable, so the dot would never go out
    mine: () => {
      const m = MI(), cash = m.cash, n = m.shafts.length;
      if (S.ev.cur && S.ev.cur.mi === S.cur) return 'alert';
      return (n < 12 && cash >= G.unlockCost(m, n)) || (S.feat.refinery && cash >= G.refCost(m)) ||
        G.keysOf(m).some((k) => { const r = G.stageOf(m, k).mgr; return r ? S.feat.ranks && r < 3 && cash >= G.mgrCost(m, k, r + 1) : cash >= G.mgrCost(m, k, 1); });
    },
    missions: () => (S.missions.some((x) => x.done) || G.dailyReady() ? 'claim' : false),
    lab: () => S.feat.lab && (!MI().doct ? 'alert' : G.LAB.some((d) => G.labReady(MI(), d.id) && MI().cash >= G.labCost(MI(), d.id))),
    works: () =>
      !!S.feat.works &&
      (G.PROJ.some((p) => !G.projDone(p.id) && G.totalIngots() >= p.ingots && G.canPay(G.projCost(p.id))) ||
        G.EQUIP.some((d) => (S.equip[d.id] || 0) < G.eqMax(d) && G.canPay(G.equipCost(d.id)))),
    opus: () => (goodClaim(MI()) ? 'claim' : false) || G.PERKS.some((P, t) => G.totalIngots() >= P.need && !S.perkLock[t] && !S.perks[t]),
  };
  // The four boxes at the top: [label, icon, value, format, note]
  function header() {
    const m = MI(), r = G.rates(m, false, false), mat = matOf(m);
    return [
      ['Cash', 'coins', m.cash, usd, multi() ? ' · ' + G.REGIONS[m.i].short : ''],
      ['Income/s', 'trend', r.income, usd, ' · ' + r.bn.toLowerCase() + ' limit'],
      ['Ingots', 'crown', G.totalIngots(), count, ''],
      [mat.short, 'anvil', S.mats[G.regOf(m).mat], count, ''],
    ];
  }
  // The live line under the top boxes: the mine picker (once there are two mines) and the current event
  function strip() {
    let h = '';
    if (multi())
      h += `<div class="im-mb">${openMines().map((x) => `<button class="${x.i === S.cur ? 'on' : ''}" data-a="iview" data-i="${x.i}"><b>${G.REGIONS[x.i].short}</b><small>${live(usd(x.cash))}</small></button>`).join('')}</div>`;
    const c = S.ev.cur;
    if (c) {
      const now = G.clock(), em = S.mines[c.mi], reg = G.regOf(em), ore = c.shaft != null ? reg.ores[c.shaft][0] : '', where = c.mi !== S.cur ? ` (${reg.short})` : '';
      let t, d, acts = '';
      if (c.type === 'nugget') (t = 'Gold nugget' + where), (d = `Spotted in the ${ore} shaft. Worth ${usd(c.reward)}.`), (acts = btn('ev', 0, 'Grab', true));
      else if (c.type === 'cave') (t = 'Cave-in' + where), (d = `The ${ore} shaft is blocked. Clear ${live(c.need)} more piles of rubble.`), (acts = btn('ev', 0, 'Clear', true));
      else if (c.type === 'surge') (t = 'Buyers in town'), (d = 'Ore sells for double in every mine. Push the warehouses hard.');
      else if (c.type === 'rush') {
        t = 'Rush order' + where;
        if (!c.accepted) (d = `Sell ${num(c.target)} ore within 90 s for ${usd(c.reward)}.`), (acts = btn('ev', 0, 'Accept', true) + `<button class="q" data-a="evno" data-i="0">Pass</button>`);
        else d = live(`${num(Math.min(c.prog, c.target))} / ${num(c.target)} ore sold`);
      } else (t = 'Geode' + where), (d = `A geode came up with the ore. Crack it open (${live(c.need)} hits).`), (acts = btn('ev', 0, 'Crack', true));
      h += `<div class="im-ev"><div><b>${t}</b><small>${d}</small></div><span class="bp">${acts}</span><div class="bar">${liveBar(Math.max(0, ((c.until - now) / (c.dur || 1)) * 100))}</div></div>`;
    }
    return h;
  }

  // ===== Guidance: locked tabs and one-time cards =====
  function locked(key) {
    if (key === 'lab' && !S.feat.lab) return 'opens when a mine has 3 shafts';
    if (key === 'works' && !S.feat.works) return 'opens with your first refinery';
    return '';
  }
  const HINTS = [
    { id: 'overtime', when: () => S.feat.overtime, tab: 'mine', title: 'Overtime', text: 'Doubles digging in every mine for 5 minutes. Call it from the Mine tab when you’re about to watch for a while; it recharges in 15 minutes.' },
    { id: 'events', when: () => S.feat.events, tab: 'mine', title: 'Mine events', text: 'Nuggets, cave-ins, rush orders and geodes turn up every few minutes in the mine on screen. They show under the top boxes on every tab, and pay well if you react in time.' },
    { id: 'lab', when: () => S.feat.lab, tab: 'lab', title: 'The lab', text: 'Research boosts this whole mine, and a <b>doctrine</b> shapes how this claim plays. Both reset when you stake a new claim here.' },
    { id: 'refinery', when: () => S.feat.refinery, tab: 'mine', title: 'Refinery', text: 'Build it on the warehouse: it turns a share of your ore into <b>materials</b> instead of cash. Materials are the only way to open new mines and craft equipment.' },
    { id: 'ranks', when: () => S.feat.ranks, tab: 'mine', title: 'Promotions', text: 'Tap a manager’s stars to promote them. A Senior doubles a shaft’s output; a Chief quadruples it. Deep shafts gain the most.' },
    { id: 'works', when: () => S.feat.works, tab: 'works', title: 'Works', text: '<b>Projects</b> open new mines and equipment slots; <b>equipment</b> boosts every mine. Both are paid in materials.' },
    { id: 'claim', when: () => goodClaim(MI()), tab: 'opus', title: 'A new claim is worth it', text: 'Staking a claim resets this mine but pays <b>gold ingots</b> that raise its ore price for good. A ×1.5 price boost or better is a good time.' },
    { id: 'perks', when: () => S.feat.perks, tab: 'opus', title: 'Charter perks', text: 'Ingots across all your mines unlock pairs of permanent perks. Pick one of each pair on the Guild tab; picks lock until your next claim.' },
    ...[1, 2, 3].map((i) => ({ id: 'mine' + i, when: () => S.mines[i].open, tab: 'mine', title: G.REGIONS[i].name + ' is open', text: `${G.REGIONS[i].blurb} Switch mines with the bar under the top boxes; every mine keeps running.` })),
    { id: 'core', when: () => !!S.proj.trench, tab: 'works', title: 'The Deep Core bore', text: 'An endless project: every stage raises ore prices in every mine by 10%. It needs materials from all four mines, so keep every refinery running.' },
  ];

  // which design of the goal is unlocked: one per milestone reached, and the next milestone to aim for
  const goalDesign = (steps) => {
    const next = steps.find(([, done]) => !done());
    return { style: steps.filter(([, done]) => done()).length, next: next ? next[0] : null };
  };
  const ingotsAtLeast = (n) => [`Earn ${num(n)} gold ingots in all`, () => G.totalIngots() >= n];
  const GOAL_STEPS = [
    ['Earn your first gold ingot', () => G.totalIngots() >= 1],
    ['Open a second mine', () => openMines().length >= 2],
    ingotsAtLeast(30),
    ['Open a third mine', () => openMines().length >= 3],
    ingotsAtLeast(150),
    ['Open all four mines', () => openMines().length >= 4],
    ingotsAtLeast(600),
    ['Finish a stage of the Deep Core bore', () => (S.proj.core || 0) >= 1],
    ingotsAtLeast(2500),
    ['Finish 10 stages of the Deep Core bore', () => (S.proj.core || 0) >= 10],
    ingotsAtLeast(10000),
  ];
  // ===== The goal on the Guild tab: a gem, one of twelve designs unlocked by milestones, brightening with your ingots, one light per open mine =====
  function stone() {
    return {
      family: 'ind',
      ...goalDesign(GOAL_STEPS),
      tint: [214, 172, 112],
      fill: 0.3 + 0.7 * Math.min(1, Math.log10(G.totalIngots() + 1) / 4),
      orbs: openMines().map((m, k) => ({ color: matOf(m).color, size: 2.4 + Math.min(3, m.shafts.length / 4), alpha: 1, r: 1.9 + k * 0.35, v: 0.3, a: k * 1.57, tilt: ((k % 3) - 1) * 0.08 })),
    };
  }
  function titleLine() {
    if (!S.total) return 'Sink shafts, haul ore up and run the deepest mines in the land.';
    const n = openMines().length;
    return `${n} mine${n > 1 ? 's' : ''} open · ${num(G.totalIngots())} ingots · Total earnings ${usd(S.total)}`;
  }
  // Time away: every mine runs its managed stages (see IndLogic's offline). Returns what was made
  function catchUp(seconds) {
    const mats = Object.assign({}, S.mats);
    catching = true; // time away makes no flashes
    G.offline(seconds);
    const p = G.act.collect();
    catching = false;
    const cash = p ? p.mines.reduce((a, o) => a + o.cash, 0) : 0;
    const out = [];
    if (cash > 0) out.push({ name: 'Cash', icon: 'coins', color: CASH_COLOR, amount: cash, format: usd });
    for (const k in G.MATS) if (S.mats[k] > mats[k]) out.push({ name: G.MATS[k].name, icon: 'anvil', color: G.MATS[k].color, amount: S.mats[k] - mats[k], format: fmt });
    S.playTime = S.st.played;
    return out;
  }
  function tick(dt) {
    tickAt = performance.now();
    for (let r = dt; r > 0; r -= 0.25) G.step(Math.min(r, 0.25));
    S.playTime = S.st.played;
  }
  function useState(s) {
    S = s;
    S.ui = S.ui || {};
    if (!(S.savedAt > 0)) S.savedAt = Date.now();
    S.playTime = S.st.played;
    shownMine = -1;
    adv = null;
  }

  return {
    key: 'industrialist',
    name: 'Industrialist',
    emblem: 'headframe',
    accent: '#d4ab72',
    saveKey: 'df_industrialist',
    tabs: TABS,
    tutorial: TUTORIAL,
    introPages: 2,
    locked,
    hints: HINTS,
    strip,
    get state() {
      return S;
    },
    load(raw) {
      const s = G.load(raw && typeof raw === 'object' ? raw : null);
      if (raw && typeof raw === 'object' && !raw.savedAt && raw.last > 0) s.savedAt = raw.last; // a save from before the app: its time away still counts
      useState(s);
    },
    fresh() {
      useState(G.fresh());
    },
    refresh() {},
    tick,
    catchUp,
    checkAchievements() {},
    won: () => false,
    actions: ACTIONS,
    panes: PANES,
    badges: TAB_BADGES,
    feedback: { measure: () => 0, label: () => '', unlocked: () => false },
    header,
    buildUI,
    onTab(key) {
      $('indMine').hidden = key !== 'mine';
      if (key === 'mine') {
        updMine();
        startAnim();
      } else rowH = 0;
      if (!key) closeSheet(); // leaving the mode
    },
    renderTab(key) {
      if (key !== 'mine') return false;
      updMine();
      startAnim();
      return true;
    },
    stone,
    titleLine,
    ending: () => ({ title: '', text: '', stats: [] }),
    deleteNote: 'Erases all Industrialist progress. Capitalist and Communist are not affected.',
  };
})();
