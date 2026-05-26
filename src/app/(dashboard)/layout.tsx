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
    <div className="min-h-screen bg-background">
      <Sidebar exchangeRate={exchangeRate} isConnected={true} />
      <main className="md:ml-[260px] min-h-screen">
        <div className="w-full px-4 py-6 md:px-7 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
