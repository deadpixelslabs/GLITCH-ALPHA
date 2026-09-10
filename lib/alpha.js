const CHAIN_ID=4663;
const NETWORK="robinhood";
const RPC=process.env.RH_RPC_URL||"https://rpc.mainnet.chain.robinhood.com/";
const BLOCKSCOUT="https://robinhoodchain.blockscout.com";
const DEX="https://api.dexscreener.com";
const GECKO="https://api.geckoterminal.com/api/v2";
const WETH="0x0bd7d308f8e1639fab988df18a8011f41eacad73";
const USDG="0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const GLITCH="0xaeca11ad61d76f7c2d6b1100d3ca9066fbdb8459";
const TRANSFER_TOPIC="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC="0x"+"0".repeat(64);
const QUOTE_TOKENS=new Set([WETH,USDG,"0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","0x0000000000000000000000000000000000000000"]);
const HTTP_CACHE=new Map();

function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d;}
function clamp(x,a=0,b=100){return Math.max(a,Math.min(b,x));}
function addr(v){return /^0x[a-fA-F0-9]{40}$/.test(String(v||""));}
function lower(v){return String(v||"").toLowerCase();}
function hexNum(v){try{return Number(BigInt(v||"0x0"));}catch{return 0;}}
function safeBig(v){try{return BigInt(String(v||"0"));}catch{return 0n;}}
function pctBig(a,b){if(!b||b<=0n)return null;return Number((a*1000000n)/b)/10000;}
function ageSec(ts){const t=typeof ts==="number"?ts:(Date.parse(ts||"")/1000);return Number.isFinite(t)?Math.max(0,Math.floor(Date.now()/1000-t)):null;}
function shortAddress(a){return addr(a)?`${a.slice(0,6)}…${a.slice(-4)}`:String(a||"");}

async function fetchJson(url,timeout=9000,headers={}){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const r=await fetch(url,{headers:{accept:"application/json","user-agent":"dead-pixels-glitch-alpha/3.7",...headers},signal:ctrl.signal});
    const text=await r.text();let body={};try{body=text?JSON.parse(text):{};}catch{throw new Error(`INVALID_JSON_${r.status}`);}
    if(!r.ok)throw new Error(body?.message||body?.error||`HTTP_${r.status}`);return body;
  }finally{clearTimeout(timer);}
}
async function cachedJson(url,ttl=55000,timeout=9000,headers={}){
  const now=Date.now(),hit=HTTP_CACHE.get(url);if(hit&&now-hit.at<ttl)return hit.value;
  const value=await fetchJson(url,timeout,headers);HTTP_CACHE.set(url,{at:now,value});
  if(HTTP_CACHE.size>120){const oldest=[...HTTP_CACHE.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,30);oldest.forEach(([k])=>HTTP_CACHE.delete(k));}
  return value;
}
async function rpc(method,params){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),9000);
  try{
    const r=await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:ctrl.signal});
    const j=await r.json();if(j.error)throw new Error(j.error.message||"RPC_ERROR");return j.result;
  }finally{clearTimeout(timer);}
}
async function call(to,data){return rpc("eth_call",[{to,data},"latest"]);}
function decodeString(hex){
  if(!hex||hex==="0x")return "";const s=hex.slice(2);
  try{
    if(s.length===64)return Buffer.from(s.replace(/(00)+$/,""),"hex").toString("utf8").replace(/\0/g,"").trim();
    if(s.length>=128){const off=Number(BigInt("0x"+s.slice(0,64)))*2;const len=Number(BigInt("0x"+s.slice(off,off+64)));return Buffer.from(s.slice(off+64,off+64+len*2),"hex").toString("utf8").replace(/\0/g,"").trim();}
  }catch{}return "";
}
function decodeAddress(hex){if(!hex||hex.length<42)return null;const a="0x"+hex.slice(-40);return addr(a)&&!/^0x0{40}$/i.test(a)?a:null;}
async function tokenMeta(address){
  if(!addr(address))throw new Error("INVALID_TOKEN");
  const [d,s,nm,ts,own]=await Promise.allSettled([
    call(address,"0x313ce567"),call(address,"0x95d89b41"),call(address,"0x06fdde03"),call(address,"0x18160ddd"),call(address,"0x8da5cb5b")
  ]);
  if(d.status!=="fulfilled")throw new Error("NOT_ERC20");
  const decimals=hexNum(d.value);if(decimals<0||decimals>255)throw new Error("INVALID_DECIMALS");
  return {address,symbol:s.status==="fulfilled"?(decodeString(s.value)||"TOKEN"):"TOKEN",name:nm.status==="fulfilled"?(decodeString(nm.value)||"ERC20"):"ERC20",decimals,totalSupplyRaw:ts.status==="fulfilled"?safeBig(ts.value).toString():null,owner:own.status==="fulfilled"?decodeAddress(own.value):null};
}

