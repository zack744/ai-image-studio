import { LoginModal } from "@/app/components/login/LoginModal";
import { GlobalNavigation } from "@/app/components/navigation/GlobalNavigation";
import { Toaster } from "@/app/components/ui/sonner";
import { useAuth } from "@/app/hooks/useAuth";
import { useThemeManager } from "@/app/hooks/useTheme";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../stores";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const { theme, themeColor, language, setTheme, setThemeColor, setLanguage, setIsMobile } = useUIStore();
  const { isLoading: authLoading } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [hasAuthResolved, setHasAuthResolved] = useState(false);
  const { i18n, t } = useTranslation();

  // Apply theme and theme color with automatic system theme detection
  useThemeManager(theme, themeColor, setTheme);

  // Conditionally load Google Analytics when an ID is provided
  useEffect(() => {
    const gaId = import.meta.env.GOOGLE_ANALYTICS_ID as string | undefined;
    if (!gaId || gaId.trim() === "") return;

    if (!document.getElementById("ga-gtag")) {
      const script = document.createElement("script");
      script.id = "ga-gtag";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
      document.head.appendChild(script);
    }

    if (!document.getElementById("ga-inline")) {
      const inline = document.createElement("script");
      inline.id = "ga-inline";
      inline.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaId}');
      `;
      document.head.appendChild(inline);
    }
  }, []);

  // Update loading title when initialization starts
  useEffect(() => {
    if (hasAuthResolved && !isInitialized && !initError && i18n.isInitialized) {
      const titleElement = document.getElementById("loading-title");
      if (titleElement) {
        titleElement.textContent = t("app.initializing");
        titleElement.style.display = "block";
      }
    }
  }, [hasAuthResolved, isInitialized, initError, t, i18n.isInitialized]);

  // Remove loading when app is fully loaded
  useEffect(() => {
    if (isInitialized && !initError) {
      const loadingElement = document.getElementById("loading");
      const loadingStyles = document.getElementById("loading-styles");
      if (loadingElement) {
        loadingElement.style.opacity = "0";
        setTimeout(() => {
          loadingElement.remove();
          if (loadingStyles) {
            loadingStyles.remove();
          }
        }, 300);
      }
    }
  }, [isInitialized, initError]);

  // Update loading title for error state
  useEffect(() => {
    if (initError && i18n.isInitialized) {
      const titleElement = document.getElementById("loading-title");
      if (titleElement) {
        titleElement.textContent = t("app.initializationFailed");
        titleElement.style.display = "block";
      }
    }
  }, [initError, i18n.isInitialized, t]);

  // Handle language change
  useEffect(() => {
    const findCompatibleLanguage = (targetLang: string): string => {
      if (i18n.hasResourceBundle(targetLang, "translation")) {
        return targetLang;
      }
      const underscoreLang = targetLang.replace("-", "_");
      if (i18n.hasResourceBundle(underscoreLang, "translation")) {
        return underscoreLang;
      }
      const baseLang = targetLang.split("-")[0];
      if (baseLang && i18n.hasResourceBundle(baseLang, "translation")) {
        return baseLang;
      }
      return "en";
    };

    const updateLanguage = async () => {
      let targetLanguage: string;

      if (language && language !== "system") {
        targetLanguage = findCompatibleLanguage(language);
      } else if (language === "system") {
        const browserLang = navigator.language;
        targetLanguage = findCompatibleLanguage(browserLang);
      } else {
        return;
      }

      if (i18n.language !== targetLanguage) {
        await i18n.changeLanguage(targetLanguage);
      }
    };

    updateLanguage();
  }, [language, i18n]);

  function initIsMobile() {
    const MOBILE_BREAKPOINT = 768;
    const updateMobileState = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    updateMobileState();

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleResize = () => updateMobileState();
    mql.addEventListener("change", updateMobileState);

    return () => {
      mql.removeEventListener("change", handleResize);
    };
  }

  // Track when auth has resolved at least once
  useEffect(() => {
    if (!authLoading && !hasAuthResolved) {
      setHasAuthResolved(true);
    }
  }, [authLoading, hasAuthResolved]);

  // Initialize app
  useEffect(() => {
    if (!hasAuthResolved) {
      return;
    }

    let isMobileCleanup: (() => void) | null = null;

    try {
      isMobileCleanup = initIsMobile();
    } catch (err) {
      console.error("Failed to initialize:", err);
      setInitError(err instanceof Error ? err.message : "Failed to initialize application");
    }

    setIsInitialized(true);

    return () => {
      if (isMobileCleanup) {
        isMobileCleanup();
      }
    };
  }, [hasAuthResolved]);

  // Show loading screen during initialization
  if (!isInitialized) {
    return null;
  }

  return <AppContent />;
}

function AppContent() {
  return (
    <div className="flex h-app bg-gradient-to-br from-background via-background to-muted/20 md:h-screen">
      <GlobalNavigation />
      <div className="relative flex flex-1 flex-col overflow-hidden md:ml-16">
        <Outlet />
      </div>
      <LoginModal />
      <Toaster position="top-center" />
    </div>
  );
}
