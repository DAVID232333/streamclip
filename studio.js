(() => {
"use strict";
const get = id => document.getElementById(id);
const captions = {
 general: ["nah what just happened", "had to watch that twice", "this caught me off guard"],
 fail: ["generational fumble", "all that for what 😭", "bro had one job"],
 chase: ["they were not letting bro go", "nah he was cooked", "that escape plan needs work"],
 npc: ["these npcs have too much freedom", "npc lore getting out of hand", "why did bro do that"],
 detail: ["rockstar really put that in the game?", "the little details are crazy", "never noticed this before"],
 rage: ["valid crash out ngl", "i'd be mad too", "bro had enough"]
};
const fields = ["vahTik","vahIG","vahX"];
const checks = [...get("vahChecks").querySelectorAll("input")];
function duration() {
 const start=Number(get("start").value),end=Number(get("end").value),total=get("video").duration;
 return Number.isFinite(total)&&start>=0&&end>start&&end<=total+0.1?Math.min(end,total)-start:0;
}
function review() {
 const seconds=duration();
 const complete=checks.every(c=>c.checked)&&get("vahSource").value.trim()&&get("vahMoment").value.trim()&&fields.every(id=>get(id).value.trim())&&seconds>0;
 get("vahSave").disabled=!complete;
 get("vahStatus").textContent=(complete?"Review checklist complete. ":"Review incomplete. ")+(seconds>60?"Selected range exceeds one minute; verify the actual export.":"Selected range does not exceed one minute; TikTok rewards length may not qualify.")+" Eligibility is not guaranteed.";
}
get("vahGenerate").addEventListener("click",()=>{
 if(!get("vahMoment").value.trim()){get("vahStatus").textContent="Describe the clip first.";return;}
 const ideas=captions[get("vahType").value]||captions.general;
 const offset=Math.floor(Math.random()*ideas.length);
 fields.forEach((id,i)=>{get(id).value=ideas[(offset+i)%ideas.length]+(i===0?" #gta6 #gtavi":"");});
 checks.find(c=>c.value==="review").checked=false;review();
});
for(const id of ["vahSource","vahMoment","vahType",...fields,"start","end"]){
 get(id).addEventListener("input",()=>{checks.find(c=>c.value==="review").checked=false;review();});
}
checks.forEach(c=>c.addEventListener("change",review));
get("file").addEventListener("change",()=>{checks.forEach(c=>c.checked=false);review();});
get("video").addEventListener("loadedmetadata",review);
get("vahSave").addEventListener("click",()=>{
 review();if(get("vahSave").disabled)return;
 const brief={source:get("vahSource").value,moment:get("vahMoment").value,range:{start:Number(get("start").value),end:Number(get("end").value)},captions:Object.fromEntries(fields.map((id,i)=>[["TikTok","Instagram","X"][i],get(id).value])),reviewedAt:new Date().toISOString(),attestations:checks.map(c=>c.value)};
 const url=URL.createObjectURL(new Blob([JSON.stringify(brief,null,2)],{type:"application/json"}));
 const link=document.createElement("a");link.href=url;link.download="vah-post-brief.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
review();
})();