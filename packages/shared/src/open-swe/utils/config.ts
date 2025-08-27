import {
  GraphConfig,
  GraphConfigurationMetadata,
} from "@openswe/shared/open-swe/types";

export function getCustomConfigurableFields(
  config: GraphConfig,
): Partial<GraphConfig["configurable"]> {
  if (!config.configurable) return {};

  const result: Partial<GraphConfig["configurable"]> = {};

  for (const [key, metadataValue] of Object.entries(
    GraphConfigurationMetadata,
  )) {
    if (key in config.configurable) {
      if (
        metadataValue.x_open_swe_ui_config.type !== "hidden" ||
        ["apiKeys", "reviewPullNumber"].includes(key)
      ) {
        result[key as keyof GraphConfig["configurable"]] =
          config.configurable[key as keyof GraphConfig["configurable"]];
      }
    }
  }

  return result;
}
