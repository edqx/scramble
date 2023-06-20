class Person {
    alive: boolean;
    name: string;
    age: number;

    proc kill() {
        static a = 3;
    }
}

let person: Person = Person{ name = "Edward"; age = 18 };