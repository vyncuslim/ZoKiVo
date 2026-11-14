import type { Metadata } from "next";
import PageClient from "./page.client";

export const metadata: Metadata = {
  title: "Printable Q-Cards",
  description: "Print Q-Cards for classroom quizzes with ZoKivo Paper Mode.",
  alternates: { canonical: "/paper/cards" },
  robots: { index: true, follow: true }
};

export default function Page() {
  return <PageClient />;
}
