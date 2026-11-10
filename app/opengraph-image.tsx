import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link-preview card shown when the site is shared (LinkedIn, WhatsApp…).
export const alt = "Umit Bozdag — Senior Operations Manager, exhibitions and events, London";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) =>
  readFile(join(process.cwd(), "node_modules/@fontsource/inter-tight/files", file));

export default async function OpengraphImage() {
  const [medium, heavy] = await Promise.all([
    font("inter-tight-latin-500-normal.woff"),
    font("inter-tight-latin-800-normal.woff"),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#06143a",
          color: "#ffffff",
          fontFamily: "Inter Tight",
          padding: "70px 80px",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>
          Senior Operations Manager, Media10, London
        </div>
        <div style={{ fontSize: 190, fontWeight: 800, lineHeight: 0.92, letterSpacing: -8, marginTop: 22, display: "flex", flexDirection: "column" }}>
          <span>Umit</span>
          <span>Bozdag</span>
        </div>
        <div style={{ width: 140, height: 8, background: "#1a47ff", marginTop: 40 }} />
        <div style={{ fontSize: 32, fontWeight: 500, marginTop: 28, color: "rgba(255,255,255,0.85)" }}>
          Exhibitions and conferences that run on time, on budget and safely
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter Tight", data: medium, weight: 500, style: "normal" },
        { name: "Inter Tight", data: heavy, weight: 800, style: "normal" },
      ],
    }
  );
}
