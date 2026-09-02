import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";
import { getSettings } from "@/lib/settings";
import { ConsentDocument } from "@/components/consent-document";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "رضایت‌نامه",
  robots: { index: false, follow: false },
};

export default async function AccountConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const [signature, settings] = await Promise.all([
    prisma.consentSignature.findUnique({
      where: { id },
      include: { template: { select: { title: true } } },
    }),
    getSettings(),
  ]);
  // فقط صاحب رضایت‌نامه می‌تواند ببیندش
  if (!signature || signature.customerId !== session.id) notFound();

  return (
    <ConsentDocument
      clinicName={settings.clinicName}
      address={settings.address}
      title={signature.template.title}
      body={signature.bodySnapshot}
      fullName={signature.fullName}
      nationalCode={signature.nationalCode}
      signedAt={signature.signedAt}
      signatureData={signature.signatureData}
    />
  );
}
