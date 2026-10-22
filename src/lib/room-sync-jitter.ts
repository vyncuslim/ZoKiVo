/** Deterministic jitter prevents a 1,000-player classroom refresh stampede.
 * This is traffic shaping only; NEVER use for authorization or security.
 */
export function roomJitterMs(identity:string,windowMs=700):number{
 if(!Number.isFinite(windowMs)||windowMs<=0)return 0;
 let hash=2166136261;
 for(let i=0;i<identity.length;i++){
  hash^=identity.charCodeAt(i);
  hash=Math.imul(hash,16777619);
 }
 return (hash>>>0)%Math.max(1,Math.floor(windowMs));
}
