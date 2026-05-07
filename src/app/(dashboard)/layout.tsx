import { requireAuth, getExchangeRate } from "@/lib/dal";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  const exchangeRate = await getExchangeRate();

  return (
    <div className="min-h-screen bg-stone-50">
      <Sidebar exchangeRate={exchangeRate} isConnected={true} />
      <main className="md:ml-[230px] min-h-screen">
        <div className="mx-auto max-w-[920px] px-4 py-6 md:px-7 md:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
