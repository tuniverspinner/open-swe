import {
  GraphConfig,
  GraphConfigurationMetadata,
} from "@open-swe/shared/open-swe/types";

export function getCustomConfigurableFields(
  config: GraphConfig,
): Partial<GraphConfig["configurable"]> {
  if (!config.configurable) return {};

  const result: Partial<GraphConfig["configurable"]> = {};

  // Always include x-local-mode if present (for local development)
  if ("x-local-mode" in config.configurable) {
    (result as any)["x-local-mode"] = config.configurable["x-local-mode" as keyof GraphConfig["configurable"]];
  }

  for (const [key, metadataValue] of Object.entries(
    GraphConfigurationMetadata,
  )) {
    if (key in config.configurable) {
      if (
        metadataValue.x_open_swe_ui_config.type !== "hidden" ||
        key === "apiKeys"
      ) {
        result[key as keyof GraphConfig["configurable"]] =
          config.configurable[key as keyof GraphConfig["configurable"]];
      }
    }
  }

  return result;
}
