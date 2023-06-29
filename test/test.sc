proc farting() {
    return 5;
}

proc shite() {
    return farting;
}

proc abc() {
    return shite;
}

proc main() {
    var d = abc()()();
}