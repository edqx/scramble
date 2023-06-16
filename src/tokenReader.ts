import { Token } from "./token/Token";

export class TokenReader {
    protected cursor: number;

    constructor(public readonly tokens: Token[]) {
        this.cursor = 0;
    }

    getTokensLeft() {
        return this.tokens.length - this.cursor;
    }

    getNextToken(): Token|undefined {
        return this.tokens[this.cursor++];
    }

    peekNextToken(): Token|undefined {
        return this.tokens[this.cursor];
    }

    moveNextWhile(match: (token: Token) => boolean) {
        while (this.getTokensLeft() > 0 && match(this.peekNextToken()!)) {
            this.getNextToken();
        }
    }

    moveBack() {
        this.cursor--;
    }
}