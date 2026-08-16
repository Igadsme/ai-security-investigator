import type { AppProps } from "next/app";
import { CaseProvider } from "@/lib/CaseContext";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CaseProvider>
      <Component {...pageProps} />
    </CaseProvider>
  );
}
