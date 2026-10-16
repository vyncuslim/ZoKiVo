import type {MetadataRoute} from "next";

const BASE = "https://zokivo.vynalthai.com";

/**
 * Public, crawlable website pages only.
 * Private rooms, AI sessions, teacher dashboards and login paths must not be indexed.
 */
export default function sitemap():MetadataRoute.Sitemap {
  const pages = [
    {path:"/",priority:1,changeFrequency:"weekly" as const},
    {path:"/games",priority:0.9,changeFrequency:"weekly" as const},
    {path:"/how-it-works",priority:0.8,changeFrequency:"monthly" as const},
    {path:"/try",priority:0.7,changeFrequency:"monthly" as const},
    {path:"/paper",priority:0.8,changeFrequency:"monthly" as const},
    {path:"/paper/cards",priority:0.6,changeFrequency:"monthly" as const},
    {path:"/library",priority:0.7,changeFrequency:"weekly" as const},
    {path:"/study",priority:0.7,changeFrequency:"weekly" as const}
  ];
  return pages.map((p)=>({url:BASE+p.path,changeFrequency:p.changeFrequency,priority:p.priority}));
}
