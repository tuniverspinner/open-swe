import { useState, useEffect, useCallback, useRef } from "react";
import { GITHUB_INSTALLATION_ID_COOKIE } from "@open-swe/shared/constants";

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    id: number;
    avatar_url: string;
    type: "User" | "Organization";
  };
  app_id: number;
  target_type: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubInstallationsResponse {
  total_count: number;
  installations: GitHubInstallation[];
}

const SELECTED_INSTALLATION_STORAGE_KEY = "selected-github-installation";

const saveInstallationToLocalStorage = (installationId: number | null) => {
  try {
    if (installationId !== null) {
      localStorage.setItem(SELECTED_INSTALLATION_STORAGE_KEY, installationId.toString());
    } else {
      localStorage.removeItem(SELECTED_INSTALLATION_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Failed to save installation to localStorage:", error);
  }
};

const getInstallationFromLocalStorage = (): number | null => {
  try {
    const stored = localStorage.getItem(SELECTED_INSTALLATION_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  } catch (error) {
    console.warn("Failed to retrieve installation from localStorage:", error);
    return null;
  }
};

const getCookieInstallationId = (): number | null => {
  try {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";");
      const installationCookie = cookies.find((cookie) =>
        cookie.trim().startsWith(`${GITHUB_INSTALLATION_ID_COOKIE}=`)
      );
      if (installationCookie) {
        const value = installationCookie.split("=")[1];
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  } catch (error) {
    console.warn("Failed to retrieve installation from cookie:", error);
    return null;
  }
};

interface UseGitHubOrganizationsReturn {
  // Installation state
  installations: GitHubInstallation[];
  isLoading: boolean;
  error: string | null;
  
  // Installation selection
  selectedInstallationId: number | null;
  selectedInstallation: GitHubInstallation | null;
  setSelectedInstallationId: (installationId: number | null) => void;
  
  // Actions
  refreshInstallations: () => Promise<void>;
}

export function useGitHubOrganizations(): UseGitHubOrganizationsReturn {
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstallationId, setSelectedInstallationIdState] = useState<number | null>(null);
  
  const hasInitializedRef = useRef(false);
  const hasAutoSelectedRef = useRef(false);

  const fetchInstallations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/github/installations");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch installations");
      }

      const data: GitHubInstallationsResponse = await response.json();
      setInstallations(data.installations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setInstallations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setSelectedInstallationId = useCallback((installationId: number | null) => {
    setSelectedInstallationIdState(installationId);
    saveInstallationToLocalStorage(installationId);
  }, []);

  const refreshInstallations = useCallback(async () => {
    await fetchInstallations();
  }, [fetchInstallations]);

  // Initialize installations on mount
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchInstallations();
    }
  }, [fetchInstallations]);

  // Initialize selected installation from localStorage or cookie
  useEffect(() => {
    if (!hasInitializedRef.current || isLoading || installations.length === 0) {
      return;
    }

    if (selectedInstallationId === null) {
      // Try to get from localStorage first
      const storedInstallationId = getInstallationFromLocalStorage();
      if (storedInstallationId && installations.some(inst => inst.id === storedInstallationId)) {
        setSelectedInstallationIdState(storedInstallationId);
        return;
      }

      // Fallback to cookie
      const cookieInstallationId = getCookieInstallationId();
      if (cookieInstallationId && installations.some(inst => inst.id === cookieInstallationId)) {
        setSelectedInstallationId(cookieInstallationId);
        return;
      }

      // Auto-select first installation if none selected
      if (!hasAutoSelectedRef.current && installations.length > 0) {
        setSelectedInstallationId(installations[0].id);
        hasAutoSelectedRef.current = true;
      }
    }
  }, [installations, selectedInstallationId, isLoading, setSelectedInstallationId]);

  const selectedInstallation = selectedInstallationId 
    ? installations.find(inst => inst.id === selectedInstallationId) || null
    : null;

  return {
    installations,
    isLoading,
    error,
    selectedInstallationId,
    selectedInstallation,
    setSelectedInstallationId,
    refreshInstallations,
  };
}

