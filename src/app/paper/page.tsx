import type { Metadata } from "next";
import PageClient from "./page.client";

export const metadata: Metadata = {
  title: "Paper Mode",
  description: "Run classroom quiz activities using printable cards with ZoKivo Paper Mode.",
  alternates: { canonical: "/paper" },
  robots: { index: true, follow: true }
};

export default function Page() {
  return <PageClient />;
}
