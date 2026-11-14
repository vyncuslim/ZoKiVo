import type { Metadata } from "next";
import PageClient from "./page.client";

export const metadata: Metadata = {
  title: "Quiz Library",
  description: "Explore public classroom quizzes by subject and find your next ZoKivo learning game.",
  alternates: { canonical: "/library" },
  robots: { index: true, follow: true }
};

export default function Page() {
  return <PageClient />;
}
