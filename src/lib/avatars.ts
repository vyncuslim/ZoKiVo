/** Original ZoKivo emoji avatars. No imported Blooket character art. */
export const AVATARS=[
 {id:"spark",symbol:"✨",label:"Spark"},
 {id:"fox",symbol:"🦊",label:"Fox"},
 {id:"turtle",symbol:"🐢",label:"Turtle"},
 {id:"owl",symbol:"🦉",label:"Owl"},
 {id:"robot",symbol:"🤖",label:"Robot"},
 {id:"whale",symbol:"🐳",label:"Whale"},
 {id:"rocket",symbol:"🚀",label:"Rocket"},
 {id:"sun",symbol:"☀️",label:"Sun"}
] as const;
export type AvatarId=typeof AVATARS[number]["id"];
export function avatarId(value:unknown):AvatarId{
 return AVATARS.find(a=>a.id===value)?.id||"spark";
}
export function avatarSymbol(value:unknown):string{
 return AVATARS.find(a=>a.id===value)?.symbol||"✨";
}
