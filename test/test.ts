import fs from "node:fs";
import util from "node:util";
import path from "node:path";
import { readFileTokens } from "../src/lexer";
import { parseAst } from "../src/ast";
import { TokenReader } from "../src/tokenReader";
import { ExpressionKind } from "../src/expressions";

const text = fs.readFileSync(path.resolve(__dirname, "./test.sc"), "utf8");
const tokens = readFileTokens(text);

console.log(tokens);
fs.writeFileSync(path.resolve(__dirname, "./tokens.json"), JSON.stringify(tokens, undefined, 4), "utf8");

console.log(util.inspect(JSON.parse(JSON.stringify(parseAst(new TokenReader(tokens)), (key, val) => {
    if (key === "position") return undefined;
    if (key === "kind") return ExpressionKind[val];
    return val;
})), false, Infinity, true));