export const GAME_MODES=[
 {id:"quiz_party",name:"Quiz Party",emoji:"⚡",tag:"Classic questions",description:"Answer correctly and reach the top of the quiz leaderboard."},
 {id:"gold_quest",name:"Gold Quest",emoji:"💰",tag:"Treasure and luck",description:"Open a mystery chest after a correct answer. A rare bonus can challenge a rival."},
 {id:"crypto_hack",name:"Crypto Hack",emoji:"💻",tag:"Memory and logic",description:"Mine fictional credits or try a three-key puzzle against another player."},
 {id:"fishing_frenzy",name:"Fishing Frenzy",emoji:"🎣",tag:"Discovery and chance",description:"Choose your waters, catch fish, and accumulate virtual reward points."},
 {id:"cafe",name:"Café",emoji:"🍔",tag:"Virtual café management",description:"Serve customers to earn coins and level up your virtual café."}
] as const;
export type GameMode=typeof GAME_MODES[number]["id"];
export function gameModeName(id:unknown){return GAME_MODES.find(m=>m.id===id)?.name||"Quiz Party"}
export function isGameMode(id:unknown):id is GameMode{return GAME_MODES.some(m=>m.id===id)}
