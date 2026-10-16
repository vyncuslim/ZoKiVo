import "./style.css";
import "./ux.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
 title: {default: "ZoKivo! — Play. Learn. Win.",template:"%s | ZoKivo!"},
 description: "Explore classroom quiz games, learn how to play, or join a live ZoKivo game with a six-digit PIN.",
 icons: {icon:"/icon.svg"}
};
const links=[{href:"/games",label:"Games"},{href:"/how-it-works",label:"How it works"},{href:"/try",label:"Try it"}];
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body><div className="site-shell">
   <header className="site-header"><div className="site-header-inner">
     <Brand/>
     <nav className="desktop-nav" aria-label="Primary navigation">{links.map(l=><Link key={l.href} href={l.href}>{l.label}</Link>)}</nav>
     <div className="header-actions"><Link className="nav-join" href="/play">Enter PIN <span aria-hidden="true">↗</span></Link><Link className="nav-host" href="/host">Host game <span aria-hidden="true">→</span></Link></div>
     <details className="mobile-menu"><summary aria-label="Open navigation menu">☰ <span>Menu</span></summary><nav aria-label="Mobile navigation">{links.map(l=><Link key={l.href} href={l.href}>{l.label}<span aria-hidden="true">↗</span></Link>)}<Link href="/host">Host a game <span aria-hidden="true">↗</span></Link></nav></details>
   </div></header>
   {children}
   <footer className="site-footer"><div className="footer-inner">
     <div className="footer-brand-block"><Brand inverse/><p>Play. Learn. Win.<br/>An original classroom gaming project by Vynalth AI.</p></div>
     <nav className="footer-links" aria-label="Footer navigation"><Link href="/games">Games</Link><Link href="/how-it-works">How it works</Link><Link href="/try">Try it</Link><Link href="/play">Join a game</Link><Link href="/host">Host a game</Link></nav>
     <small>© 2026 ZoKivo! · Made to play, built to learn.</small>
   </div></footer>
 </div></body></html>;
}
