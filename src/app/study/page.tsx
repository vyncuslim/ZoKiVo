import type { Metadata } from "next";
import PageClient from "./page.client";

export const metadata: Metadata = {
  title: "Study and Practice",
  description: "Study, practice and improve with interactive quizzes and learning activities on ZoKivo.",
  alternates: { canonical: "/study" },
  robots: { index: true, follow: true }
};

export default function Page() {
  return <PageClient />;
}
