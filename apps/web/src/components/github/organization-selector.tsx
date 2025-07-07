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
import { useGitHubOrganizations, type GitHubInstallation } from "@/hooks/useGitHubOrganizations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface OrganizationSelectorProps {
  disabled?: boolean;
  placeholder?: string;
  buttonClassName?: string;
}

export function OrganizationSelector({
  disabled = false,
  placeholder = "Select organization...",
  buttonClassName,
}: OrganizationSelectorProps) {
  const [open, setOpen] = useState(false);
  const {
    installations,
    selectedInstallation,
    setSelectedInstallationId,
    isLoading,
    error,
  } = useGitHubOrganizations();

  const handleSelect = (installationId: string) => {
    const installation = installations.find(
      (inst) => inst.id.toString() === installationId,
    );
    if (installation) {
      setSelectedInstallationId(installation.id);
      setOpen(false);
    }
  };

  const getInstallationDisplayName = (installation: GitHubInstallation) => {
    return installation.account.login;
  };

  const getInstallationIcon = (installation: GitHubInstallation) => {
    return installation.account.type === "Organization" ? (
      <Building2 className="h-4 w-4" />
    ) : (
      <User className="h-4 w-4" />
    );
  };

  if (isLoading) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn(buttonClassName)}
        size="sm"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span className="truncate text-left">Loading...</span>
        </div>
      </Button>
    );
  }

  if (error) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn(buttonClassName)}
        size="sm"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span className="truncate text-left">Error loading organizations</span>
        </div>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
            {selectedInstallation ? (
              <>
                <Avatar className="h-4 w-4">
                  <AvatarImage src={selectedInstallation.account.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {selectedInstallation.account.login.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-left">
                  {getInstallationDisplayName(selectedInstallation)}
                </span>
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4" />
                <span className="truncate text-left">{placeholder}</span>
              </>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandList>
            <CommandEmpty>No organizations found.</CommandEmpty>
            <CommandGroup>
              {installations.map((installation) => {
                const key = installation.id.toString();
                const isSelected = selectedInstallation?.id === installation.id;
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
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={installation.account.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {installation.account.login.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            {getInstallationDisplayName(installation)}
                          </span>
                          {getInstallationIcon(installation)}
                        </div>
                        <span className="text-xs text-muted-foreground">
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

