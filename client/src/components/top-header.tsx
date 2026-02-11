import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function TopHeader() {
  const { lang, setLang, t } = useI18n();

  const toggleLanguage = () => {
    setLang(lang === "en" ? "ar" : "en");
  };

  return (
    <div className="h-10 border-b border-border bg-background/95 backdrop-blur flex items-center justify-end px-4 gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguage}
        className="flex items-center gap-2 text-sm"
        data-testid="button-toggle-language"
      >
        <Globe className="w-4 h-4" />
        {lang === "en" ? "العربية" : "English"}
      </Button>
    </div>
  );
}
