class Vector2 {
    x: number;
    y: number;
}

class Person {
    name: string;
    position: Vector2;
    age: number;
}

proc sayHello(person: Person) {
    let hello = person;
}

proc main() {
    var person = Person{ name="Edward"; position=Vector2{ x=0; y=0; }; age = 18; };
    sayHello(person);
}