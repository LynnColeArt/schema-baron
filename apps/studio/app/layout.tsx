import type { ReactNode } from "react";
import "./globals.css";
export const metadata = {
  title: "Schema Baron Studio",
  description: "Local application authoring workspace",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
