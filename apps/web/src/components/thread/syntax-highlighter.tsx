import { PrismAsyncLight as SyntaxHighlighterPrism } from "react-syntax-highlighter";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import html from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import xml from "react-syntax-highlighter/dist/esm/languages/prism/xml";
import dockerfile from "react-syntax-highlighter/dist/esm/languages/prism/docker";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import php from "react-syntax-highlighter/dist/esm/languages/prism/php";
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import { coldarkDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { FC } from "react";

// Register JavaScript/TypeScript languages
SyntaxHighlighterPrism.registerLanguage("js", tsx);
SyntaxHighlighterPrism.registerLanguage("jsx", tsx);
SyntaxHighlighterPrism.registerLanguage("ts", tsx);
SyntaxHighlighterPrism.registerLanguage("tsx", tsx);

// Register other common languages
SyntaxHighlighterPrism.registerLanguage("python", python);
SyntaxHighlighterPrism.registerLanguage("bash", bash);
SyntaxHighlighterPrism.registerLanguage("shell", bash);
SyntaxHighlighterPrism.registerLanguage("sh", bash);
SyntaxHighlighterPrism.registerLanguage("json", json);
SyntaxHighlighterPrism.registerLanguage("yaml", yaml);
SyntaxHighlighterPrism.registerLanguage("yml", yaml);
SyntaxHighlighterPrism.registerLanguage("css", css);
SyntaxHighlighterPrism.registerLanguage("html", html);
SyntaxHighlighterPrism.registerLanguage("xml", xml);
SyntaxHighlighterPrism.registerLanguage("markdown", markdown);
SyntaxHighlighterPrism.registerLanguage("md", markdown);
SyntaxHighlighterPrism.registerLanguage("sql", sql);
SyntaxHighlighterPrism.registerLanguage("dockerfile", dockerfile);
SyntaxHighlighterPrism.registerLanguage("docker", dockerfile);

// Register additional programming languages
SyntaxHighlighterPrism.registerLanguage("java", java);
SyntaxHighlighterPrism.registerLanguage("csharp", csharp);
SyntaxHighlighterPrism.registerLanguage("cs", csharp);
SyntaxHighlighterPrism.registerLanguage("cpp", cpp);
SyntaxHighlighterPrism.registerLanguage("c++", cpp);
SyntaxHighlighterPrism.registerLanguage("c", c);
SyntaxHighlighterPrism.registerLanguage("php", php);
SyntaxHighlighterPrism.registerLanguage("ruby", ruby);
SyntaxHighlighterPrism.registerLanguage("rb", ruby);
SyntaxHighlighterPrism.registerLanguage("go", go);
SyntaxHighlighterPrism.registerLanguage("golang", go);
SyntaxHighlighterPrism.registerLanguage("rust", rust);
SyntaxHighlighterPrism.registerLanguage("rs", rust);

interface SyntaxHighlighterProps {
  children: string;
  language: string;
  className?: string;
}

export const SyntaxHighlighter: FC<SyntaxHighlighterProps> = ({
  children,
  language,
  className,
}) => {
  return (
    <SyntaxHighlighterPrism
      language={language}
      style={coldarkDark}
      customStyle={{
        margin: 0,
        width: "100%",
        background: "transparent",
        padding: "1.5rem 1rem",
      }}
      className={className}
    >
      {children}
    </SyntaxHighlighterPrism>
  );
};

