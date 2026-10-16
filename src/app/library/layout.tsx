import type {Metadata} from "next";
export const metadata:Metadata={
  title:"Quiz Library",
  description:"Explore published ZoKivo classroom quiz sets and create your own learning games.",
  alternates:{canonical:"/library"}
};
export default function LibraryLayout({children}:{children:React.ReactNode}){return children}
