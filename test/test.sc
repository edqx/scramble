proc log(message: string) {

}

proc hello_world(a = 8, b = a) {
    a = a + 1;
    log(a + 5);
}

hello_world();
