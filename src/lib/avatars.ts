/** Original ZoKivo emoji characters. */
export const AVATARS=[
 {id:"spark",symbol:"✨",label:"Spark",price:0},
 {id:"fox",symbol:"🦊",label:"Fox",price:0},
 {id:"turtle",symbol:"🐢",label:"Turtle",price:0},
 {id:"owl",symbol:"🦉",label:"Owl",price:0},
 {id:"robot",symbol:"🤖",label:"Robot",price:0},
 {id:"whale",symbol:"🐳",label:"Whale",price:0},
 {id:"rocket",symbol:"🚀",label:"Rocket",price:0},
 {id:"sun",symbol:"☀️",label:"Sun",price:0},
 {id:"nebula",symbol:"🌌",label:"Nebula",price:4},
 {id:"phoenix",symbol:"🔥",label:"Phoenix",price:5},
 {id:"blossom",symbol:"🌸",label:"Blossom",price:6},
 {id:"crystal",symbol:"💎",label:"Crystal",price:8}
] as const;
export type AvatarId=typeof AVATARS[number]["id"];
export function avatarInfo(id:unknown){return AVATARS.find(a=>a.id===id)}
export function avatarId(value:unknown):AvatarId{return avatarInfo(value)?.id||"spark"}
export function avatarSymbol(value:unknown):string{return avatarInfo(value)?.symbol||"✨"}
