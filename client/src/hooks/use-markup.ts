import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useMarkup() {
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/settings");
      return response.json();
    },
  });

  const markupSetting = settings.find((s: any) => s.key === "markup_percentage")?.value;
  const markupPercentage = markupSetting ? parseFloat(markupSetting) : 0;

  const usdRateSetting = settings.find((s: any) => s.key === "usd_exchange_rate")?.value;
  const usdExchangeRate = usdRateSetting ? parseFloat(usdRateSetting) : 0;

  const applyMarkup = (basePrice: number | string): number => {
    const price = typeof basePrice === "string" ? parseFloat(basePrice) : basePrice;
    if (isNaN(price)) return 0;
    if (markupPercentage <= 0) return price;
    return price * (1 + markupPercentage / 100);
  };

  const applyMarkupUsd = (usdPrice: number | string): number => {
    const price = typeof usdPrice === "string" ? parseFloat(usdPrice) : usdPrice;
    if (isNaN(price)) return 0;
    const lydPrice = usdExchangeRate > 0 ? price * usdExchangeRate : price;
    if (markupPercentage <= 0) return lydPrice;
    return lydPrice * (1 + markupPercentage / 100);
  };

  const formatMarkedUpPrice = (basePrice: number | string): string => {
    return applyMarkup(basePrice).toFixed(2);
  };

  return {
    markupPercentage,
    usdExchangeRate,
    applyMarkup,
    applyMarkupUsd,
    formatMarkedUpPrice,
    isLoading,
    hasMarkup: markupPercentage > 0,
  };
}