function gtToken(rel,included){
  const id=rel?.data?.id;if(!id)return null;const x=included.get(id);const a=x?.attributes||{};const address=lower(a.address||id.slice(id.indexOf("_")+1));
  return {address,name:a.name||"Token",symbol:a.symbol||"TOKEN",decimals:n(a.decimals,18),imageUrl:a.image_url||null};
}
function scorePool(p){
  const liq=Math.max(0,n(p.liquidityUsd));const vol=Math.max(0,n(p.volume?.h24));const h1=n(p.priceChange?.h1),m5=n(p.priceChange?.m5);
  const tx=p.txns?.h1||{};const buys=n(tx.buys),sells=n(tx.sells),total=buys+sells;
  const momentum=clamp(50+h1*2.2+m5*1.2);
  const liquidity=clamp((Math.log10(liq+1)-2)*28);
  const activity=clamp((Math.log10(vol+1)-2)*25);
  const flow=total?clamp(50+(buys-sells)/total*45):45;
  const novelty=p.ageSeconds==null?50:clamp(100-(Math.log10(p.ageSeconds+10)-1)*22,15,100);
  const score=Math.round(momentum*.22+liquidity*.23+activity*.23+flow*.18+novelty*.14);
  return {score,components:{momentum:Math.round(momentum),liquidity:Math.round(liquidity),activity:Math.round(activity),flow:Math.round(flow),novelty:Math.round(novelty)},verdict:score>=88?"ALPHA":score>=75?"HOT":score>=60?"ACTIVE":score>=40?"WATCH":"COLD"};
}
function normalizeDex(p){
  if(!p||lower(p.chainId)!==NETWORK)return null;
  const base={...p.baseToken,address:lower(p.baseToken?.address)},quote={...p.quoteToken,address:lower(p.quoteToken?.address)};
  const target=QUOTE_TOKENS.has(base.address)&&!QUOTE_TOKENS.has(quote.address)?quote:base;const isBase=target.address===base.address;
  const baseUsd=n(p.priceUsd),baseNative=n(p.priceNative);const priceUsd=isBase?baseUsd:(baseUsd>0&&baseNative>0?baseUsd/baseNative:0);
  const changes=isBase?(p.priceChange||{}):Object.fromEntries(Object.entries(p.priceChange||{}).map(([k,v])=>[k,-n(v)]));
  const txns=isBase?(p.txns||{}):Object.fromEntries(Object.entries(p.txns||{}).map(([k,v])=>[k,{...v,buys:n(v?.sells),sells:n(v?.buys),buyers:n(v?.sellers),sellers:n(v?.buyers)}]));
  const x={source:"DEXSCREENER",address:target.address,symbol:target.symbol||"TOKEN",name:target.name||target.symbol||"Token",imageUrl:p.info?.imageUrl||null,pairAddress:lower(p.pairAddress),dexId:p.dexId||"DEX",labels:p.labels||[],quoteSymbol:isBase?quote.symbol:base.symbol,priceUsd,priceNative:isBase?baseNative:(baseNative>0?1/baseNative:0),liquidityUsd:n(p.liquidity?.usd),fdv:isBase?n(p.fdv):0,marketCap:isBase?n(p.marketCap):0,pairCreatedAt:p.pairCreatedAt||null,ageSeconds:p.pairCreatedAt?Math.max(0,Math.floor(Date.now()/1000-p.pairCreatedAt/1000)):null,volume:p.volume||{},priceChange:changes,txns,boosts:n(p.boosts?.active),websites:p.info?.websites||[],socials:p.info?.socials||[],url:p.url||null};
  x.glitch=scorePool(x);return x;
}
function normalizeGT(r,included){
  if(!r)return null;const a=r.attributes||{},rels=r.relationships||{};const base=gtToken(rels.base_token,included),quote=gtToken(rels.quote_token,included);if(!base||!quote)return null;
  const target=QUOTE_TOKENS.has(base.address)&&!QUOTE_TOKENS.has(quote.address)?quote:base;
  const isBase=target.address===base.address;const poolAddress=lower(a.address||String(r.id||"").slice(String(r.id||"").indexOf("_")+1));
  const tx=a.transactions||{};
  const x={source:"GECKOTERMINAL",address:target.address,symbol:target.symbol,name:target.name,imageUrl:target.imageUrl,pairAddress:poolAddress,dexId:String(rels.dex?.data?.id||"DEX").replace(`${NETWORK}_`,""),quoteSymbol:isBase?quote.symbol:base.symbol,priceUsd:n(isBase?a.base_token_price_usd:a.quote_token_price_usd),priceNative:n(isBase?a.base_token_price_native_currency:a.quote_token_price_native_currency),liquidityUsd:n(a.reserve_in_usd),fdv:n(isBase?a.fdv_usd:null),marketCap:n(isBase?a.market_cap_usd:null),pairCreatedAt:a.pool_created_at||null,ageSeconds:ageSec(a.pool_created_at),volume:a.volume_usd||{},priceChange:a.price_change_percentage||{},txns:tx,url:null};x.glitch=scorePool(x);return x;
}
async function geckoPools(kind="trending_pools"){
  const path=kind==="pools"?`/networks/${NETWORK}/pools`:`/networks/${NETWORK}/${kind}`;
  const j=await cachedJson(`${GECKO}${path}?include=base_token,quote_token,dex&page=1`,55000,9000,{accept:"application/json;version=20230203"});
  const inc=new Map((j.included||[]).map(x=>[x.id,x]));return (j.data||[]).map(x=>normalizeGT(x,inc)).filter(Boolean);
}
async function dexSearch(q){const j=await fetchJson(`${DEX}/latest/dex/search?q=${encodeURIComponent(q)}`);return (j.pairs||[]).map(normalizeDex).filter(Boolean);}
async function dexPairs(address){if(!addr(address))return[];const j=await fetchJson(`${DEX}/token-pairs/v1/${NETWORK}/${address}`);const raw=Array.isArray(j)?j:(j.pairs||[]);return raw.map(normalizeDex).filter(Boolean);}
async function dexMulti(addresses){const xs=[...new Set(addresses.map(lower).filter(addr))].slice(0,30);if(!xs.length)return[];const j=await fetchJson(`${DEX}/tokens/v1/${NETWORK}/${xs.join(",")}`);const raw=Array.isArray(j)?j:(j.pairs||[]);return raw.map(normalizeDex).filter(Boolean);}
async function blockSearch(q){const j=await fetchJson(`${BLOCKSCOUT}/api/v2/search?q=${encodeURIComponent(q)}`);return (j.items||[]).filter(x=>x.type==="token"&&x.token_type==="ERC-20").map(x=>({source:"BLOCKSCOUT",address:lower(x.address_hash||x.address),symbol:x.symbol||"TOKEN",name:x.name||x.symbol||"Token",imageUrl:x.icon_url||null,holders:n(x.holders_count||x.holders),marketCap:n(x.circulating_market_cap),verified:!!x.is_smart_contract_verified,glitch:{score:0,verdict:"UNPRICED",components:{}}})).filter(x=>addr(x.address));}
function mergePools(...groups){
  const map=new Map();for(const p of groups.flat()){if(!p||!addr(p.address))continue;const k=`${p.address}:${p.pairAddress||"token"}`;const old=map.get(k);if(!old||n(p.liquidityUsd)>n(old.liquidityUsd))map.set(k,{...old,...p});}
  return [...map.values()];
}
function sortFeed(items,mode="score"){
  const a=[...items];
  const fn=mode==="new"?(x=>x.ageSeconds??1e15):mode==="gainers"?(x=>-n(x.priceChange?.h24)):mode==="volume"?(x=>-n(x.volume?.h24)):mode==="liquidity"?(x=>-n(x.liquidityUsd)):(x=>-n(x.glitch?.score));
  return a.sort((x,y)=>fn(x)-fn(y));
}
async function overview(){
  const settled=await Promise.allSettled([geckoPools("trending_pools"),geckoPools("new_pools"),geckoPools("pools")]);
  const names=["GECKO_TRENDING","GECKO_NEW","GECKO_TOP"];const sources={};const groups=[];
  settled.forEach((s,i)=>{sources[names[i]]=s.status==="fulfilled"?"ONLINE":`ERROR: ${s.reason?.message||"FAILED"}`;if(s.status==="fulfilled")groups.push(s.value);});
  const merged=mergePools(...groups);return {chainId:CHAIN_ID,network:NETWORK,generatedAt:new Date().toISOString(),sources,count:merged.length,trending:sortFeed(merged,"score").slice(0,40),newest:sortFeed(groups[1]||[],"new").slice(0,40),gainers:sortFeed(merged,"gainers").slice(0,40),volume:sortFeed(merged,"volume").slice(0,40)};
}
async function catalog(){
  const j=await fetchJson(`${BLOCKSCOUT}/api/v2/tokens?type=ERC-20`);const raw=(j.items||[]).filter(x=>String(x.type||"").toUpperCase()==="ERC-20").slice(0,50);
  const tokens=raw.map(x=>({source:"BLOCKSCOUT",address:lower(x.address||x.address_hash),symbol:x.symbol||"TOKEN",name:x.name||x.symbol||"Token",imageUrl:x.icon_url||null,holders:n(x.holders||x.holders_count),marketCap:n(x.circulating_market_cap),priceUsd:n(x.exchange_rate),glitch:{score:0,verdict:"UNPRICED",components:{}}})).filter(x=>addr(x.address));
  const chunks=[];for(let i=0;i<tokens.length;i+=30)chunks.push(tokens.slice(i,i+30).map(x=>x.address));const ms=await Promise.allSettled(chunks.map(dexMulti));const markets=ms.flatMap(x=>x.status==="fulfilled"?x.value:[]);const best=new Map();for(const m of markets){const o=best.get(m.address);if(!o||m.liquidityUsd>o.liquidityUsd)best.set(m.address,m);}
  const items=tokens.map(t=>best.has(t.address)?{...t,...best.get(t.address),holders:t.holders||null,imageUrl:best.get(t.address).imageUrl||t.imageUrl}:t);return {items:sortFeed(items,"score"),count:items.length,source:"BLOCKSCOUT+DEXSCREENER"};
}
async function search(q){
  const term=String(q||"").trim();if(!term)return {items:[]};
  const settled=await Promise.allSettled([dexSearch(term),blockSearch(term)]);let dex=[],bs=[];if(settled[0].status==="fulfilled")dex=settled[0].value;if(settled[1].status==="fulfilled")bs=settled[1].value;
  const bestByToken=new Map();for(const p of dex){const old=bestByToken.get(p.address);if(!old||p.liquidityUsd>old.liquidityUsd)bestByToken.set(p.address,p);}for(const t of bs){if(!bestByToken.has(t.address))bestByToken.set(t.address,t);else{const x=bestByToken.get(t.address);x.verified=t.verified;x.holders=t.holders;x.imageUrl=x.imageUrl||t.imageUrl;}}
  return {query:term,items:sortFeed([...bestByToken.values()],"score").slice(0,60),sources:{DEXSCREENER:settled[0].status==="fulfilled"?"ONLINE":"ERROR",BLOCKSCOUT:settled[1].status==="fulfilled"?"ONLINE":"ERROR"}};
}
async function recentMintSignals(blocks=120){
  const latest=hexNum(await rpc("eth_blockNumber",[]));const from=Math.max(0,latest-Math.max(10,Math.min(500,n(blocks,120))));
  const logs=await rpc("eth_getLogs",[{fromBlock:"0x"+from.toString(16),toBlock:"latest",topics:[TRANSFER_TOPIC,ZERO_TOPIC]}]);
  const seen=new Map();for(const l of logs||[]){const a=lower(l.address);if(!addr(a)||QUOTE_TOKENS.has(a))continue;const bn=hexNum(l.blockNumber);const old=seen.get(a);if(!old||bn>old.blockNumber)seen.set(a,{address:a,blockNumber:bn,txHash:l.transactionHash});}
  let sig=[...seen.values()].sort((a,b)=>b.blockNumber-a.blockNumber).slice(0,20);if(!sig.length)return {latestBlock:latest,fromBlock:from,items:[]};
  const blockNums=[...new Set(sig.map(x=>x.blockNumber))].slice(0,12);const blockSettled=await Promise.allSettled(blockNums.map(b=>rpc("eth_getBlockByNumber",["0x"+b.toString(16),false])));const bt=new Map();blockSettled.forEach((x,i)=>{if(x.status==="fulfilled")bt.set(blockNums[i],hexNum(x.value?.timestamp));});
  const metaSettled=await Promise.allSettled(sig.map(x=>tokenMeta(x.address)));const markets=await dexMulti(sig.map(x=>x.address)).catch(()=>[]);const mMap=new Map();for(const p of markets){const old=mMap.get(p.address);if(!old||p.liquidityUsd>old.liquidityUsd)mMap.set(p.address,p);}
  sig=sig.map((x,i)=>{const meta=metaSettled[i].status==="fulfilled"?metaSettled[i].value:null;if(!meta)return null;const market=mMap.get(x.address);const ts=bt.get(x.blockNumber);const z={...market,...meta,address:x.address,source:market?"ONCHAIN+DEXSCREENER":"ONCHAIN",signal:"ZERO_ADDRESS_MINT",blockNumber:x.blockNumber,txHash:x.txHash,ageSeconds:ts?Math.max(0,Math.floor(Date.now()/1000-ts)):null};if(!z.glitch)z.glitch=scorePool(z);return z;}).filter(Boolean);
  return {latestBlock:latest,fromBlock:from,items:sig};
}
async function justBorn(){
  const [onchain,newPools]=await Promise.allSettled([recentMintSignals(120),geckoPools("new_pools")]);const oc=onchain.status==="fulfilled"?onchain.value:{items:[]};const np=newPools.status==="fulfilled"?newPools.value:[];
  const by=new Map();for(const x of [...oc.items,...np]){const old=by.get(x.address);if(!old)by.set(x.address,x);else by.set(x.address,{...x,...old,imageUrl:old.imageUrl||x.imageUrl,pairAddress:old.pairAddress||x.pairAddress,liquidityUsd:Math.max(n(old.liquidityUsd),n(x.liquidityUsd)),glitch:n(old.glitch?.score)>=n(x.glitch?.score)?old.glitch:x.glitch});}
  return {generatedAt:new Date().toISOString(),latestBlock:oc.latestBlock||null,fromBlock:oc.fromBlock||null,items:[...by.values()].sort((a,b)=>(a.ageSeconds??1e15)-(b.ageSeconds??1e15)).slice(0,50),sources:{ONCHAIN:onchain.status==="fulfilled"?"ONLINE":"ERROR",GECKO_NEW:newPools.status==="fulfilled"?"ONLINE":"ERROR"}};
}
async function getBlockscoutDetail(address){
  const urls=[`${BLOCKSCOUT}/api/v2/addresses/${address}`,`${BLOCKSCOUT}/api/v2/tokens/${address}/counters`,`${BLOCKSCOUT}/api/v2/tokens/${address}/holders`,`${BLOCKSCOUT}/api?module=contract&action=getsourcecode&address=${address}`];
  const s=await Promise.allSettled(urls.map(u=>fetchJson(u,9000)));return {address:s[0].status==="fulfilled"?s[0].value:null,counters:s[1].status==="fulfilled"?s[1].value:null,holders:s[2].status==="fulfilled"?s[2].value:null,source:s[3].status==="fulfilled"?s[3].value:null};
}
function abiSignals(src){
  const first=Array.isArray(src?.result)?src.result[0]:src?.result;let abi=[];try{abi=typeof first?.ABI==="string"?JSON.parse(first.ABI):Array.isArray(first?.ABI)?first.ABI:[];}catch{}
  const names=abi.filter(x=>x.type==="function").map(x=>String(x.name||"").toLowerCase());const has=re=>names.some(x=>re.test(x));
  return {verified:src?.status==="1"&&!!first,proxy:String(first?.Proxy||"0")==="1"||!!first?.Implementation,mintEntrypoint:has(/mint/),blacklistEntrypoint:has(/blacklist|denylist|blocklist/),pauseEntrypoint:has(/^pause$|^unpause$|setpause|pausetrading/),taxEntrypoint:has(/tax|fee/),maxTxEntrypoint:has(/maxtx|maxwallet|limits/),ownershipEntrypoint:has(/transferownership|renounceownership/),functionCount:names.length,contractName:first?.ContractName||null,implementation:first?.Implementation||null};
}
function holderStats(holderBody,totalSupplyRaw,creator,pairAddresses=[]){
  const total=safeBig(totalSupplyRaw);const excluded=new Set(["0x0000000000000000000000000000000000000000","0x000000000000000000000000000000000000dead",...pairAddresses.map(lower)]);const raw=(holderBody?.items||[]).map(x=>({address:lower(typeof x.address_hash==="string"?x.address_hash:x.address_hash?.hash),valueRaw:String(x.value||"0")})).filter(x=>addr(x.address));
  const circulating=raw.filter(x=>!excluded.has(x.address));const top10=circulating.slice(0,10).reduce((a,x)=>a+safeBig(x.valueRaw),0n);const top20=circulating.slice(0,20).reduce((a,x)=>a+safeBig(x.valueRaw),0n);const creatorItem=raw.find(x=>x.address===lower(creator));
  return {top10Pct:pctBig(top10,total),top20Pct:pctBig(top20,total),creatorPct:creatorItem?pctBig(safeBig(creatorItem.valueRaw),total):null,top:raw.slice(0,20).map(x=>({...x,pct:pctBig(safeBig(x.valueRaw),total)}))};
}
function riskModel(market,sec,holders,age){
  let r=0;const flags=[];const add=(v,msg)=>{r+=v;flags.push(msg);};
  if(!sec.verified)add(12,"CONTRACT UNVERIFIED");if(sec.proxy)add(5,"PROXY / IMPLEMENTATION");if(sec.mintEntrypoint)add(9,"MINT ENTRYPOINT PRESENT");if(sec.blacklistEntrypoint)add(16,"BLACKLIST-LIKE ENTRYPOINT");if(sec.pauseEntrypoint)add(7,"PAUSE ENTRYPOINT");if(sec.taxEntrypoint)add(5,"FEE/TAX ENTRYPOINT");
  const t10=n(holders.top10Pct,-1);if(t10>=80)add(30,"TOP 10 EXTREME CONCENTRATION");else if(t10>=60)add(22,"TOP 10 HIGH CONCENTRATION");else if(t10>=40)add(12,"TOP 10 CONCENTRATION");
  const cp=n(holders.creatorPct,-1);if(cp>=20)add(22,"CREATOR HOLDS ≥20%");else if(cp>=10)add(12,"CREATOR HOLDS ≥10%");
  const liq=n(market?.liquidityUsd);if(market&&liq<3000)add(18,"VERY LOW LIQUIDITY");else if(market&&liq<10000)add(10,"LOW LIQUIDITY");
  const h1=market?.txns?.h1||{};if(n(h1.buys)>=5&&n(h1.sells)===0)add(12,"NO RECENT SELLS OBSERVED");
  if(age!=null&&age<600)add(5,"EXTREMELY NEW MARKET");
  const score=clamp(Math.round(r));return {score,level:score>=75?"EXTREME":score>=55?"HIGH":score>=30?"MEDIUM":"LOW",flags:flags.slice(0,8),note:"Signal-based risk model; not a guarantee of safety or sellability."};
}
async function getTrades(pool){
  if(!addr(pool))return[];try{const j=await cachedJson(`${GECKO}/networks/${NETWORK}/pools/${pool}/trades`,15000,9000,{accept:"application/json;version=20230203"});return (j.data||[]).slice(0,50).map(x=>{const a=x.attributes||{};return {txHash:a.tx_hash||null,wallet:a.tx_from_address||null,kind:String(a.kind||"").toUpperCase(),volumeUsd:n(a.volume_in_usd),fromAmount:n(a.from_token_amount),toAmount:n(a.to_token_amount),timestamp:a.block_timestamp||a.timestamp||null};});}catch{return[];}
}
async function detail(address){
  const a=lower(address);if(!addr(a))throw new Error("INVALID_ADDRESS");
  const [dexS,gtS,bsS,metaS]=await Promise.allSettled([dexPairs(a),cachedJson(`${GECKO}/networks/${NETWORK}/tokens/${a}/pools?include=base_token,quote_token,dex&page=1`,30000,9000,{accept:"application/json;version=20230203"}),getBlockscoutDetail(a),tokenMeta(a)]);
  const dex=dexS.status==="fulfilled"?dexS.value:[];let gt=[];if(gtS.status==="fulfilled"){const inc=new Map((gtS.value.included||[]).map(x=>[x.id,x]));gt=(gtS.value.data||[]).map(x=>normalizeGT(x,inc)).filter(Boolean);}
  const pools=mergePools(dex,gt).sort((x,y)=>n(y.liquidityUsd)-n(x.liquidityUsd));const market=pools[0]||null;const bs=bsS.status==="fulfilled"?bsS.value:{};const meta=metaS.status==="fulfilled"?metaS.value:{address:a,symbol:market?.symbol||"TOKEN",name:market?.name||"ERC20",decimals:18,totalSupplyRaw:bs?.address?.token?.total_supply||null,owner:null};
  if(!meta.totalSupplyRaw&&bs?.address?.token?.total_supply)meta.totalSupplyRaw=String(bs.address.token.total_supply);
  const creator=bs?.address?.creator_address_hash||null;const sec=abiSignals(bs?.source);if(meta.owner)sec.owner=meta.owner;
  const hs=holderStats(bs?.holders,meta.totalSupplyRaw,creator,pools.map(x=>x.pairAddress).filter(Boolean));const holdersCount=n(bs?.counters?.token_holders_count||bs?.address?.token?.holders_count);
  const createdAt=market?.pairCreatedAt||null;const age=market?.ageSeconds??null;const risk=riskModel(market,sec,hs,age);
  const gl=market?scorePool(market):{score:0,verdict:"UNPRICED",components:{momentum:0,liquidity:0,activity:0,flow:0,novelty:0}};gl.score=clamp(Math.round(gl.score*(1-risk.score/180)));gl.riskAdjusted=true;
  const trades=await getTrades(market?.pairAddress);
  const whaleThreshold=Math.max(1000,n(market?.liquidityUsd)*.01);const whales=trades.filter(x=>x.volumeUsd>=whaleThreshold).slice(0,20);
  const sourcePrices=[...new Map(pools.filter(x=>n(x.priceUsd)>0).map(x=>[x.source,n(x.priceUsd)])).entries()].map(([source,price])=>({source,price}));let consensus=null;if(sourcePrices.length>=2){const vals=sourcePrices.map(x=>x.price);const avg=vals.reduce((a,b)=>a+b,0)/vals.length;const spread=(Math.max(...vals)-Math.min(...vals))/avg*100;consensus={sources:sourcePrices,spreadPct:spread,level:spread<.5?"HIGH":spread<2?"MEDIUM":"LOW"};}
  return {chainId:CHAIN_ID,address:a,meta:{...meta,imageUrl:market?.imageUrl||bs?.address?.token?.icon_url||null},market,pools:pools.slice(0,12),holders:{count:holdersCount,...hs},security:sec,risk,glitch:gl,deployer:{address:creator,creationTx:bs?.address?.creation_transaction_hash||null},trades,whales,whaleThreshold,consensus,sources:{DEXSCREENER:dexS.status==="fulfilled"?"ONLINE":"ERROR",GECKOTERMINAL:gtS.status==="fulfilled"?"ONLINE":"ERROR",BLOCKSCOUT:bsS.status==="fulfilled"?"ONLINE":"ERROR",RPC:metaS.status==="fulfilled"?"ONLINE":"ERROR"},generatedAt:new Date().toISOString()};
}
async function ohlcv(pool,timeframe="minute"){
  if(!addr(pool))throw new Error("INVALID_POOL");const tf=["minute","hour","day"].includes(timeframe)?timeframe:"minute";
  const j=await cachedJson(`${GECKO}/networks/${NETWORK}/pools/${pool}/ohlcv/${tf}?aggregate=1&limit=180&currency=usd&token=base`,55000,9000,{accept:"application/json;version=20230203"});
  const list=j?.data?.attributes?.ohlcv_list||[];return {pool,timeframe,items:list.map(x=>({t:x[0],o:n(x[1]),h:n(x[2]),l:n(x[3]),c:n(x[4]),v:n(x[5])})).reverse()};
}
async function status(){let latest=null;try{latest=hexNum(await rpc("eth_blockNumber",[]));}catch{}return {chainId:CHAIN_ID,network:NETWORK,latestBlock:latest,rpc:RPC.includes("alchemy")?"PROVIDER":"PUBLIC",generatedAt:new Date().toISOString()};}
module.exports={overview,catalog,search,justBorn,detail,ohlcv,status,recentMintSignals,scorePool,CHAIN_ID,NETWORK,GLITCH};
