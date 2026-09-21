/* Synthetic paper market. All money is virtual; no external price feeds. */
(function (root) {
  'use strict';
  const SEEDS = [ ['AAPL','Apple Inc.',227.63,.25],['MSFT','Microsoft Corporation',428.76,.24],['NVDA','NVIDIA Corporation',138.85,.52],['AMZN','Amazon.com Inc.',224.19,.32],['GOOGL','Alphabet Inc.',192.85,.28],['META','Meta Platforms Inc.',608.22,.34],['TSLA','Tesla Inc.',352.56,.61],['SPY','SPDR S&P 500 ETF',596.48,.16],['QQQ','Invesco QQQ Trust',521.37,.21],['AMD','Advanced Micro Devices',118.42,.46],['NFLX','Netflix Inc.',984.56,.35],['JPM','JPMorgan Chase & Co.',259.18,.23],['V','Visa Inc.',347.82,.20],['DIS','The Walt Disney Company',110.44,.29],['BA','The Boeing Company',178.95,.37],['COIN','Coinbase Global Inc.',267.48,.72],['PLTR','Palantir Technologies',91.73,.64],['INTC','Intel Corporation',23.68,.43],['WMT','Walmart Inc.',96.42,.20],['XOM','Exxon Mobil Corporation',110.73,.24],['MU','Micron Technology',200,.43],['AVGO','Broadcom Inc.',350,.38] ];
  const KEY='northstar-paper-v1';
  const normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,Math.random())))*Math.cos(2*Math.PI*Math.random());
  const round=n=>Math.round(n*100)/100;
  function cdf(x){const t=1/(1+.2316419*Math.abs(x));const p=1-.3989422804014327*Math.exp(-x*x/2)*t*(.31938153+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?p:1-p;}
  function option(S,K,days,vol,type){
    if(days<=0)return {price:Math.max(0,type==='call'?S-K:K-S),delta:type==='call'?(S>K?1:0):(S<K?-1:0),gamma:0,theta:0,vega:0};
    const T=days/365,r=.04,v=Math.max(.01,vol),d1=(Math.log(S/K)+(r+v*v/2)*T)/(v*Math.sqrt(T)),d2=d1-v*Math.sqrt(T),pdf=Math.exp(-d1*d1/2)/Math.sqrt(2*Math.PI),disc=Math.exp(-r*T);
    const price=type==='call'?S*cdf(d1)-K*disc*cdf(d2):K*disc*cdf(-d2)-S*cdf(-d1);
    const theta=(-S*pdf*v/(2*Math.sqrt(T))+(type==='call'?-r*K*disc*cdf(d2):r*K*disc*cdf(-d2)))/365;
    return {price:Math.max(.001,price),delta:type==='call'?cdf(d1):cdf(d1)-1,gamma:pdf/(S*v*Math.sqrt(T)),theta,vega:S*pdf*Math.sqrt(T)/100};
  }
  function fresh(){
    const now=Date.now();const stocks={};
    SEEDS.forEach(([symbol,name,price,vol],idx)=>{let p=price*(1-(idx%4===0?-.007:.004));const history=[];for(let i=0;i<1440;i++){p*=Math.exp(normal()*vol*.0012);history.push({t:now-(1439-i)*60000,p:round(p),v:Math.floor(500+Math.random()*15000)});}const factor=price/history.at(-1).p;history.forEach(h=>h.p=round(h.p*factor));stocks[symbol]={symbol,name,price,vol,previous:history[1259].p,history,volume:Math.floor(2e6+Math.random()*35e6)};});
    return {version:1,cash:100000,positions:[],orders:[],activity:[],stocks,clock:now,scenario:'normal',selected:'AAPL',speed:1};
  }
  function valid(s){return s&&s.version===1&&Number.isFinite(s.cash)&&s.cash>=0&&Number.isFinite(s.clock)&&Array.isArray(s.positions)&&Array.isArray(s.orders)&&Array.isArray(s.activity)&&s.stocks&&Object.values(s.stocks).length>0&&Object.values(s.stocks).every(x=>x.price>0&&Array.isArray(x.history)&&x.history.length>0)&&s.positions.every(p=>Number.isFinite(p.qty)&&p.qty>0&&Number.isFinite(p.avg)&&p.avg>=0&&s.stocks[p.symbol]&&(p.asset==='stock'||(p.asset==='option'&&p.strike>0&&Number.isFinite(p.expiry)&&['call','put'].includes(p.type))));}
  function unpack(data){if(data?.saveFormat===1){for(const s of Object.values(data.stocks)){s.history=s.history.map(p=>({t:p[0],p:p[1],o:p[2],h:p[3],l:p[4],v:p[5]}));s.daily=(s.daily||[]).map(p=>({t:p[0],p:p[1],o:p[2],h:p[3],l:p[4],v:p[5],day:p[6]}));}delete data.saveFormat;}return data;}
  function packed(state){const pack=p=>[p.t,p.p,p.o,p.h,p.l,p.v];return {...state,saveFormat:1,stocks:Object.fromEntries(Object.entries(state.stocks).map(([k,s])=>[k,{...s,history:s.history.map(pack),daily:(s.daily||[]).map(p=>[...pack(p),p.day])}]))};}
  class Market{
    constructor(storage){this.storage=storage;this.storageOK=true;try{const data=unpack(JSON.parse(storage?.getItem(KEY)||'null'));this.state=valid(data)?data:fresh();}catch{this.state=fresh();this.storageOK=false;}this.events=[];this.migrate();}
    migrate(){this.state.packages ||= [];this.state.rng ||= 0x7a3f29d1;this.state.news ||= [];this.state.equityHistory ||= [{t:this.state.clock,equity:100000}];this.state.sessionId ||= 'account-'+this.state.clock;for(const [symbol,name,price,vol] of SEEDS)if(!this.state.stocks[symbol])this.state.stocks[symbol]={symbol,name,price,vol,previous:price,volume:0,history:Array.from({length:1440},(_,i)=>({t:this.state.clock-(1439-i)*60000,p:price,o:price,h:price,l:price,v:0}))};for(const [index,s] of Object.values(this.state.stocks).entries()){s.daily ||= [];s.baseVol ||= s.vol;s.earningsAt ||= this.state.clock+(7+(index*7)%35)*86400000;s.history.forEach((p,i)=>{if(!Number.isFinite(p.o)){p.o=i?s.history[i-1].p:p.p;p.h=Math.max(p.o,p.p);p.l=Math.min(p.o,p.p);}});}}
    save(){if(this.batch)return true;try{this.storage?.setItem(KEY,JSON.stringify(packed(this.state)));this.storageOK=!!this.storage;return this.storageOK;}catch{this.storageOK=false;return false;}}
    reset(){this.state=fresh();this.events=[];this.migrate();this.save();}
    key(a){return a.asset==='option'?`${a.symbol}:${a.type}:${a.strike}:${a.expiry}`:a.symbol;}
    days(a){return Math.max(0,(a.expiry-this.state.clock)/86400000);}
    quote(a){const s=this.state.stocks[a.symbol];if(!s)throw Error('Unknown symbol.');const mid=a.asset==='option'?option(s.price,a.strike,this.days(a),s.vol,a.type).price:s.price;const spread=a.asset==='option'?Math.max(.02,mid*.035):Math.max(.02,s.price*.00012);return {mid:round(mid),bid:Math.max(0,round(mid-spread/2)),ask:Math.max(.01,round(mid+spread/2)),spread:round(spread)};}
    collateral(){return this.state.packages.reduce((v,p)=>v+p.collateral*p.qty,0);}
    availableCash(){return Math.max(0,round(this.state.cash-this.collateral()));}
    totals(){let market=0,cost=0;for(const p of this.state.positions){const m=p.asset==='option'?100:1;market+=this.quote(p).mid*p.qty*m;cost+=p.avg*p.qty*m;}for(const p of this.state.packages){market+=this.packageQuote(p,'mid')*p.qty*100;cost+=p.entry*p.qty*100;}return {market,cost,equity:this.state.cash+market,unrealized:market-cost};}
    packageQuote(p,mode='open'){return round(p.legs.reduce((v,l)=>{const q=this.quote({...l,asset:'option',symbol:p.symbol,expiry:p.expiry});const price=mode==='mid'?q.mid:mode==='close'?(l.ratio>0?q.bid:q.ask):(l.ratio>0?q.ask:q.bid);return v+l.ratio*price;},(p.stockRatio||0)*this.quote({symbol:p.symbol,asset:'stock'})[mode==='mid'?'mid':mode==='close'?'bid':'ask']));}
    packageRisk(p){
      if(!this.state.stocks[p.symbol]||!Array.isArray(p.legs)||p.legs.length<1||p.legs.length>4||![0,1].includes(p.stockRatio||0)||!p.legs.every(l=>['call','put'].includes(l.type)&&Number.isFinite(l.strike)&&l.strike>0&&Number.isInteger(l.ratio)&&l.ratio!==0&&Math.abs(l.ratio)<=2))throw Error('Use one to four valid option legs, optionally with 100 shares.');
      const slope=(p.stockRatio||0)+p.legs.filter(l=>l.type==='call').reduce((v,l)=>v+l.ratio,0);if(slope<0)throw Error('Uncovered call risk is not supported. Add a protective long call.');
      const intrinsic=price=>p.legs.reduce((v,l)=>v+l.ratio*Math.max(0,l.type==='call'?price-l.strike:l.strike-price),(p.stockRatio||0)*price);
      const points=[0,...p.legs.map(l=>l.strike)],values=points.map(intrinsic),entry=this.packageQuote(p),min=Math.min(...values),max=Math.max(...values);
      const roots=[];const sorted=[...new Set(points)].sort((a,b)=>a-b);sorted.push(sorted.at(-1)*2+Math.abs(entry)+1);
      for(let i=1;i<sorted.length;i++){const a=sorted[i-1],b=sorted[i],ya=intrinsic(a)-entry,yb=intrinsic(b)-entry;if(ya===0)roots.push(a);if(ya*yb<0)roots.push(a-ya*(b-a)/(yb-ya));}
      return {entry,collateral:round(Math.max(0,-min)*100),maxLoss:round(Math.max(0,entry-min)*100),maxProfit:slope>0?Infinity:round((max-entry)*100),breakevens:[...new Set(roots.map(round))]};
    }
    validatePackage(p){if(!Number.isInteger(p.qty)||p.qty<1||p.qty>50)throw Error('Enter 1–50 strategy units.');if(!Number.isFinite(p.expiry)||p.expiry<=this.state.clock)throw Error('Choose a future expiration.');const risk=this.packageRisk(p);if(risk.entry*100+1e-6 < -risk.collateral)throw Error('Quotes imply an invalid net credit. Choose different strikes.');if((risk.entry*100+risk.collateral)*p.qty>this.availableCash()+1e-6)throw Error('Insufficient available cash for premium and strategy collateral.');return risk;}
    placePackage(p){const risk=this.validatePackage(p);const position={id:this.id(),name:String(p.name||'Option strategy').slice(0,80),symbol:p.symbol,expiry:p.expiry,legs:p.legs.map(l=>({...l})),stockRatio:p.stockRatio||0,qty:p.qty,entry:risk.entry,collateral:risk.collateral};this.state.cash=round(this.state.cash-risk.entry*p.qty*100);this.state.packages.push(position);this.log('Opened '+position.name,`${p.symbol} · ${p.qty} units · ${risk.entry>=0?'debit':'credit'} $${Math.abs(risk.entry*p.qty*100).toFixed(2)} · all legs filled together`);this.save();return position;}
    closePackage(id){const p=this.state.packages.find(x=>x.id===id);if(!p)throw Error('Strategy position not found.');const price=this.packageQuote(p,'close'),cash=round(this.state.cash+price*p.qty*100);if(cash+1e-6<this.collateral()-p.collateral*p.qty)throw Error('Current closing spreads exceed available cash. Try again after quotes change.');this.state.cash=cash;this.state.packages=this.state.packages.filter(x=>x.id!==id);this.log('Closed '+p.name,`${p.symbol} · ${p.qty} units · realized P/L $${round((price-p.entry)*p.qty*100).toFixed(2)}`);this.save();}
    log(message,detail){this.state.activity.unshift({id:this.id(),time:this.state.clock,message,detail});this.state.activity=this.state.activity.slice(0,500);}
    random(){let x=this.state.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;this.state.rng=x>>>0;return (this.state.rng+.5)/4294967296;}
    fillRandom(){let x=(this.state.fillRng||0x15a4e35)>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;this.state.fillRng=x>>>0;return (this.state.fillRng+.5)/4294967296;}
    gaussian(){return Math.sqrt(-2*Math.log(this.random()))*Math.cos(2*Math.PI*this.random());}
    id(){this.state.sequence=(this.state.sequence||0)+1;return `${this.state.clock.toString(36)}-${this.state.sequence.toString(36)}`;}
    snapshot(){return JSON.parse(JSON.stringify(this.state));}
    restore(snapshot){if(!valid(snapshot))throw Error('Invalid checkpoint.');this.state=JSON.parse(JSON.stringify(snapshot));this.events=[];this.migrate();this.save();}
    reservedSell(a){const groups=new Map();for(const o of this.state.orders.filter(x=>x.side==='sell'&&this.key(x)===this.key(a))){const key=o.oco||o.id;groups.set(key,Math.max(groups.get(key)||0,o.qty));}return [...groups.values()].reduce((a,b)=>a+b,0);}
    placeBracket(a,qty,stop,target){
      const base={...a,side:'sell',qty,orderType:'stop',limit:stop,tif:'gtc'};this.validate(base);const q=this.quote(a);
      if(!Number.isFinite(target)||!Number.isFinite(stop)||stop<=0||stop>=q.bid||target<=q.ask)throw Error('Stop loss must be below the current bid; take profit must be above the current ask.');
      const oco=this.id(),created=this.state.clock;this.state.orders.push({...base,id:this.id(),oco,created},{...base,orderType:'limit',limit:target,id:this.id(),oco,created});this.log('Protective OCO exits placed',`${qty} ${this.label(a)} · stop $${stop.toFixed(2)} / target $${target.toFixed(2)} · first fill cancels paired order`);this.save();
    }
    validate(o){
      if(!this.state.stocks[o.symbol]||!['stock','option'].includes(o.asset)||!['buy','sell'].includes(o.side)||!['market','limit','stop','stop-limit','trailing'].includes(o.orderType)||!['gtc','ioc'].includes(o.tif))throw Error('Invalid order.');
      if(!Number.isSafeInteger(o.qty)||o.qty<1||o.qty>1000000)throw Error('Enter a whole quantity between 1 and 1,000,000.');
      if(o.asset==='option'&&(!['call','put'].includes(o.type)||!Number.isFinite(o.strike)||o.strike<=0||!Number.isFinite(o.expiry)||o.expiry<=this.state.clock))throw Error('Select an unexpired option from the chain.');
      if(!['market','trailing'].includes(o.orderType)&&(!Number.isFinite(o.limit)||o.limit<=0))throw Error('Enter a valid limit or stop price.');
      if(o.orderType==='stop-limit'&&(!Number.isFinite(o.trigger)||o.trigger<=0))throw Error('Enter a positive stop trigger.');
      if(o.orderType==='trailing'&&(o.side!=='sell'||!Number.isFinite(o.trail)||o.trail<.1||o.trail>=100))throw Error('Trailing stops require owned holdings, a sell action, and a distance from 0.1% to 99%.');
      const q=this.quote(o),mult=o.asset==='option'?100:1;
      if(o.side==='buy'&&this.availableCash()<(o.orderType==='limit'?o.limit:q.ask)*o.qty*mult)throw Error('Insufficient cash for this order.');
      if(o.side==='sell'){const p=this.state.positions.find(p=>this.key(p)===this.key(o));const reserved=this.reservedSell(o);if(!p||p.qty-reserved<o.qty)throw Error('Not enough unreserved holdings. This cash account supports selling owned shares or contracts.');}
    }
    place(order){this.validate(order);const o={...order,id:this.id(),created:this.state.clock};this.state.orders.push(o);this.log(`${o.side==='buy'?'Buy':'Sell'} order submitted`,`${o.qty} ${this.label(o)} · ${o.orderType.toUpperCase()}`);this.match(o);this.save();return o;}
    label(a){return a.asset==='option'?`${a.symbol} ${a.strike} ${a.type.toUpperCase()} ${new Date(a.expiry).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:a.symbol;}
    cancel(id,reason='Canceled'){const o=this.state.orders.find(x=>x.id===id);if(!o)return;this.state.orders=this.state.orders.filter(x=>x.id!==id);this.log(`${reason} order`,`${o.side.toUpperCase()} ${o.qty} ${this.label(o)}`);this.save();}
    match(o){
      if(!this.state.orders.some(x=>x.id===o.id))return;
      if(o.asset==='option'&&this.days(o)<=0){this.cancel(o.id,'Expired');return;}
      const q=this.quote(o),ref=o.side==='buy'?q.ask:q.bid;
      if(['stop','stop-limit'].includes(o.orderType)&&!o.triggered){const trigger=o.orderType==='stop-limit'?o.trigger:o.limit;o.triggered=o.side==='buy'?q.mid>=trigger:q.mid<=trigger;}
      if(o.orderType==='trailing'&&!o.triggered){o.highWater=Math.max(o.highWater||q.bid,q.bid);o.trigger=round(o.highWater*(1-o.trail/100));o.triggered=q.bid<=o.trigger;}
      const limited=['limit','stop-limit'].includes(o.orderType),withinLimit=o.side==='buy'?ref<=o.limit:ref>=o.limit;
      const executable=o.orderType==='market'||(['stop','trailing'].includes(o.orderType)&&o.triggered)||(limited&&withinLimit&&(o.orderType==='limit'||o.triggered));
      if(!executable){if(o.tif==='ioc')this.cancel(o.id,'Unfilled IOC');return;}
      const available=o.asset==='option'?Math.floor(5+this.fillRandom()*40):Math.floor(100+this.fillRandom()*1500);let fill=Math.min(o.qty,available),mult=o.asset==='option'?100:1;
      let price=ref;if(!limited)price=round(Math.max(0,ref+(o.side==='buy'?1:-1)*q.spread*.15*fill/available));
      const key=this.key(o);let p=this.state.positions.find(x=>this.key(x)===key);
      if(o.side==='buy')fill=Math.min(fill,Math.floor(this.availableCash()/Math.max(.01,price*mult)));else fill=Math.min(fill,p?.qty||0);
      if(fill<=0){this.cancel(o.id,'Insufficient funds or holdings for');return;}
      if(o.oco)for(const sibling of [...this.state.orders])if(sibling.id!==o.id&&sibling.oco===o.oco)this.cancel(sibling.id,'Paired OCO exit canceled for');
      if(o.side==='buy'){this.state.cash=round(this.state.cash-price*fill*mult);if(p){p.avg=(p.avg*p.qty+price*fill)/(p.qty+fill);p.qty+=fill;}else this.state.positions.push({symbol:o.symbol,asset:o.asset,type:o.type,strike:o.strike,expiry:o.expiry,qty:fill,avg:price});}else{this.state.cash=round(this.state.cash+price*fill*mult);p.qty-=fill;this.state.positions=this.state.positions.filter(x=>x.qty>0);}
      o.qty-=fill;this.log(`${o.side==='buy'?'Bought':'Sold'} ${fill} ${this.label(o)}`,`Filled at $${price.toFixed(2)} · ${o.qty?'Partial fill, '+o.qty+' remaining':'Complete'}`);this.events.push(`${o.side==='buy'?'Bought':'Sold'} ${fill} ${this.label(o)} at $${price.toFixed(2)}`);
      if(!o.qty)this.state.orders=this.state.orders.filter(x=>x.id!==o.id);else if(o.tif==='ioc')this.cancel(o.id,'Remaining IOC quantity canceled for');
    }
    step(minutes=1){
      const target=this.state.clock+minutes*60000,dt=minutes/(365*1440),sector=['NVDA','MU','AVGO','AMD','PLTR','MSFT','AMZN','GOOGL','META'],semis=['NVDA','MU','AVGO','AMD'];
      const macro=this.gaussian(),aiFactor=this.gaussian(),scenario=this.state.scenario;
      for(const s of Object.values(this.state.stocks)){
        const ai=sector.includes(s.symbol),chip=semis.includes(s.symbol),mu=scenario==='bull'?.35:scenario==='bear'?-.35:scenario==='ai-boom'?(chip?.9:ai?.5:.08):scenario==='ai-bust'?(chip?-.8:ai?-.4:-.1):.08;
        const daysToEarnings=Math.max(0,(s.earningsAt-this.state.clock)/86400000);s.vol=s.baseVol*(1+.55*Math.exp(-daysToEarnings/5));const sigma=s.baseVol*(scenario==='volatile'?1.8:1),o=s.price,path=[o];
        for(let j=0;j<4;j++){const z=.35*macro/2+(ai?.35*aiFactor/2:0)+Math.sqrt(ai?.755:.8775)*this.gaussian();s.price=Math.max(.05,s.price*Math.exp((mu-.5*sigma*sigma)*dt/4+sigma*Math.sqrt(dt/4)*z));path.push(s.price);}
        if(target>=s.earningsAt){const surprise=this.gaussian(),bias=scenario==='ai-boom'&&ai?.035:scenario==='ai-bust'&&ai?-.035:0,jump=Math.max(-.3,Math.min(.3,bias+surprise*(chip?.09:.05)));s.price*=Math.exp(jump);path.push(s.price);s.vol=s.baseVol*.85;s.earningsAt+=90*86400000;this.state.news.unshift({t:target,symbol:s.symbol,title:(['SPY','QQQ'].includes(s.symbol)?(jump>=0?'Index catalyst: improving growth expectations':'Index catalyst: growth expectations weaken'):(jump>=0?'Earnings beat: buyers reprice growth':'Earnings disappointment: expectations reset')),change:round((Math.exp(jump)-1)*100),detail:['SPY','QQQ'].includes(s.symbol)?'Synthetic macro event. ETF prices reflect broad market expectations.':'Synthetic earnings event. Implied volatility falls after the announcement.'});}
        s.price=round(s.price);const volume=Math.floor((500+this.random()*15000)*minutes);s.volume+=volume;s.history.push({t:target,p:s.price,o,h:round(Math.max(...path)),l:round(Math.min(...path)),v:volume});if(s.history.length>1440)s.history.shift();
        const day=Math.floor((target-1)/86400000),bar=s.daily.at(-1);if(!bar||bar.day!==day)s.daily.push({day,t:target,o,h:round(Math.max(...path)),l:round(Math.min(...path)),p:s.price,v:volume});else{bar.t=target;bar.h=Math.max(bar.h,...path);bar.l=Math.min(bar.l,...path);bar.p=s.price;bar.v+=volume;}if(s.daily.length>370)s.daily.shift();
      }
      this.state.clock=target;this.state.news=this.state.news.slice(0,30);this.settle();
      if(target-(this.state.equityHistory.at(-1)?.t||0)>=3600000){this.state.equityHistory.push({t:target,equity:round(this.totals().equity)});if(this.state.equityHistory.length>2200)this.state.equityHistory.shift();}
    }
    tick(){for(let minute=0;minute<this.state.speed;minute++)this.step(1);}
    async advance(minutes,onProgress=()=>{}){
      if(!Number.isFinite(minutes)||minutes<=0||minutes>366*1440)throw Error('Advance between one minute and 366 days.');
      const end=this.state.clock+Math.round(minutes*60000),start=this.state.clock;this.batch=true;let steps=0;
      try{while(this.state.clock<end){const boundaries=[...this.state.positions.filter(p=>p.asset==='option').map(p=>p.expiry),...this.state.packages.map(p=>p.expiry),...Object.values(this.state.stocks).map(s=>s.earningsAt)].filter(t=>t>this.state.clock);const next=Math.min(end,this.state.clock+3600000,...boundaries);this.step((next-this.state.clock)/60000);if(++steps%96===0){onProgress((this.state.clock-start)/(end-start));await new Promise(r=>setTimeout(r,0));}}onProgress(1);}finally{this.batch=false;this.save();}
    }
    settle(){
      for(const p of [...this.state.packages])if(p.expiry<=this.state.clock){const spot=this.state.stocks[p.symbol].price,value=p.legs.reduce((v,l)=>v+l.ratio*Math.max(0,l.type==='call'?spot-l.strike:l.strike-spot),(p.stockRatio||0)*spot)*p.qty*100;this.state.cash=round(this.state.cash+value);this.state.packages=this.state.packages.filter(x=>x.id!==p.id);this.log('Strategy expired · simulated cash settlement',`${p.name} · ${p.symbol} · $${round(value).toFixed(2)} settlement`);this.events.push(p.name+' expired and settled.');}
      for(const p of [...this.state.positions])if(p.asset==='option'&&p.expiry<=this.state.clock){const intrinsic=Math.max(0,p.type==='call'?this.state.stocks[p.symbol].price-p.strike:p.strike-this.state.stocks[p.symbol].price);const amount=round(intrinsic*p.qty*100);this.state.cash=round(this.state.cash+amount);this.state.positions=this.state.positions.filter(x=>x!==p);this.log('Option expired · simulated cash settlement',`${this.label(p)} · $${amount.toFixed(2)} credited`);this.events.push('Expired option settled at intrinsic value.');}
      for(const o of [...this.state.orders])this.match(o);
    }
  }
  root.Northstar={Market,option,SEEDS,round,KEY};if(typeof module!=='undefined')module.exports=root.Northstar;
})(typeof window!=='undefined'?window:globalThis);
