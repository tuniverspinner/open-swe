import { GraphConfig } from "@open-swe/shared/open-swe/types";
import { Task } from "./load-model.js";
import { ModelManager } from "./model-manager.js";
import { createLogger, LogLevel } from "./logger.js";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { StructuredToolInterface, tool } from "@langchain/core/tools";
//import { RunnableBinding } from "@langchain/core/runnables";

const logger = createLogger(LogLevel.INFO, "FallbackRunnable");

interface ExtractedTools {
  tools: StructuredToolInterface[];
  kwargs: Record<string, any>;
}

// Allow both proper tools and plain objects
type ToolInput = StructuredToolInterface | { name: string; description: string; schema: any; };

export class FallbackRunnable<
  RunInput,
  RunOutput extends Record<string, any>,
> extends Runnable<RunInput, RunOutput> {
  private primaryRunnable: Runnable<RunInput, RunOutput>;
  private config: GraphConfig;
  private task: Task;
  private modelManager: ModelManager;

  constructor(
    primaryRunnable: Runnable<RunInput, RunOutput>,
    config: GraphConfig,
    task: Task,
    modelManager: ModelManager,
  ) {
    super();
    this.primaryRunnable = primaryRunnable;
    this.config = config;
    this.task = task;
    this.modelManager = modelManager;
  }

  lc_serializable = false;

  get lc_namespace(): string[] {
    return ["langchain", "fallback"];
  }

  // Add required properties from ConfigurableModel interface
  get _llmType(): string {
    return (this.primaryRunnable as any)._llmType || "fallback_chat";
  }

  get _configurableFields(): any {
    return (this.primaryRunnable as any)._configurableFields || {};
  }

  get _configPrefix(): string {
    return (this.primaryRunnable as any)._configPrefix || "fallback";
  }

  get _queuedMethodOperations(): any {
    return (this.primaryRunnable as any)._queuedMethodOperations || {};
  }

  // Forward other common model properties required by ConfigurableModel
  call(messages: any, options?: any): Promise<any> {
    return this.invoke(messages, options);
  }

  get returnDirect(): boolean {
    return (this.primaryRunnable as any).returnDirect || false;
  }

  // Additional ConfigurableModel-compatible methods
  async stream(input: RunInput, options?: any): Promise<any> {
    return (this.primaryRunnable as any).stream?.(input, options) ?? this.invoke(input, options);
  }

  async batch(inputs: RunInput[], options?: any, batchOptions?: any): Promise<RunOutput[]> {
    return (this.primaryRunnable as any).batch?.(inputs, options, batchOptions) ?? 
           Promise.all(inputs.map(input => this.invoke(input, options)));
  }

  withStructuredOutput(schema: any, options?: any): any {
    return (this.primaryRunnable as any).withStructuredOutput?.(schema, options) ?? this;
  }

  get _defaultConfig(): Record<string, any> {
    return (this.primaryRunnable as any)._defaultConfig || {};
  }

  // Additional ConfigurableModel properties that were missing
  get _model(): any {
    return (this.primaryRunnable as any)._model || this.primaryRunnable;
  }

  async _generate(messages: any[], options?: any): Promise<any> {
    return (this.primaryRunnable as any)._generate?.(messages, options) ?? 
           this.invoke(messages as any, options);
  }

  get _modelParams(): Record<string, any> {
    return (this.primaryRunnable as any)._modelParams || {};
  }

  _removePrefix(key: string): string {
    return (this.primaryRunnable as any)._removePrefix?.(key) ?? key;
  }

  // Forward any other missing methods/properties generically
  [key: string]: any;

  async invoke(
    input: RunInput,
    options?: Partial<RunnableConfig>,
  ): Promise<RunOutput> {
    const modelConfigs = this.modelManager.getModelConfigs(
      this.config,
      this.task,
      this.getPrimaryModel(),
    );

    let lastError: Error | undefined;

    for (let i = 0; i < modelConfigs.length; i++) {
      const modelConfig = modelConfigs[i];
      const modelKey = `${modelConfig.provider}:${modelConfig.modelName}`;

      if (!this.modelManager.isCircuitClosed(modelKey)) {
        logger.warn(`Circuit breaker open for ${modelKey}, skipping`);
        continue;
      }

      try {
        const model = await this.modelManager.initializeModel(modelConfig);
        let runnableToUse = model as any;

        const tools = this.extractBoundTools();
        if (tools) {
          runnableToUse = runnableToUse.bindTools(tools.tools, tools.kwargs);
        }

        const config = this.extractConfig();
        if (config) {
          runnableToUse = runnableToUse.withConfig(config);
        }

        const result = await runnableToUse.invoke(input, options);
        this.modelManager.recordSuccess(modelKey);
        return result;
      } catch (error) {
        logger.warn(
          `${modelKey} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        lastError = error instanceof Error ? error : new Error(String(error));
        this.modelManager.recordFailure(modelKey);
      }
    }

    throw new Error(
      `All fallback models exhausted for task ${this.task}. Last error: ${lastError?.message}`,
    );
  }

  // Accept both proper tools and plain objects, convert internally
  bindTools(
    tools: ToolInput[],
    kwargs?: Record<string, any>,
  ): FallbackRunnable<RunInput, RunOutput> {
    // Convert plain objects to proper tools
    const structuredTools: StructuredToolInterface[] = tools.map(toolInput => {
      if ('invoke' in toolInput && 'lc_namespace' in toolInput) {
        // Already a proper StructuredToolInterface
        return toolInput as StructuredToolInterface;
      } else {
        // Plain object - convert to proper tool
        const plainTool = toolInput as { name: string; description: string; schema: any; };
        return tool(
          () => ({}), // Dummy function - the actual logic is handled elsewhere
          {
            name: plainTool.name,
            description: plainTool.description,
            schema: plainTool.schema,
          }
        );
      }
    });

    const boundPrimary =
      (this.primaryRunnable as any).bindTools?.(structuredTools, kwargs) ??
      this.primaryRunnable;
    return new FallbackRunnable(
      boundPrimary,
      this.config,
      this.task,
      this.modelManager,
    );
  }

  withConfig(
    config: Partial<RunnableConfig>,
  ): FallbackRunnable<RunInput, RunOutput> {
    const configuredPrimary = this.primaryRunnable.withConfig(config);
    return new FallbackRunnable(
      configuredPrimary,
      this.config,
      this.task,
      this.modelManager,
    );
  }

  // change this to ConfigurableChatModel
  private getPrimaryModel(): BaseChatModel {
    let current: any = this.primaryRunnable;

    while (current?.bound) {
      current = current.bound;
    }

    if (current?._llmType) {
      return current as BaseChatModel;
    }

    throw new Error("Could not extract primary model from runnable");
  }

  // bind tools returns RunnableBinding
  private extractBoundTools(): ExtractedTools | null {
    let current: any = this.primaryRunnable;

    while (current) {
      if (current._queuedMethodOperations?.bindTools) {
        const bindToolsOp = current._queuedMethodOperations.bindTools;

        if (Array.isArray(bindToolsOp) && bindToolsOp.length > 0) {
          const tools = bindToolsOp[0] as StructuredToolInterface[];
          const toolOptions = bindToolsOp[1] || {};

          return {
            tools: tools,
            kwargs: {
              tool_choice: (toolOptions as Record<string, any>).tool_choice,
              parallel_tool_calls: (toolOptions as Record<string, any>)
                .parallel_tool_calls,
            },
          };
        }
      }
      current = current.bound;
    }

    return null;
  }

  // ConfigurableChatModel
  private extractConfig(): Partial<RunnableConfig> | null {
    let current: any = this.primaryRunnable;

    while (current) {
      if (current.config) {
        return current.config;
      }
      current = current.bound;
    }

    return null;
  }
}
