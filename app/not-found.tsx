import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="lost">
      <div>
        <h1>This stand isn&rsquo;t on the floorplan.</h1>
        <p>
          The page you asked for doesn&rsquo;t exist.{" "}
          <a href="/">Go back to the entrance</a>.
        </p>
      </div>
    </main>
  );
}
