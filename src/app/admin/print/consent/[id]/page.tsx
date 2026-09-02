import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { ConsentDocument } from "@/components/consent-document";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ConsentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await guardPage("customers");
  const { id } = await params;

  const [signature, settings] = await Promise.all([
    prisma.consentSignature.findUnique({
      where: { id },
      include: { template: { select: { title: true } } },
    }),
    getSettings(),
  ]);
  if (!signature) notFound();

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
