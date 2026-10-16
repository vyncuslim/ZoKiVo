import Link from "next/link";
import type { Metadata } from "next";
import { MiniQuiz } from "@/components/mini-quiz";
export const metadata:Metadata={alternates:{canonical:"/try"},title:"Try a quiz",description:"Try a free practice question and see how ZoKivo quiz games work."};
export default function Try(){
 return <main id="main-content" className="try-page">
   <div className="wrap"><nav className="crumbs crumbs-light" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><strong>Try a quiz</strong></nav>
     <div className="try-page-layout"><div className="try-page-intro"><span className="eyebrow eyebrow--mini">NO PIN? NO PROBLEM.</span><h1>Give your<br/><span>brain a spin.</span></h1><p>Try one practice question right here. No account, no game room and no pressure.</p>
       <div className="try-tip"><span aria-hidden="true">✳</span><div><strong>Just a practice round</strong><p>Your answer stays on this page. There is no live score or room connection.</p></div></div>
     </div><MiniQuiz/></div>
     <div className="try-page-bottom"><span>READY FOR THE REAL THING?</span><div><Link className="button button-yellow" href="/play">Join with a PIN ↗</Link><Link className="button button-outline" href="/games">Explore games →</Link></div></div>
   </div>
 </main>;
}
