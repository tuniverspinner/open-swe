"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GitHubSVG } from "@/components/icons/github";
import { LogOut } from "lucide-react";
import { TooltipIconButton } from "../ui/tooltip-icon-button";

export function GitHubOAuthButton() {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/status");
      const data = await response.json();
      setIsAuth(data.authenticated);
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsAuth(false);
    }
  };

  const handleLogin = () => {
    setIsLoading(true);
    window.location.href = "/api/auth/github/login";
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (response.ok) {
        localStorage.removeItem("github_app_installed");
        setIsAuth(false);
        window.location.href = "/";
      } else {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuth === null) {
    return (
      <Button
        variant="outline"
        disabled
        className="text-xs"
        size="sm"
      >
        <GitHubSVG
          width="16"
          height="16"
        />
        Checking...
      </Button>
    );
  }

  if (isAuth) {
    return (
      <TooltipIconButton
        tooltip="Logout"
        onClick={handleLogout}
        disabled={isLoading}
        className="text-xs"
        size="sm"
      >
        <LogOut className="size-4" />
      </TooltipIconButton>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleLogin}
      disabled={isLoading}
      className="text-xs"
      size="sm"
    >
      <GitHubSVG />
      {isLoading ? "Connecting..." : "Connect GitHub"}
    </Button>
  );
}
