import { RootPage } from "@payloadcms/next/views";
import config from "../../../../payload.config";

export default function AdminPage({ params, searchParams }: { params: Promise<{ segments: string[] }>; searchParams: Promise<{ [key: string]: string | string[] }> }) {
  return RootPage({ config: Promise.resolve(config), importMap: {}, params, searchParams });
}
