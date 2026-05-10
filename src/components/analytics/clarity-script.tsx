/**
 * Microsoft Clarity tracking script — server-rendered into the document
 * head when the admin has saved a Project ID under
 * /settings → Tracking and the master toggle is on.
 *
 * Renders nothing (no DOM) when:
 *  • No row in TrackingSettings yet
 *  • The row's `enabled` flag is false
 *  • `clarityProjectId` is empty
 *
 * The script is the standard one from clarity.microsoft.com →
 * Setup → Tracking code, with the project ID interpolated from the DB
 * value. We use Next.js's <Script strategy="afterInteractive"> so it
 * loads after the page is interactive — no impact on Largest
 * Contentful Paint.
 */
import Script from "next/script";
import { prisma } from "@/lib/prisma";

export async function ClarityScript() {
  const row = await prisma.trackingSettings
    .findUnique({ where: { id: "default" } })
    .catch(() => null);

  if (!row?.enabled || !row.clarityProjectId) return null;

  // The standard Clarity snippet, lifted verbatim from their setup page.
  // Project ID is the only customisable bit.
  const snippet = `
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", ${JSON.stringify(row.clarityProjectId)});
  `;

  return (
    <Script
      id="ms-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: snippet }}
    />
  );
}
