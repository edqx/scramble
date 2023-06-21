import fs from "node:fs";
import chalk from "chalk";
import util from "node:util";
import path from "node:path";
import { readFileTokens } from "../src/lexer";
import { parseAst } from "../src/ast";
import { TokenReader } from "../src/tokenReader";
import { Expression, ExpressionKind, ScriptExpression } from "../src/expression";
import { ErrorCollector } from "../src/errorCollector";
import { ProcedureSymbol, SymbolFlag, SymbolType } from "../src/compiler/definitions";
import { createProjectOutline, SymbolDeclarationStore } from "../src/compiler";
import { staticallyAnalyseBlock, staticallyAnalyseExpressionDeclaration } from "../src/compiler/analysis";

const errorCollector = new ErrorCollector;

const text = fs.readFileSync(path.resolve(__dirname, "./test.sc"), "utf8");
const tokens = readFileTokens(text, errorCollector);

console.log(tokens);
fs.writeFileSync(path.resolve(__dirname, "./tokens.json"), JSON.stringify(tokens, undefined, 4), "utf8");

const ast = parseAst(new TokenReader(tokens), errorCollector);
console.log(util.inspect(JSON.parse(JSON.stringify(ast, (key, val) => {
    if (key === "position") return undefined;
    if (key === "kind") return ExpressionKind[val];
    return val;
})), false, Infinity, true));

const scriptExpression = new ScriptExpression(ast.expressions);

const scriptWrapper = new ProcedureSymbol("", undefined, "#script", scriptExpression);
const symbols = new SymbolDeclarationStore;
const traversal: Set<Expression> = new Set;
for (const expression of ast.expressions) {
    staticallyAnalyseExpressionDeclaration(scriptWrapper, expression, symbols, errorCollector);
}
staticallyAnalyseBlock(scriptWrapper, traversal, ast.expressions, symbols, errorCollector);

createProjectOutline(ast.expressions, scriptWrapper, symbols, errorCollector);
console.log(util.inspect(JSON.parse(JSON.stringify(scriptWrapper, (key, val) => {
    if (key === "position" || key === "expression" || key === "parent") return undefined;
    if (key === "flags") return [...val].map(flag => SymbolFlag[flag]);
    if (key === "type") return SymbolType[val];
    if (key === "symbols" || key === "children") return Object.fromEntries([...val.entries()]);
    if (key === "kind") return ExpressionKind[val];
    return val;
})), false, Infinity, true))

const compilerErrors = errorCollector.getErrors();
console.log("\n\n");
console.log("Found %s error%s in %s", compilerErrors.length, compilerErrors.length === 1 ? "" : "s", chalk.bgGrey(path.resolve(__dirname, "./text.sc")));
console.log(compilerErrors.map((err, i) => err.generateString(text, i)).join("\n\n"));