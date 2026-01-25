import '../styles/globals.css';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>DispIA Corp</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Favicon aponta para a logo na pasta public */}
        <link rel="icon" href="/logo.png" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
export default MyApp;