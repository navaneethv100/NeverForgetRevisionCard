import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "linear-gradient(135deg, #3955d4 0%, #6c47ff 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#f0c040",
            fontSize: 20,
            fontWeight: 900,
            lineHeight: 1,
            marginTop: -1,
          }}
        >
          ∞
        </div>
      </div>
    ),
    { ...size }
  );
}
