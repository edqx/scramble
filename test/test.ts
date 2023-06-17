import fs from "node:fs";
import chalk from "chalk";
import util from "node:util";
import path from "node:path";
import { readFileTokens } from "../src/lexer";
import { parseAst } from "../src/ast";
import { TokenReader } from "../src/tokenReader";
import { ExpressionKind } from "../src/expressions";
import { ErrorCollector } from "../src/errorCollector";

const errorCollector = new ErrorCollector;

const text = fs.readFileSync(path.resolve(__dirname, "./test.sc"), "utf8");
const tokens = readFileTokens(text, errorCollector);

console.log(tokens);
fs.writeFileSync(path.resolve(__dirname, "./tokens.json"), JSON.stringify(tokens, undefined, 4), "utf8");

console.log(util.inspect(JSON.parse(JSON.stringify(parseAst(new TokenReader(tokens)), (key, val) => {
    if (key === "position") return undefined;
    if (key === "kind") return ExpressionKind[val];
    return val;
})), false, Infinity, true));

const compilerErrors = errorCollector.getErrors();
console.log("\n\n");
console.log("Found %s error%s in %s", compilerErrors.length, compilerErrors.length === 1 ? "" : "s", chalk.bgGrey(path.resolve(__dirname, "./text.sc")));
console.log(compilerErrors.map((err, i) => err.generateString(text, i)).join("\n\n"));