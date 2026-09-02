import { formatJalaliLong } from "@/lib/date";
import { PrintButton } from "@/components/admin/print-button";

/** برگه‌ی رضایت‌نامه‌ی امضاشده — برای نمایش و چاپ در پنل و در حساب مشتری */
export function ConsentDocument({
  clinicName,
  address,
  title,
  body,
  fullName,
  nationalCode,
  signedAt,
  signatureData,
}: {
  clinicName: string;
  address?: string;
  title: string;
  body: string;
  fullName: string;
  nationalCode?: string | null;
  signedAt: Date;
  signatureData?: string | null;
}) {
  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-[color:#1c1418] print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>

      <header className="border-b border-neutral-300 pb-5 text-center">
        <h1 className="text-xl font-extrabold">{clinicName}</h1>
        {address && <p className="mt-1 text-sm text-neutral-600">{address}</p>}
        <h2 className="mt-5 text-lg font-bold">{title}</h2>
      </header>

      <article className="mt-7 text-sm leading-9 whitespace-pre-wrap">{body}</article>

      <footer className="mt-12 grid grid-cols-2 gap-8 border-t border-neutral-300 pt-6 text-sm">
        <div>
          <p>
            <span className="text-neutral-600">نام و نام خانوادگی: </span>
            <span className="font-medium">{fullName}</span>
          </p>
          {nationalCode && (
            <p className="mt-2">
              <span className="text-neutral-600">کد ملی: </span>
              <span className="font-medium" dir="ltr">
                {nationalCode}
              </span>
            </p>
          )}
          <p className="mt-2">
            <span className="text-neutral-600">تاریخ امضا: </span>
            <span className="font-medium">{formatJalaliLong(signedAt)}</span>
          </p>
        </div>

        <div className="text-center">
          <p className="text-neutral-600">امضای مراجعه‌کننده</p>
          {signatureData ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={signatureData} alt="امضا" className="mx-auto mt-2 h-24 w-auto object-contain" />
          ) : (
            <div className="mt-2 h-24 rounded-lg border border-dashed border-neutral-300" />
          )}
        </div>
      </footer>
    </main>
  );
}
