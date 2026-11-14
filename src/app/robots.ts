import type {MetadataRoute} from "next";

export default function robots():MetadataRoute.Robots {
  return {
    rules:[{
      userAgent:"*",
      allow:"/",
      disallow:[
        "/api/","/auth/","/account","/host","/play","/game/",
        "/create","/ai","/paper/scan/","/paper/board/","/paper/check"
      ]
    }],
    sitemap:"https://zokivo.xyz/sitemap.xml",
    host:"https://zokivo.xyz"
  };
}
