import type { AppProps } from "next/app";
import Head from "next/head";
import { AppProviders } from "@/AppProviders";
import "@/index.css";

export default function CafeFlowNextApp({ Component, pageProps }: AppProps) {
  return (
    <AppProviders>
      <Head>
        <title>Caféflow — Café management &amp; ordering</title>
        <meta
          name="description"
          content="Manage your café, craft a menu, and let customers order online with Caféflow."
        />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      </Head>
      <Component {...pageProps} />
    </AppProviders>
  );
}
