"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DEFAULT_CONFIG_KEY, useConfigStore } from "@/hooks/useConfigStore";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import _ from "lodash";
import { cn } from "@/lib/utils";
import { useQueryState } from "nuqs";

interface Option {
  label: string;
  value: string;
}

interface ConfigFieldProps {
  id: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "switch"
    | "slider"
    | "select"
    | "json";
  description?: string;
  placeholder?: string;
  options?: Option[];
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  // Optional props for external state management
  value?: any;
  setValue?: (value: any) => void;
}

export function ConfigField({
  id,
  label,
  type,
  description,
  placeholder,
  options = [],
  min,
  max,
  step = 1,
  className,
  value: externalValue, // TODO: Rename to avoid conflict
  setValue: externalSetValue, // TODO: Rename to avoid conflict
}: ConfigFieldProps) {
  const [threadId] = useQueryState("threadId");
  const configKey = threadId || DEFAULT_CONFIG_KEY;
  const store = useConfigStore();
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Determine whether to use external state or Zustand store
  const isExternallyManaged = externalSetValue !== undefined;

  const currentValue = isExternallyManaged
    ? externalValue
    : store.configs[configKey]?.[id];

  const handleChange = (newValue: any) => {
    setJsonError(null);
    if (isExternallyManaged && externalSetValue) {
      externalSetValue(newValue);
    } else {
      store.updateConfig(configKey, id, newValue);
    }
  };

  const handleJsonChange = (jsonString: string) => {
    try {
      if (!jsonString.trim()) {
        handleChange(undefined);
        setJsonError(null);
        return;
      }

      const parsedJson = JSON.parse(jsonString);

      handleChange(parsedJson);
      setJsonError(null);
    } catch {
      if (isExternallyManaged && externalSetValue) {
        externalSetValue(jsonString);
      } else {
        store.updateConfig(configKey, id, jsonString);
      }
      setJsonError("Invalid JSON format");
    }
  };

  const handleFormatJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      handleChange(parsed);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON format");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className="text-sm font-medium"
        >
          {_.startCase(label)}
        </Label>
        {type === "switch" && (
          <Switch
            id={id}
            checked={!!currentValue}
            onCheckedChange={handleChange}
          />
        )}
      </div>

      {description && (
        <p className="text-xs whitespace-pre-line text-gray-500">
          {description}
        </p>
      )}

      {type === "text" && (
        <Input
          id={id}
          value={currentValue || ""}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
        />
      )}

      {type === "textarea" && (
        <Textarea
          id={id}
          value={currentValue || ""}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px]"
        />
      )}

      {type === "number" && (
        <Input
          id={id}
          type="number"
          value={currentValue !== undefined ? currentValue : ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
              handleChange(undefined);
            } else {
              const num = Number(val);
              if (!isNaN(num)) {
                handleChange(num);
              }
            }
          }}
          min={min}
          max={max}
          step={step}
        />
      )}

      {type === "slider" && (
        <div className="pt-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">{min ?? ""}</span>
            <span className="text-sm font-medium">
              {currentValue !== undefined
                ? currentValue
                : min !== undefined && max !== undefined
                  ? (min + max) / 2
                  : ""}
            </span>
            <span className="text-xs text-gray-500">{max ?? ""}</span>
          </div>
          <Slider
            id={id}
            value={[
              currentValue !== undefined
                ? currentValue
                : min !== undefined && max !== undefined
                  ? (min + max) / 2
                  : 0,
            ]}
            min={min}
            max={max}
            step={step}
            onValueChange={(vals: number[]) => handleChange(vals[0])}
            disabled={min === undefined || max === undefined}
          />
        </div>
      )}

      {type === "select" && (
        <Select
          value={currentValue ?? ""}
          onValueChange={handleChange}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder || "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {placeholder && (
              <SelectItem
                value=""
                disabled
              >
                {placeholder}
              </SelectItem>
            )}
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {type === "json" && (
        <>
          <Textarea
            id={id}
            value={
              typeof currentValue === "string"
                ? currentValue
                : (JSON.stringify(currentValue, null, 2) ?? "")
            }
            onChange={(e) => handleJsonChange(e.target.value)}
            placeholder={placeholder || '{\n  "key": "value"\n}'}
            className={cn(
              "min-h-[120px] font-mono text-sm",
              jsonError &&
                "border-red-500 focus:border-red-500 focus-visible:ring-red-500",
            )}
          />
          <div className="flex w-full items-start justify-between gap-2 pt-1">
            {" "}
            {/* Use items-start */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFormatJson(currentValue ?? "")}
              disabled={
                !currentValue || typeof currentValue !== "string" || !!jsonError
              }
              className="mt-1"
            >
              Format
            </Button>
            {jsonError && (
              <Alert
                variant="destructive"
                className="flex-grow px-3 py-1"
              >
                <div className="flex items-center gap-2">
                  {" "}
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{" "}
                  <AlertDescription className="text-xs">
                    {jsonError}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </div>
        </>
      )}
    </div>
  );
}
