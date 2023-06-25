import fs from "node:fs";
import chalk from "chalk";
import util from "node:util";
import path from "node:path";
import { readFileTokens } from "../src/lexer";
import { parseAst } from "../src/parseAst";
import { TokenReader } from "../src/tokenReader";
import { Expression, ExpressionKind, ScriptExpression } from "../src/expression";
import { ErrorCollector } from "../src/errorCollector";
import { ProcedureSymbol, SymbolFlag, SymbolType, IdGenerator, SymbolDeclarationStore, staticallyAnalyseBlock, staticallyAnalyseExpressionDeclaration } from "../src/compiler";
import { Type } from "../src/compiler/types";
import { Sprite } from "../src/scratch/Sprite";
import { ExistingTypes } from "../src/compiler/ExistingTypes";

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
const idGenerator = new IdGenerator;
const symbols = new SymbolDeclarationStore(idGenerator);
const traversal: Set<Expression> = new Set;
for (const expression of ast.expressions) {
    staticallyAnalyseExpressionDeclaration(scriptWrapper, expression, symbols, errorCollector);
}
staticallyAnalyseBlock(scriptWrapper, traversal, ast.expressions, symbols, errorCollector);

console.log(util.inspect(JSON.parse(JSON.stringify(scriptWrapper, (key, val) => {
    if (key === "position" || key === "expression" || key === "parent") return undefined;
    if (key === "flags") return [...val].map(flag => SymbolFlag[flag]);
    if (key === "type") return SymbolType[val];
    if (key === "symbols" || key === "children") return Object.fromEntries([...val.entries()]);
    if (key === "kind") return ExpressionKind[val];
    return val;
})), false, Infinity, true));

const existingTypes = new ExistingTypes;
const sprite = new Sprite;
for (const [ , symbol ] of scriptWrapper.symbols) {
    if (symbol instanceof ProcedureSymbol) {
        symbol.generateBlocks(idGenerator, existingTypes, sprite, errorCollector);
    }
}
console.log(JSON.stringify(sprite, (key, val) => {
    if (key === "variables" || key === "lists" || key === "broadcasts" || key === "blocks") return Object.fromEntries([...val.entries()]);
    return val;
}, 4));

const compilerErrors = errorCollector.getErrors();
console.log("\n\n");
console.log("Found %s error%s in %s", compilerErrors.length, compilerErrors.length === 1 ? "" : "s", chalk.bgGrey(path.resolve(__dirname, "./text.sc")));
console.log(compilerErrors.map((err, i) => err.generateString(text, i)).join("\n\n"));