import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Separator } from "@/app/components/ui/separator";
import { useAuth } from "@/app/hooks/useAuth";
import { useUIStore } from "@/app/stores";
import { AlertCircle, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type AuthModalState = "login" | "register";

export function LoginModal() {
  const { isLoginModalOpen, closeLoginModal } = useUIStore();
  const { isLogin, user, register, login } = useAuth();
  const { t } = useTranslation();

  const [modalState, setModalState] = useState<AuthModalState>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const resetAllState = () => {
    setFormData({ name: "", email: "", password: "" });
    setShowPassword(false);
    setModalState("login");
    setError(null);
    setIsLoading(false);
  };

  const getModalContent = () => {
    switch (modalState) {
      case "login":
        return {
          title: t("auth.welcomeBack"),
          description: t("auth.loginDescription"),
        };
      case "register":
        return {
          title: t("auth.createAccount"),
          description: t("auth.registerDescription"),
        };
    }
  };

  useEffect(() => {
    if (isLogin && user && isLoginModalOpen) {
      handleClose();
    }
  }, [isLogin, user, isLoginModalOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleMode = () => {
    setModalState(modalState === "login" ? "register" : "login");
    setFormData({ name: "", email: "", password: "" });
    setShowPassword(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (modalState === "login") {
        await login(formData.email, formData.password);
      } else {
        await register(formData.email, formData.password, formData.name);
      }
    } catch (err: any) {
      const message = err?.message || "";
      if (message.includes("Invalid email or password")) {
        setError(t("auth.invalidEmailOrPassword"));
      } else if (message.includes("already registered")) {
        setError(t("auth.userAlreadyExists"));
      } else if (message.includes("password")) {
        setError(t("auth.passwordTooShort"));
      } else {
        setError(message || t("auth.networkError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    closeLoginModal();
    resetAllState();
  };

  return (
    <Dialog open={isLoginModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-center font-bold text-2xl">{getModalContent().title}</DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {getModalContent().description}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="fade-in flex animate-in items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-600 text-sm duration-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {modalState === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.username")}</Label>
                <div className="relative">
                  <User className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder={t("auth.enterUsername")}
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <div className="relative">
                <Mail className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.enterEmail")}
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Lock className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.enterPassword")}
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className="pr-10 pl-10"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-translate-y-1/2 absolute top-1/2 right-1 h-8 w-8 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : modalState === "login" ? (
                t("auth.login")
              ) : (
                t("auth.register")
              )}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              {modalState === "login" ? t("auth.noAccount") : t("auth.hasAccount")}
            </p>
            <Button type="button" variant="link" className="h-auto p-0 font-semibold" onClick={toggleMode}>
              {modalState === "login" ? t("auth.signUpNow") : t("auth.goToLogin")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
