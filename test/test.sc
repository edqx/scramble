class Dog {
    name: string;
    age: number;

    proc setNameTo(name: string) {
        this.name = name;
        return name;
    }

    proc setAgeTo(age: number) {
        this.age = age;
        return age;
    }
}

proc main() {
    var dog = Dog{ name="Barney"; age=13 };
    dog.setNameTo("Sprout");
    dog.setAgeTo(14);
}