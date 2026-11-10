import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link-preview card shown when the site is shared (LinkedIn, WhatsApp…).
export const alt = "Umit Bozdag — Event Operations, London";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) =>
  readFile(join(process.cwd(), "node_modules/@fontsource/bodoni-moda/files", file));

export default async function OpengraphImage() {
  const [regular, italic] = await Promise.all([
    font("bodoni-moda-latin-500-normal.woff"),
    font("bodoni-moda-latin-500-italic.woff"),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#000000",
          fontFamily: "Bodoni",
          padding: "0 90px",
        }}
      >
        <div style={{ fontSize: 30, fontStyle: "italic", color: "#1f1d1b" }}>
          Event operations, London
        </div>
        <div style={{ fontSize: 76, letterSpacing: 26, marginTop: 26, paddingLeft: 26 }}>
          UMIT
        </div>
        <div style={{ fontSize: 196, lineHeight: 1, marginTop: -6 }}>BOZDAG</div>
        <div style={{ width: "100%", height: 6, background: "#a61c2b", marginTop: 34 }} />
        <div style={{ width: "100%", height: 2, background: "#000000", marginTop: 7 }} />
        <div style={{ fontSize: 32, fontStyle: "italic", marginTop: 30, color: "#1f1d1b" }}>
          Fifteen years of flagship exhibitions, from the first floorplan to the final breakdown
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bodoni", data: regular, weight: 500, style: "normal" },
        { name: "Bodoni", data: italic, weight: 500, style: "italic" },
      ],
    }
  );
}
