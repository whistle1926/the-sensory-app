/**
 * Meta (Facebook) Pixel tracking script — server-rendered into the
 * document head when the admin has saved a Pixel ID under
 * /settings → Tracking and the master toggle is on.
 *
 * Renders nothing when:
 *  • No row in TrackingSettings yet
 *  • The row's `enabled` flag is false
 *  • `metaPixelId` is empty
 *
 * The snippet is the standard one from Events Manager → Install
 * pixel → Install code manually. We fire a `PageView` on initial
 * load — route-change PageViews are handled by `MetaPixelRouteTracker`
 * (a client component that listens to App Router navigations).
 *
 * Works for boosts from Ad Center as well as proper Ads Manager
 * campaigns — the pixel doesn't care how the ad was created, only
 * that the visitor lands on a page where it fires.
 */
import Script from "next/script";
import { prisma } from "@/lib/prisma";

export async function MetaPixelScript() {
  const row = await prisma.trackingSettings
    .findUnique({ where: { id: "default" } })
    .catch(() => null);

  if (!row?.enabled || !row.metaPixelId) return null;

  const pixelId = JSON.stringify(row.metaPixelId);

  // Standard Meta Pixel snippet, lifted verbatim from Events Manager.
  // Pixel ID is the only customisable bit.
  const snippet = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', ${pixelId});
    fbq('track', 'PageView');
  `;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: snippet }}
      />
      {/* No-script fallback — fires a 1x1 image so visitors with JS
          disabled still get a PageView event. */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${row.metaPixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
