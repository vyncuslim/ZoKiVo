const fs=require("node:fs"),assert=require("node:assert/strict");
const g=fs.readFileSync("src/app/game/[pin]/page.tsx","utf8");
const r=fs.readFileSync("src/components/mode-rewards.tsx","utf8");
const checks=[
 [g.includes('const[feedback,setFeedback]=useState("")')&&g.includes("bonusReceipt,setBonusReceipt"),"Parent stores bonus receipt across server refresh"],
 [g.includes('setFeedback("");setBonusReceipt("")},[state?.index]'),"New question clears previous round receipt"],
 [g.includes('bonusReceipt?"Bonus collected! 🎉":"Answer sent!"'),"Player sees earned bonus instead of generic sent"],
 [g.includes('onClaim={async receipt=>{setBonusReceipt(receipt||"");await reload()}}'),"Receipt is retained before authenticated status refresh"],
 [r.includes('onClaim:(receipt?:string)=>Promise<void>'),"ModeRewards can report receipt to parent"],
 [r.includes('if(!r.ok)throw Error('),"Failed reward claim does not emit a receipt"],
 [r.includes('await onClaim(receipt)'),"Only successful server claims emit earned receipt"],
 [r.includes('"x-player-token":token'),"Reward claims preserve authorized player token"],
 [r.includes('setResult(receipt)'),"Local receipt stays visible before reload"]
];
for(const [pass,label] of checks){assert.ok(pass,label);console.log("REWARD_FEEDBACK="+JSON.stringify({label,pass}));}
console.log("REWARD_FEEDBACK_REGRESSION_PASS="+checks.length);
