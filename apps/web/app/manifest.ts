import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kibali Stores",
    short_name: "Kibali",
    description: "Simple business records for Kibali Stores — sales, stock, money.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d7a52",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
