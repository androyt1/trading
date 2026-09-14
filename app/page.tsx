import { LiveDashboard } from "@/components/dashboard/live-dashboard";
import { MOCK_SYMBOLS, generateMockBook, generateMockCandles } from "@/lib/market/mock-data";

export default function Home() {
  const primary = MOCK_SYMBOLS[0];
  const candles = generateMockCandles(primary.price);
  const book = generateMockBook(primary.price);

  return <LiveDashboard initialCandles={candles} book={book} />;
}
