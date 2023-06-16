import { StringReader } from "./stringReader";
import { CloseParenthesisToken, KeywordToken, NewlineToken, NumberToken, OpenParenthesisToken, OperatorToken, StatementBreakToken, StringToken, Token } from "./token";

function readSingleToken(stringReader: StringReader) {
    const context = stringReader.createContext();

    const keyword = KeywordToken.read(context);
    if (keyword !== null) return keyword;

    const number = NumberToken.read(context);
    if (number !== null) return number;
    
    const string = StringToken.read(context);
    if (string !== null) return string;

    const operator = OperatorToken.read(context);
    if (operator !== null) return operator;

    const openParenthesis = OpenParenthesisToken.read(context);
    if (openParenthesis !== null) return openParenthesis;

    const closeParenthesis = CloseParenthesisToken.read(context);
    if (closeParenthesis !== null) return closeParenthesis;

    const statementBreak = StatementBreakToken.read(context);
    if (statementBreak !== null) return statementBreak;
    
    const newline = NewlineToken.read(context);
    if (newline !== null) return newline;

    context.readNextChar();
    context.readWhileRegexMatch(/\s/);
    return null;
}

export function readFileTokens(file: string) {
    const stringReader = new StringReader(file);
    const tokens: Token[] = [];
    while (stringReader.getCharsLeft() > 0) {
        const token = readSingleToken(stringReader);
        if (token === null)
            continue;

        tokens.push(token);
    }
    return tokens;
}