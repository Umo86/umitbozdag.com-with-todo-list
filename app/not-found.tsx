import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="notfound">
      <h1>This stand isn&rsquo;t on the floorplan.</h1>
      <p>The page you asked for doesn&rsquo;t exist.</p>
      <a className="btn" href="/">
        Back to the entrance
      </a>
    </main>
  );
}
