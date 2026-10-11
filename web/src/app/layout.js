import Script from "next/script";
import "./globals.css";

export const metadata = { title: "Rely Workforce Group | Oportunidades de empleo", description: "Connect with Rely about job opportunities. / Deja tus datos para conocer oportunidades de empleo con Rely." };

export default function RootLayout({ children }) {
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  return <html lang="en"><body>{children}{pixel && <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}</Script>}</body></html>;
}
