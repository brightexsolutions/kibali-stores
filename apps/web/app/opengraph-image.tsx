import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
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
          gap: 24,
          background: "linear-gradient(135deg, #059669 0%, #0d9488 50%, #065f46 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 120,
            height: 120,
            borderRadius: 60,
            background: "rgba(255,255,255,0.15)",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
          }}
        >
          🏪
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, display: "flex" }}>Kibali Enterprise</div>
        <div style={{ fontSize: 32, opacity: 0.9, display: "flex" }}>
          Simple business records for busy shops
        </div>
      </div>
    ),
    { ...size }
  );
}
