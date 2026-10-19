import config from "../../payload.config";
import { RootLayout } from "@payloadcms/next/layouts";
import { serverFunction } from "./serverFunctions";
import "@payloadcms/next/css";
import "../globals.css";

export default function Layout({ children }: { children: React.ReactNode }) {
  return RootLayout({ children, config: Promise.resolve(config), importMap: {}, serverFunction });
}
