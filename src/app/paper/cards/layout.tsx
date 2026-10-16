import type {Metadata} from "next";
export const metadata:Metadata={
  title:"Printable Q-Cards",
  description:"Print 60 ZoKivo classroom answer cards for teacher-led Paper Mode quiz games.",
  alternates:{canonical:"/paper/cards"}
};
export default function CardsLayout({children}:{children:React.ReactNode}){return children}
