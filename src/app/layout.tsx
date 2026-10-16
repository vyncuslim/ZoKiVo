import "./style.css";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";
export const metadata: Metadata = {
 title: {default: "ZoKivo! — Learning is better when it's a game",template:"%s | ZoKivo!"},
 description: "Classroom games with personality. Join a live quiz with a PIN or host a fun learning challenge.",
 icons: {icon:"/icon.svg"}
};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>
 <div className="site-shell">
 <header className="site-header"><div className="site-header-inner"><Brand/>
 <nav className="desktop-nav" aria-label="Main navigation"><a href="/#modes">Game modes</a><a href="/#how">How it works</a></nav>
 <div className="header-actions"><a className="nav-join" href="/play">Enter a PIN <span aria-hidden="true">↗</span></a><a className="nav-host" href="/host">Host a game <span aria-hidden="true">→</span></a></div>
 </div></header>
 {children}
 <footer className="site-footer"><div className="footer-inner"><Brand inverse/><p>Made for the moments when learning clicks.<br/>An original classroom gaming project by Vynalth AI.</p><small>© 2026 ZoKivo! &nbsp;·&nbsp; Made to play, built to learn.</small></div></footer>
 </div></body></html>;
}
