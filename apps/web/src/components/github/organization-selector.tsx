import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { GitHubSVG } from "@/components/icons/github";
import { useGitHubAppProvider } from "@/providers/GitHubApp";
import type { GitHubInstallation } from "@/utils/github";

interface OrganizationSelectorProps {
  disabled?: boolean;
  placeholder?: string;
  buttonClassName?: string;
}

export function OrganizationSelector({
  disabled = false,
  placeholder = "Select an organization...",
  buttonClassName,
}: OrganizationSelectorProps) {
  const [open, setOpen] = useState(false);
  const {
    installations,
    selectedInstallation,
    setSelectedInstallation,
    installationsLoading,
    installationsError,
    refreshInstallations,
  } = useGitHubAppProvider();

  const handleSelect = (installationId: string) => {
    const installation = installations.find(
      (inst) => inst.id.toString() === installationId,
    );
    if (installation) {
      setSelectedInstallation(installation);
      setOpen(false);
    }
  };

  const getDisplayName = (installation: GitHubInstallation) => {
    return installation.account.login;
  };

  const getIcon = (installation: GitHubInstallation) => {
    return installation.account.type === "Organization" ? (
      <Building2 className="h-4 w-4" />
    ) : (
      <User className="h-4 w-4" />
    );
  };

  if (installationsLoading) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn(buttonClassName)}
        size="sm"
      >
        <div className="flex items-center gap-2">
          <GitHubSVG
            width="16"
            height="16"
          />
          <span>Loading organizations...</span>
        </div>
      </Button>
    );
  }

  if (installationsError) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn(buttonClassName)}
        size="sm"
        onClick={refreshInstallations}
      >
        <div className="flex items-center gap-2">
          <GitHubSVG
            width="16"
            height="16"
          />
          <span>Error loading organizations</span>
        </div>
      </Button>
    );
  }

  if (installations.length === 0) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn(buttonClassName)}
        size="sm"
      >
        <div className="flex items-center gap-2">
          <GitHubSVG
            width="16"
            height="16"
          />
          <span>No organizations found</span>
        </div>
      </Button>
    );
  }

  const selectedValue = selectedInstallation?.id.toString();
  const displayValue = selectedInstallation
    ? getDisplayName(selectedInstallation)
    : undefined;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(buttonClassName)}
          disabled={disabled}
          size="sm"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <GitHubSVG />
            <span className="truncate text-left">
              {displayValue || placeholder}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0">
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandList>
            <CommandEmpty>No organizations found.</CommandEmpty>
            <CommandGroup>
              {installations.map((installation) => {
                const key = installation.id.toString();
                const isSelected = selectedValue === key;
                return (
                  <CommandItem
                    key={installation.id}
                    value={key}
                    onSelect={() => handleSelect(key)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex items-center gap-2">
                      {getIcon(installation)}
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {getDisplayName(installation)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {installation.account.type}
                        </span>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
