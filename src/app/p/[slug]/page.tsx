import { permanentRedirect } from "next/navigation";

/**
 * Old page URLs. Pages briefly lived at /p/<slug> before clean URLs existed;
 * this keeps anything already shared working, and tells search engines the
 * short URL is the real one.
 */
export default async function LegacyPageUrl({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/${slug}`);
}
