import fs from "node:fs";
import util from "node:util";
import path from "node:path";
import chalk from "chalk";
import JSZip from "jszip";
import { readFileTokens } from "../src/lexer";
import { parseAst } from "../src/parseAst";
import { TokenReader } from "../src/tokenReader";
import { Expression, ExpressionKind, ScriptExpression } from "../src/expression";
import { ErrorCollector } from "../src/errorCollector";
import { ProcedureSymbol, SymbolFlag, SymbolType, IdGenerator, SymbolDeclarationStore, staticallyAnalyseBlock, staticallyAnalyseExpressionDeclaration, ClassSymbol, CodeSymbol } from "../src/compiler";
import { Sprite } from "../src/compiler/definitions/Sprite";
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
staticallyAnalyseBlock(scriptWrapper, traversal, ast.expressions, undefined, 0, symbols, errorCollector);

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
function generateBlocksForSymbols(symbols: Map<string, CodeSymbol>) {
    for (const [ , symbol ] of symbols) {
        if (symbol instanceof ProcedureSymbol) {
            symbol.generateBlocks(sprite, idGenerator, existingTypes, errorCollector);
        } else if (symbol instanceof ClassSymbol) {
            generateBlocksForSymbols(symbol.children);
        }
    }
}
generateBlocksForSymbols(scriptWrapper.symbols);
const spriteJson = JSON.parse(JSON.stringify(sprite, (key, val) => {
    if (key === "variables" || key === "lists" || key === "broadcasts" || key === "blocks") return Object.fromEntries([...val.entries()]);
    return val;
}, 4));
// console.log(spriteJson);

fs.writeFileSync(path.resolve(__dirname, "./blocks.json"), JSON.stringify(spriteJson, undefined, 4), "utf8");

const projectJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./proj/project.json"), "utf8"));
projectJson.targets[0] = {
    ...projectJson.targets[0],
    ...spriteJson
};
fs.writeFileSync(path.resolve(__dirname, "./proj/project.json"), JSON.stringify(projectJson), "utf8");

const zip = new JSZip;
const files = fs.readdirSync(path.resolve(__dirname, "./proj"));
for (const file of files) {
    zip.file(file, fs.readFileSync(path.resolve(__dirname, "./proj/", file), "utf8"));
}
zip.generateAsync({ type: "nodebuffer" }).then(content => {
    fs.writeFileSync(path.resolve(__dirname, "./proj-out.sb3"), content);
});

const compilerErrors = errorCollector.getErrors();
console.log("\n\n");
console.log("Found %s error%s in %s", compilerErrors.length, compilerErrors.length === 1 ? "" : "s", chalk.bgGrey(path.resolve(__dirname, "./text.sc")));
console.log(compilerErrors.map((err, i) => err.generateString(text, i)).join("\n\n"));