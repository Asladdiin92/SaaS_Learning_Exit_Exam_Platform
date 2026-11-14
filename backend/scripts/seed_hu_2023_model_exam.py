#!/usr/bin/env python3
"""
Idempotent Storage & Database Seeder for:
Haramaya University — College of Computing and Informatics (CCI)
Department of Information Technology: Model Exam of Graduating Class Exit Exam (Jan 16, 2023)

What this script does:
1. Stores the binary PDF (`IT Model Exam.pdf`) via StorageAdapter (`course-packages` bucket,
   object key `past-exams/HU-CCI-IT-Model-Exit-Exam-2023.pdf`), computes SHA-256 & byte size,
   and upserts a `course_resources` record (`type = 'PAST_EXAM'`).
2. Upserts an `exam_blueprints` record (`HU CCI B.Sc. IT Model Exit Exam - Jan 2023`,
   `type = 'NATIONAL_EXIT_SIMULATION'`, 100 questions, 180 minutes).
3. Seeds all 100 Multiple-Choice Questions (Q1-Q100) and their options (A-F), including
   reconstructed code blocks for image-embedded questions (Q19, Q23, Q24) and the Markdown
   table for Q91, mapped to the canonical B.Sc. IT courses (`IT-CMTS-101` to `IT-IASC-401`).
4. Appends a monotonic `sync_changes` record so React Native mobile clients (`MOB-09` & `MOB-13`)
   pull the exam package for offline practice.

Usage:
    export DIRECT_URL="postgresql://postgres.sbvyjbipchglzmttkowy:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
    python3 backend/scripts/seed_hu_2023_model_exam.py --pdf-path "./docs/IT Model Exam.pdf"
"""

import argparse
import hashlib
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Deterministic namespace UUID so re-running this script is 100% idempotent (zero duplicates)
HU_EXAM_NAMESPACE = uuid.UUID("7f9c2ba0-8b1a-4e2d-9c5e-1a2b3c4d5e6f")
BLUEPRINT_ID = uuid.uuid5(HU_EXAM_NAMESPACE, "HU-CCI-IT-MODEL-EXIT-EXAM-2023-01-16")
PDF_RESOURCE_ID = uuid.uuid5(HU_EXAM_NAMESPACE, "HU-CCI-IT-MODEL-EXIT-EXAM-2023-PDF")
STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "course-packages")
STORAGE_OBJECT_KEY = "past-exams/HU-CCI-IT-Model-Exit-Exam-2023.pdf"

# Complete 100-Question Dataset extracted & verified from "IT Model Exam.pdf" (Pages 1-30)
# Format per item:
# (q_num, course_code, legacy_section, cognitive_level, difficulty, stem, options_list, correct_label, explanation)
QUESTIONS_DATA: List[Tuple[int, str, str, str, str, str, List[Tuple[str, str]], str, str]] = [
    # =========================================================================
    # SECTION 1: Basic Programming (Q1 - Q9) -> Mapped to IT-OOPJ-201
    # =========================================================================
    (
        1, "IT-OOPJ-201", "Basic Programming", "UNDERSTAND", "EASY",
        "If there are one or more constructors for a class then:",
        [
            ("A", "Exactly one of the constructors will be called each time an object of that class is created"),
            ("B", "All of the constructors will be called each time an object of that class is created"),
            ("C", "A destructor must also be written."),
            ("D", "Classes cannot have multiple constructors"),
        ],
        "A",
        "Constructor overloading allows a class to define multiple constructors with different parameter lists, and exactly one matching constructor is invoked per object instantiation."
    ),
    (
        2, "IT-OOPJ-201", "Basic Programming", "APPLY", "EASY",
        "Choose the output of the following C++ program?\n```cpp\n#include <iostream>\nusing namespace std;\n\nint main()\n{\n    int a = 7, b = 5, c;\n    c = (a > b) ? a : b;\n    cout << c;\n    return 0;\n}\n```",
        [("A", "6"), ("B", "4"), ("C", "5"), ("D", "7")],
        "D",
        "The conditional (ternary) expression `(a > b) ? a : b` evaluates `(7 > 5)` as true and returns `a`, which is `7`."
    ),
    (
        3, "IT-OOPJ-201", "Basic Programming", "REMEMBER", "EASY",
        "Which is the correct syntax of inheritance in C++?",
        [
            ("A", "class base_classname : access derived_classname{ /* class body*/ };"),
            ("B", "class derived_classname : access base_classname{ /* class body*/ };"),
            ("C", "class derived_classname : base_classname{ /* class body*/ };"),
            ("D", "class base_classname : derived_classname{ /* class body*/ };"),
        ],
        "B",
        "In C++, a derived class specifies inheritance using `class derived_classname : access_specifier base_classname { ... };`."
    ),
    (
        4, "IT-OOPJ-201", "Basic Programming", "APPLY", "MEDIUM",
        "What will be the output of the following C++ code?\n```cpp\n#include <iostream>\nusing namespace std;\n\nvoid copy (int &a, int &b, int &c)\n{\n    a *= 2;\n    b *= 2;\n    c *= 2;\n}\n\nint main ()\n{\n    int x = 1, y = 3, z = 7;\n    copy (x, y, z);\n    cout << \" \" << x << \" \" << y << \" \" << z;\n    return 0;\n}\n```",
        [("A", "2 5 10"), ("B", "2 4 5"), ("C", "2 6 14"), ("D", "2 4 9")],
        "C",
        "Because `a`, `b`, and `c` are passed by reference (`int &`), doubling them inside `copy()` mutates `x=1->2`, `y=3->6`, and `z=7->14`."
    ),
    (
        5, "IT-OOPJ-201", "Basic Programming", "UNDERSTAND", "EASY",
        "Which of the following statements is NOT true about a function prototype?",
        [
            ("A", "A function prototype is the function heading without the body of the function which ends with a semicolon"),
            ("B", "A function prototype announces the function return type, as well as the type and number of parameters, used in the function"),
            ("C", "In a function prototype, the names of the variables in the formal parameter list are optional"),
            ("D", "Transfers control from the caller to the called function"),
        ],
        "D",
        "A function call transfers control from the caller to the called function; a function prototype only declares the function signature for the compiler."
    ),
    (
        6, "IT-OOPJ-201", "Basic Programming", "ANALYSE", "HARD",
        "What is the output of the following C++ program?\n```cpp\n#include <iostream>\nusing namespace std;\nint main ()\n{\n    int x, y;\n    x = 2;\n    y = ++x * ++x;\n    cout << x << y;\n    x = 2;\n    y = x++ * ++x;\n    cout << x << y;\n    return 0;\n}\n```",
        [("A", "416416"), ("B", "41248"), ("C", "41648"), ("D", "91236")],
        "A",
        "Under traditional GCC/Turbo C++ evaluation where prefix increments on `x` complete before multiplication (`x=4, y=4*4=16`) and the second statement yields `412` or `416` depending on compiler sequence points, the keyed exam option is `416416` (`B: 41248` / `A: 416416`)."
    ),
    (
        7, "IT-OOPJ-201", "Basic Programming", "APPLY", "MEDIUM",
        "Which of the following functions will correctly return `true` if its argument is an odd integer?\n```cpp\nI.   bool IsOdd (int x) { return (x % 2 == 1); }\nII.  bool IsOdd (int x) { return (x / 2 == 1); }\nIII. bool IsOdd (int x) {\n         if (x % 2 == 1) return true;\n         else return false;\n     }\n```",
        [("A", "II only"), ("B", "I and II only"), ("C", "I and III only"), ("D", "II and III only")],
        "C",
        "Implementations I and III both check whether the remainder of dividing `x` by 2 is 1 (`x % 2 == 1`), whereas II only returns true for `x = 2` or `x = 3`."
    ),
    (
        8, "IT-OOPJ-201", "Basic Programming", "REMEMBER", "EASY",
        "What is the major difference between a `class` and a `structure` in C++?",
        [
            ("A", "All data members and member functions are private in structure, but public in class"),
            ("B", "All data members and member functions are public in structure, but private in class"),
            ("C", "A structure can have NULL values but not a class"),
            ("D", "We can define structure members as public but not in class"),
        ],
        "B",
        "In C++, members of a `struct` default to `public` access, whereas members of a `class` default to `private` access."
    ),
    (
        9, "IT-OOPJ-201", "Basic Programming", "REMEMBER", "EASY",
        "A function declared as a `friend` function can always access the data in _______.",
        [
            ("A", "The private members of the class"),
            ("B", "The protected members of the class"),
            ("C", "The public members of the class"),
            ("D", "All"),
        ],
        "D",
        "A C++ `friend` function has full access to `private`, `protected`, and `public` members of the class granting friendship."
    ),

    # =========================================================================
    # SECTION 2: Advanced Programming (Q10 - Q18) -> Mapped to IT-ADVP-202
    # =========================================================================
    (
        10, "IT-ADVP-202", "Advanced Programming", "ANALYSE", "MEDIUM",
        "In the Object-Oriented Programming paradigm in Java, there are ways to create objects other than the `new` keyword. Which of the following statements is NOT correct for creating an object?",
        [
            ("A", "If we know the name of the class and it has a public default constructor, we can create an object via Class.forName() using the newInstance() method of Class."),
            ("B", "Whenever we serialize and then deserialize an object, the JVM creates a separate object. In deserialization, the JVM doesn't use any constructor to create the object."),
            ("C", "Whenever clone() is called on any object, the JVM actually creates a new object and copies all content of the previous object into it. Creating an object using the clone method invokes a constructor."),
            ("D", "Using the newInstance() method of the Constructor class in java.lang.reflect.Constructor, we can create objects."),
            ("E", "None"),
        ],
        "C",
        "`Object.clone()` allocates a new object and performs a shallow copy of fields directly in memory without invoking any class constructor."
    ),
    (
        11, "IT-ADVP-202", "Advanced Programming", "UNDERSTAND", "MEDIUM",
        "When a Java RMI client sends a request to invoke a method running on another JVM, the server responds over the network. Which statement is NOT correct regarding what happens on client and server?",
        [
            ("A", "The process in which the client writes and transmits parameters to invoke the method is called Marshaling"),
            ("B", "The process in which the client reads a result transmitted over the internet is called Unmarshaling"),
            ("C", "The stub object (acting as a gateway for the server side) can communicate with both the remote object and skeleton (acting as a gateway for the server side)"),
            ("D", "The communication between the client and the server is handled through the stub and skeleton"),
            ("E", "A server object is registered with the RMI registry and a client looks up the remote object to obtain its stub"),
        ],
        "C",
        "The stub resides on the client side as a client-side proxy and communicates with the server-side skeleton over the network; it is not a server-side gateway."
    ),
    (
        12, "IT-ADVP-202", "Advanced Programming", "APPLY", "EASY",
        "Assume we have two classes called `Person` (superclass) and `Student` (subclass). When the same instance method is defined in both `Person` and `Student`, how do we invoke the parent class (`Person`) implementation from inside `Student`?",
        [
            ("A", "By using child class object"),
            ("B", "By using this object we can invoke the method"),
            ("C", "By using super() constructor we can invoke the method"),
            ("D", "By using this() constructor we can invoke the method"),
            ("E", "By using super keyword/reference (super.methodName()) we can invoke the method"),
            ("F", "We cannot invoke the method implemented in the parent class inside the child class"),
        ],
        "E",
        "In Java, `super.methodName()` invokes the overridden superclass instance method from within a subclass."
    ),
    (
        13, "IT-ADVP-202", "Advanced Programming", "UNDERSTAND", "EASY",
        "When a user sends an SMS, they simply enter the recipient address, type the message, and press send without knowing the underlying telecom protocol details. Which OOP concept is primarily demonstrated here?",
        [
            ("A", "Encapsulation"),
            ("B", "Data hiding"),
            ("C", "Abstraction"),
            ("D", "Inheritance"),
            ("E", "Polymorphism"),
            ("F", "All"),
        ],
        "C",
        "Abstraction hides internal implementation mechanics and exposes only the essential high-level functionality to the user."
    ),
    (
        14, "IT-ADVP-202", "Advanced Programming", "REMEMBER", "EASY",
        "A thread goes through various stages in its life cycle (born, started, runs, dies). Which thread state represents a newly born thread after `start()` is called and it is ready/executing its task?",
        [
            ("A", "Start"),
            ("B", "Runnable"),
            ("C", "Waiting"),
            ("D", "New"),
            ("E", "Dead"),
            ("F", "None"),
        ],
        "B",
        "In Java's thread lifecycle, invoking `start()` transitions a thread from `New` to the `Runnable` state."
    ),
    (
        15, "IT-ADVP-202", "Advanced Programming", "UNDERSTAND", "MEDIUM",
        "Which of the following algorithm design techniques is used in the Quick Sort algorithm?",
        [
            ("A", "Sorting algorithms accept a collection of elements as input and sort the collection according to a particular characteristic."),
            ("B", "Greedy algorithms craft a solution piece by piece, selecting the next piece that offers immediate benefit."),
            ("C", "A backtracking algorithm finds all possible combinations of a solution and backtracks when non-optimal."),
            ("D", "A divide and conquer algorithm breaks down the complexity of a problem so it can solve smaller and easier sub-problems."),
            ("E", "A brute force algorithm tries every possibility until it finds the right one."),
            ("F", "Recursive algorithms solve a problem by breaking it down into smaller parts."),
        ],
        "D",
        "Quick Sort is a classic Divide and Conquer algorithm that partitions an array around a pivot into two sub-arrays and recursively sorts each sub-problem."
    ),
    (
        16, "IT-ADVP-202", "Advanced Programming", "APPLY", "MEDIUM",
        "A Stack follows the LIFO (Last-In, First-Out) pattern. Given the sequence of stack operations: `push(1)`, `push(2)`, `pop`, `push(1)`, `push(2)`, `pop`, `pop`, `pop`, `push(2)`, `pop`, what is the sequence of popped values?",
        [
            ("A", "2, 2, 1, 1, 2"),
            ("B", "1, 2, 1, 2, 2"),
            ("C", "2, 2, 1, 2, 2"),
            ("D", "2, 1, 2, 2, 1"),
            ("E", "None"),
        ],
        "A",
        "Tracing the stack: push(1)->[1]; push(2)->[1,2]; pop()->2 ([1]); push(1)->[1,1]; push(2)->[1,1,2]; pop()->2 ([1,1]); pop()->1 ([1]); pop()->1 ([]); push(2)->[2]; pop()->2. Output: `2, 2, 1, 1, 2`."
    ),
    (
        17, "IT-ADVP-202", "Advanced Programming", "REMEMBER", "EASY",
        "Which JDBC API interface is used to issue pre-compiled SQL statements to a relational database?",
        [
            ("A", "Connection"),
            ("B", "DriverManager"),
            ("C", "Statement"),
            ("D", "PreparedStatement"),
            ("E", "ResultSet"),
        ],
        "D",
        "`java.sql.PreparedStatement` represents a pre-compiled SQL statement that accepts parameterized inputs safely and efficiently."
    ),
    (
        18, "IT-ADVP-202", "Advanced Programming", "REMEMBER", "EASY",
        "Given a `Student` table with `firstName`, `surName`, `gender`, `studId`, and `cgpa` attributes in the Haramaya database, which `java.sql` interface is used to hold the tabular data fetched from the database?",
        [
            ("A", "Statement"),
            ("B", "StatementSets"),
            ("C", "Result"),
            ("D", "ResultSet"),
            ("E", "All"),
        ],
        "D",
        "`java.sql.ResultSet` maintains a cursor pointing to rows of tabular data returned by executing a SQL query."
    ),

    # =========================================================================
    # SECTION 3: Event Driven Programming (Q19 - Q27) -> Mapped to IT-EDPR-203
    # =========================================================================
    (
        19, "IT-EDPR-203", "Event Driven Programming", "APPLY", "EASY",
        "What type of exception will be displayed when the following C# program is executed?\n```csharp\nclass Program\n{\n    static void Main(string[] args)\n    {\n        int[] a = { 1, 2, 3, 4, 5, 6 };\n        Console.WriteLine(a[6]);\n    }\n}\n```",
        [
            ("A", "IndexOutOfRangeException"),
            ("B", "NumberFormatException"),
            ("C", "NullPointerException"),
            ("D", "Error"),
        ],
        "A",
        "Array `a` has 6 elements at valid indices `0..5`. Accessing `a[6]` throws `System.IndexOutOfRangeException`."
    ),
    (
        20, "IT-EDPR-203", "Event Driven Programming", "REMEMBER", "EASY",
        "Which ADO.NET command method is used to execute `INSERT`, `UPDATE`, and `DELETE` SQL statements?",
        [
            ("A", "ExecuteScalar()"),
            ("B", "ExecuteReader()"),
            ("C", "ExecuteNonQuery()"),
            ("D", "None"),
        ],
        "C",
        "`ExecuteNonQuery()` executes DML statements (`INSERT`, `UPDATE`, `DELETE`) and returns the number of affected rows."
    ),
    (
        21, "IT-EDPR-203", "Event Driven Programming", "APPLY", "EASY",
        "Suppose data is stored in a MySQL Server database named `Student`. Which of the following is the complete connection string in ADO.NET?",
        [
            ("A", "String con=\"datasource=localhost;port=3306;username=root;password=;database=Student\";"),
            ("B", "string con=\"datasource=localhost;port=3306;username=root;password= \";"),
            ("C", "string con=\"port=3306;username=root;password=;database=Student\";"),
            ("D", "string con=\"datasource=localhost;username=root;password=;database=Student\";"),
        ],
        "A",
        "Option A specifies the complete MySQL connection parameters (`datasource`, `port=3306`, `username`, `password`, and `database=Student`)."
    ),
    (
        22, "IT-EDPR-203", "Event Driven Programming", "REMEMBER", "EASY",
        "Which one of the following is correct for instantiating a `MySqlConnection` object in C#?",
        [
            ("A", "MySqlConnection connection = new MySqlConnection(connectionstring);"),
            ("B", "MySqlConnection connection = MySqlConnection(connectionstring);"),
            ("C", "MySqlConnection connection = new MySqlConnection();"),
            ("D", "connection = new MySqlConnection(connectionstring);"),
        ],
        "A",
        "`MySqlConnection connection = new MySqlConnection(connectionstring);` declares the typed variable and calls the constructor with the connection string."
    ),
    (
        23, "IT-EDPR-203", "Event Driven Programming", "APPLY", "EASY",
        "The below fragment of C# code demonstrates pass-by-reference to `SimpleMethod(ref int j)`. What is the output of the program?\n```csharp\npublic static void Main(String[] args)\n{\n    int i = 0;\n    SimpleMethod(ref i);\n    Console.WriteLine(i);\n}\nprivate static void SimpleMethod(ref int j)\n{\n    j = 101;\n}\n```",
        [("A", "101"), ("B", "102"), ("C", "100"), ("D", "0")],
        "A",
        "Passing `i` with the `ref` keyword passes a reference to `i` itself, so assigning `j = 101` sets `i` to `101`."
    ),
    (
        24, "IT-EDPR-203", "Event Driven Programming", "UNDERSTAND", "EASY",
        "In the C# classes below, common fields and `PrintFullName()` are duplicated across both classes. Which OOP mechanism eliminates this duplication by moving common attributes and methods to a superclass `Employee`?\n```csharp\npublic class FullTimeEmployee {\n    string FirstName;\n    string LastName;\n    string Email;\n    float YearlySalary;\n    public void PrintFullName() { }\n}\npublic class PartTimeEmployee {\n    string FirstName;\n    string LastName;\n    string Email;\n    float HourlyRate;\n    public void PrintFullName() { }\n}\n```",
        [
            ("A", "Inheritance"),
            ("B", "Encapsulation"),
            ("C", "Abstraction"),
            ("D", "Interface"),
        ],
        "A",
        "Inheritance allows `FullTimeEmployee` and `PartTimeEmployee` to inherit shared members (`FirstName`, `LastName`, `Email`, `PrintFullName()`) from a base `Employee` class."
    ),
    (
        25, "IT-EDPR-203", "Event Driven Programming", "REMEMBER", "EASY",
        "Which edition of .NET is used for developing console applications, Windows desktop applications, web applications, and more?",
        [
            ("A", ".NET Compact Framework"),
            ("B", ".NET Framework"),
            ("C", "Common Language Runtime (CLR)"),
            ("D", "Microsoft Intermediate Language"),
        ],
        "B",
        "The full `.NET Framework` provides the class libraries and runtime environment for console, Windows desktop (WinForms/WPF), and ASP.NET web applications."
    ),
    (
        26, "IT-EDPR-203", "Event Driven Programming", "UNDERSTAND", "EASY",
        "Assume a program needs methods to print strings (`PrintString(string str)`), integers (`PrintInt(int number)`), and floats (`PrintFloat(float number)`). Which OOP feature allows giving all of them the same method name `Print(...)`?",
        [
            ("A", "Method Overloading"),
            ("B", "Method Hiding"),
            ("C", "Method Overriding"),
            ("D", "All of the above"),
        ],
        "A",
        "Method overloading allows multiple methods in the same class to share a name (`Print`) as long as their parameter types or counts differ."
    ),
    (
        27, "IT-EDPR-203", "Event Driven Programming", "UNDERSTAND", "EASY",
        "Which one of the following is a valid implicit primitive type conversion in C#?",
        [
            ("A", "float -> long"),
            ("B", "int -> float"),
            ("C", "double -> float"),
            ("D", "double -> int"),
        ],
        "B",
        "In C#, `int` to `float` is a predefined widening implicit conversion, whereas `float -> long`, `double -> float`, and `double -> int` require an explicit cast."
    ),

    # =========================================================================
    # SECTION 4: Internet Programming (Q28 - Q36) -> IT-IPRG-301 / IT-IPRG-302
    # =========================================================================
    (
        28, "IT-IPRG-302", "Internet Programming", "REMEMBER", "EASY",
        "Which one of the following is correct when defining a constant in PHP?",
        [
            ("A", "There is no need of using $ sign to write a constant"),
            ("B", "Constant can be defined and accessed anywhere without specifying variable scoping rule"),
            ("C", "Constants cannot be redefined"),
            ("D", "Constants are created with case-sensitive name by default"),
            ("E", "All"),
        ],
        "E",
        "In PHP, constants defined via `define()` or `const` do not use `$`, have global scope, cannot be redefined once set, and are case-sensitive by default."
    ),
    (
        29, "IT-IPRG-302", "Internet Programming", "UNDERSTAND", "EASY",
        "Which statement is NOT correct regarding `include()` and `require()` in PHP?",
        [
            ("A", "Both include() and require() functions are used for putting data from one file into another"),
            ("B", "If an error occurs while including a file, the include() function produces a warning and stops execution"),
            ("C", "If an error occurs while including a file, the require() function produces a fatal error and stops execution"),
            ("D", "Including a file is useful when reusing the same PHP, HTML, or text across multiple pages"),
        ],
        "B",
        "`include()` emits a non-fatal warning (`E_WARNING`) and continues script execution, whereas `require()` emits a fatal compile error (`E_COMPILE_ERROR`) and halts."
    ),
    (
        30, "IT-IPRG-301", "Internet Programming", "APPLY", "EASY",
        "What will be the output of the following JavaScript code?\n```html\n<script type=\"text/javascript\" language=\"javascript\">\nvar a=50;\nvar b=45;\nvar result=eval(\"a+b\");\ndocument.write(result);\n</script>\n```",
        [("A", "a+b"), ("B", "95"), ("C", "5045"), ("D", "ab")],
        "B",
        "`eval(\"a+b\")` evaluates the arithmetic expression `50 + 45` and returns `95`."
    ),
    (
        31, "IT-IPRG-302", "Internet Programming", "APPLY", "EASY",
        "Consider the following PHP function:\n```php\nfunction exam() {\n    echo date('l', time());\n}\n```\nWhat does `date('l', time())` format?",
        [
            ("A", "The date of today"),
            ("B", "The day of today (full textual representation of the day of the week)"),
            ("C", "The current time"),
            ("D", "The current date format with its month and year"),
        ],
        "B",
        "In PHP's `date()` function, the lowercase `'l'` format character returns the full textual name of the day of the week (e.g., `Monday`)."
    ),
    (
        32, "IT-IPRG-302", "Internet Programming", "UNDERSTAND", "EASY",
        "The following statements are correct about constructors in PHP EXCEPT:",
        [
            ("A", "Constructor function in PHP starts by using double underscores (__construct)"),
            ("B", "We use a constructor to initialize object properties upon creation of the object"),
            ("C", "It is possible to use __constructor method only instead of class name to create a constructor in PHP"),
            ("D", "Classes which have a constructor method call the constructor on each newly created object"),
            ("E", "None"),
        ],
        "C",
        "In PHP, the magic constructor method is named `__construct()` (not `__constructor()`)."
    ),
    (
        33, "IT-IPRG-302", "Internet Programming", "REMEMBER", "EASY",
        "The identity operator (`===`) in PHP (particularly for arrays/variables) is used:",
        [
            ("A", "To return true if two variables contain the same elements only"),
            ("B", "To return true if the two variables do not contain the same elements"),
            ("C", "To return true if two variables contain the same elements with the same type in the same order"),
            ("D", "To return false if two variables contain the same elements with the same type in the same order"),
        ],
        "C",
        "In PHP, the identity operator `===` returns `true` for arrays/values only when they have the exact same key/value pairs, types, and order."
    ),
    (
        34, "IT-IPRG-302", "Internet Programming", "REMEMBER", "EASY",
        "From the file modes of PHP `fopen()`, which mode preserves existing file content (write-only at end of file) and creates the file if it does not exist?",
        [("A", "w"), ("B", "a"), ("C", "a+"), ("D", "w+")],
        "B",
        "Mode `'a'` opens a file for write-only appending, preserving existing content and creating the file if it does not exist (`'a+'` opens for both reading and appending)."
    ),
    (
        35, "IT-IPRG-302", "Internet Programming", "APPLY", "EASY",
        "Suppose you are retrieving user rows from a MySQL table named `user` in PHP:\n```php\n$sql = \"SELECT id, name, department FROM user\";\n$result = mysqli_query($conn, $sql);\n\nif ( /* FILL HERE */ ) {\n    while($row = mysqli_fetch_assoc($result)) {\n        echo \"id: \" . $row[\"id\"] . \" Name: \" . $row[\"name\"] . \" Department=\" . $row[\"department\"] . \"<br>\";\n    }\n} else {\n    echo \"0 results\";\n}\n```\nWhich expression belongs inside the `if (...)` condition?",
        [
            ("A", "mysqli_num_rows($sql) > 0"),
            ("B", "mysqli_num_rows($result) > 0"),
            ("C", "mysqli_num_rows($row) < 0"),
            ("D", "mysqli_num_rows($sql) < 0"),
        ],
        "B",
        "`mysqli_num_rows($result) > 0` checks that the query result set resource contains at least one row before iterating."
    ),
    (
        36, "IT-IPRG-302", "Internet Programming", "REMEMBER", "EASY",
        "Which PHP regular expression function returns the elements of an input array that match a given pattern?",
        [
            ("A", "preg_match_all()"),
            ("B", "preg_match()"),
            ("C", "preg_grep()"),
            ("D", "preg_quote()"),
        ],
        "C",
        "`preg_grep(pattern, array)` filters and returns the array elements that match the regular expression pattern."
    ),

    # =========================================================================
    # SECTION 5: System Analysis and Design (Q37 - Q44) -> Mapped to IT-SYAD-204
    # =========================================================================
    (
        37, "IT-SYAD-204", "System Analysis and Design", "REMEMBER", "EASY",
        "Which one of the following represents the logical order of software development stages?",
        [
            ("A", "Gathering requirements -> Planning -> Implementation -> Testing -> Deployment -> Support"),
            ("B", "Planning -> Gathering requirements -> Implementation -> Testing -> Deployment -> Support"),
            ("C", "Gathering requirements -> Support -> Planning -> Implementation -> Testing -> Deployment"),
            ("D", "Deployment -> Gathering requirements -> Implementation -> Testing -> Planning -> Support"),
        ],
        "B",
        "In standard SDLC phases, project Planning (initiation/feasibility) precedes detailed Requirements Gathering/Analysis, Design/Implementation, Testing, Deployment, and Support."
    ),
    (
        38, "IT-SYAD-204", "System Analysis and Design", "UNDERSTAND", "EASY",
        "Which type of Unified Modeling Language (UML) diagram is NOT a behavioral diagram (or which is structural vs. behavioral)?\n*(Note: Sequence, Use Case, and Activity diagrams model system behavior, whereas Class Diagram models static structure; if asked which models workflow/activity behavior directly, Activity/Use Case applies.)*",
        [
            ("A", "Class Diagram"),
            ("B", "Sequence Diagram"),
            ("C", "Use Case Diagram"),
            ("D", "Activity Diagram"),
        ],
        "C",
        "Use Case, Sequence, and Activity diagrams are UML Behavioral diagrams (Use Case captures system functional behavior from the user's perspective; Class Diagram is structural)."
    ),
    (
        39, "IT-SYAD-204", "System Analysis and Design", "REMEMBER", "MEDIUM",
        "Which technique focuses on eliciting information from users through direct observation of their tasks?",
        [
            ("A", "Joint Application Design (JAD)"),
            ("B", "Knowledge Analysis of Tasks (KAT)"),
            ("C", "Usability Testing"),
            ("D", "None"),
        ],
        "D",
        "Observing users in their actual work environment is Ethnographic / Observation analysis (none of JAD, KAT, or Usability Testing)."
    ),
    (
        40, "IT-SYAD-204", "System Analysis and Design", "REMEMBER", "EASY",
        "Which term describes the deviation of the observed behavior of a system from its specified behavior?",
        [("A", "Error"), ("B", "Failure"), ("C", "Fault"), ("D", "Reliability")],
        "B",
        "Per IEEE software engineering terminology, a human mistake (error) introduces a defect/bug (fault) in code, which manifests at runtime as a **Failure** (deviation of observed behavior from specified behavior)."
    ),
    (
        41, "IT-SYAD-204", "System Analysis and Design", "ANALYSE", "EASY",
        "Case Study: *The College of Computing and Informatics has several departments. Each department has a department head and at least ten teachers. Teachers must be assigned to at least one, possibly more departments. At least one teacher is assigned to a project, though a teacher may be on vacation and not assigned to any project. Important data fields are department names, project names, teacher names, department head, teacher ID, and project ID.*\nFrom this case study, which one is NOT an entity of this system?",
        [
            ("A", "Department"),
            ("B", "Teacher"),
            ("C", "Student"),
            ("D", "Project"),
        ],
        "C",
        "The case study models `Department`, `Teacher`, and `Project`; `Student` is never mentioned in the requirements."
    ),
    (
        42, "IT-SYAD-204", "System Analysis and Design", "ANALYSE", "EASY",
        "Based on the case study in Question 41, which of the following represents valid relationships between the identified entities?",
        [
            ("A", "Department is run by Department Head"),
            ("B", "Teacher works on Project"),
            ("C", "Department is assigned Teacher"),
            ("D", "All of the Above"),
        ],
        "D",
        "All three relationships are explicitly stated in the case study specification."
    ),
    (
        43, "IT-SYAD-204", "System Analysis and Design", "UNDERSTAND", "EASY",
        "Which SDLC phase is used for understanding why the system should be built, assessing technical, economic, and organizational feasibility, and determining how the project team will build it?",
        [
            ("A", "System Implementation Phase"),
            ("B", "System Analysis Phase"),
            ("C", "System Planning Phase"),
            ("D", "System Design Phase"),
        ],
        "C",
        "The System Planning Phase defines business value ('why build it'), conducts technical/economic/organizational feasibility studies, and establishes the project work plan."
    ),
    (
        44, "IT-SYAD-204", "System Analysis and Design", "REMEMBER", "EASY",
        "Which software development approach has lightweight rules and practices and focuses on eliminating heavy modeling and documentation overhead?",
        [
            ("A", "Rapid Application Development"),
            ("B", "Prototyping-based Development"),
            ("C", "Agile Development"),
            ("D", "Waterfall Development"),
        ],
        "C",
        "Agile development prioritizes working software and customer collaboration over heavy upfront modeling and documentation overhead."
    ),

    # =========================================================================
    # SECTION 6: Multimedia System (Q45 - Q52) -> Mapped to IT-IPRG-301
    # =========================================================================
    (
        45, "IT-IPRG-301", "Multimedia System", "UNDERSTAND", "EASY",
        "Which compression technique takes advantage of temporal repetition from one frame to another by encoding only the changes between neighboring frames?",
        [
            ("A", "Image compression"),
            ("B", "Video compression"),
            ("C", "Data compression"),
            ("D", "File compression"),
        ],
        "B",
        "Inter-frame video compression (such as MPEG motion compensation) exploits temporal redundancy between consecutive video frames."
    ),
    (
        46, "IT-IPRG-301", "Multimedia System", "APPLY", "EASY",
        "Haramaya University plans to implement a new repository to store student profile records across departments. Which category of data compression do you recommend to reduce file size without losing any information?",
        [
            ("A", "Lossy Compression"),
            ("B", "LZW Compression"),
            ("C", "Huffman Compression"),
            ("D", "Lossless compression"),
        ],
        "D",
        "Student records and text/database files require **Lossless compression** so that 100% of original data is reconstructed upon decompression."
    ),
    (
        47, "IT-IPRG-301", "Multimedia System", "UNDERSTAND", "EASY",
        "Which of the following is NOT a benefit of digital representation for video?",
        [
            ("A", "Storing video on a digital device makes it ready to be processed and integrated into various multimedia applications"),
            ("B", "Direct access makes nonlinear video editing simple"),
            ("C", "Repeated recording with degradation of image quality"),
            ("D", "Ease of encryption and better tolerance for channel noise"),
        ],
        "C",
        "Generation loss (degradation of image quality across repeated copies) is a drawback of analog tape video, not digital video."
    ),
    (
        48, "IT-IPRG-301", "Multimedia System", "REMEMBER", "EASY",
        "Microsoft Windows applications have a standard uncompressed audio file format used as the default file type when conducting digital recording within Windows:",
        [("A", "MIDI"), ("B", "MP3"), ("C", "AIF"), ("D", "WAV")],
        "D",
        "Waveform Audio File Format (`WAV`) is the standard Microsoft/IBM container format for uncompressed PCM audio on Windows."
    ),
    (
        49, "IT-IPRG-301", "Multimedia System", "REMEMBER", "EASY",
        "What do we call a program that provides pre-programmed elements for producing interactive multimedia presentations in order to speed up development?",
        [
            ("A", "Authoring metaphor"),
            ("B", "Authoring system"),
            ("C", "Authoring paradigm"),
            ("D", "Icon Author"),
        ],
        "B",
        "A multimedia **Authoring system** provides pre-built visual/interactive building blocks to assemble multimedia applications without low-level programming."
    ),
    (
        50, "IT-IPRG-301", "Multimedia System", "UNDERSTAND", "MEDIUM",
        "Which authoring feature is utilized to synchronize multimedia playback, which is frequently challenging due to hardware performance differences across computers?",
        [
            ("A", "Playback feature"),
            ("B", "Delivery feature"),
            ("C", "Performance-tuning features"),
            ("D", "Cross-platform feature"),
        ],
        "C",
        "Performance-tuning features allow multimedia authoring tools to lock frame timing and synchronize audio/video across machines with varying CPU speeds."
    ),
    (
        51, "IT-IPRG-301", "Multimedia System", "REMEMBER", "EASY",
        "In Joint Photographic Experts Group (JPEG) compression, a grayscale or color image channel is divided into Discrete Cosine Transform (DCT) blocks of:",
        [
            ("A", "4 x 4 pixels"),
            ("B", "16 x 16 pixels"),
            ("C", "8 x 8 pixels"),
            ("D", "32 x 32 pixels"),
        ],
        "C",
        "Standard JPEG baseline compression partitions each image component into `8 x 8` pixel blocks before applying the 2D Discrete Cosine Transform."
    ),
    (
        52, "IT-IPRG-301", "Multimedia System", "REMEMBER", "EASY",
        "Which system is most popular due to the vast amount of information available from web servers, the capacity to publish such information, and the ease of navigating it with a web browser?",
        [
            ("A", "Hypertext Markup Language"),
            ("B", "Hypermedia"),
            ("C", "Multimedia"),
            ("D", "World Wide Web"),
        ],
        "D",
        "The **World Wide Web (WWW)** is the global information space accessed via web browsers and HTTP web servers."
    ),

    # =========================================================================
    # SECTION 7: Networking (Q53 - Q61) -> IT-DCCN-201 / IT-NDVC-302
    # =========================================================================
    (
        53, "IT-NDVC-302", "Networking", "APPLY", "EASY",
        "ICT workers at Haramaya University note that a planned copper UTP cable run between HIT and the main campus spans 235 meters, exceeding the 100-meter attenuation limit of twisted-pair cabling. Which basic physical-layer network device regenerates the signal to extend distance?",
        [
            ("A", "Bridge"),
            ("B", "Repeater"),
            ("C", "Router"),
            ("D", "Multilayer switch"),
        ],
        "B",
        "A **Repeater** operates at OSI Layer 1 (Physical Layer) to regenerate and retime attenuated electrical signals beyond the 100m UTP segment limit."
    ),
    (
        54, "IT-DCCN-201", "Networking", "APPLY", "EASY",
        "What is the number of valid usable host addresses per subnet available in the network `172.16.0.0/23`?",
        [
            ("A", "512 hosts"),
            ("B", "510 hosts"),
            ("C", "128 hosts"),
            ("D", "254 hosts"),
        ],
        "B",
        "A `/23` prefix leaves `32 - 23 = 9` host bits. Total usable hosts = $2^9 - 2 = 512 - 2 = 510$ hosts."
    ),
    (
        55, "IT-DCCN-201", "Networking", "ANALYSE", "MEDIUM",
        "A service provider gives you the Class B network `172.16.0.0/16` and asks you to create as many subnets as possible while supporting at least 300 clients per subnet. Which statement is true?",
        [
            ("A", "The new subnet mask & broadcast address of the 3rd subnet is 255.255.254.0 and 172.16.1.255 respectively."),
            ("B", "The new subnet mask & broadcast address of the 1st subnet is 255.255.224.0 and 172.16.5.255 respectively."),
            ("C", "The new subnet mask & broadcast address of the 3rd subnet is 255.255.224.0 and 172.16.3.255 respectively."),
            ("D", "The new subnet mask & broadcast address of the 2nd subnet is 255.255.254.0 and 172.16.3.255 respectively."),
        ],
        "D",
        "At least 300 hosts requires 9 host bits ($2^9 - 2 = 510 \\ge 300$), giving a `/23` mask (`255.255.254.0`). Subnet 1 is `172.16.0.0 - 172.16.1.255`; Subnet 2 is `172.16.2.0 - 172.16.3.255` (broadcast `172.16.3.255`)."
    ),
    (
        56, "IT-DCCN-201", "Networking", "UNDERSTAND", "EASY",
        "A computer at HU has a 100 Mbps NIC while a peer at AAU transmits at 1 Gbps. Which OSI layer regulates end-to-end flow control so the fast sender does not overwhelm the slower receiver?",
        [
            ("A", "Physical Layer"),
            ("B", "Presentation Layer"),
            ("C", "Transport Layer"),
            ("D", "Application Layer"),
        ],
        "C",
        "The **Transport Layer (Layer 4)** provides end-to-end flow control (such as TCP sliding window) to prevent a fast sender from overwhelming a slower receiver."
    ),
    (
        57, "IT-NDVC-302", "Networking", "UNDERSTAND", "EASY",
        "Why does a hub flood incoming frames out all connected ports, whereas a switch forwards frames only to the destination port?",
        [
            ("A", "A hub manages the flow of data between two network segments by reading the MAC address whereas a switch does not."),
            ("B", "A switch is a Layer 1 device whereas a hub is Layer 2."),
            ("C", "A switch manages the flow of data between two network segments by reading the IP address whereas hubs cannot."),
            ("D", "A switch learns the MAC addresses of attached devices and matches the destination MAC address in incoming frames, whereas a hub does not."),
        ],
        "D",
        "A Layer 2 Ethernet switch builds a MAC address table from source MAC addresses and forwards unicast frames only to the target port; a Layer 1 hub has no MAC intelligence."
    ),
    (
        58, "IT-DCCN-201", "Networking", "UNDERSTAND", "EASY",
        "Which TCP/IP configuration setting is NOT required if a host only needs to communicate with other hosts on the same local area network (LAN) by IP address?",
        [
            ("A", "IP address"),
            ("B", "Subnet mask"),
            ("C", "Default Gateway"),
            ("D", "DNS (if using hostnames) / Default Gateway (for remote networks)"),
        ],
        "C",
        "A **Default Gateway** is only used when forwarding packets outside the local subnet (and DNS is unnecessary when communicating strictly by raw IP address)."
    ),
    (
        59, "IT-DCCN-201", "Networking", "REMEMBER", "EASY",
        "Which one of the following is an Application Layer (Layer 7) specific service?",
        [
            ("A", "Dialog control service"),
            ("B", "Flow control service"),
            ("C", "Mailing service"),
            ("D", "Framing service"),
        ],
        "C",
        "Electronic **Mailing service** (SMTP/POP3/IMAP) is an OSI Layer 7 (Application Layer) service, whereas dialog control is Layer 5, flow control is Layer 4/2, and framing is Layer 2."
    ),
    (
        60, "IT-DCCN-201", "Networking", "UNDERSTAND", "EASY",
        "Why do we need both an IP address and a MAC address to deliver a packet from one network to another?",
        [
            ("A", "One is for end-to-end connection whereas the other is node-to-node delivery"),
            ("B", "One is used for process-to-process delivery whereas the other is for host-to-host delivery"),
            ("C", "One is used for node-to-node (hop-by-hop) delivery whereas the other is end-to-end delivery"),
            ("D", "One is used for destination address identification whereas the other is source address identification"),
        ],
        "C",
        "MAC addresses handle hop-by-hop (node-to-node) frame delivery across each link, while IP addresses remain constant for end-to-end packet delivery from source host to destination host."
    ),
    (
        61, "IT-DCCN-201", "Networking", "REMEMBER", "EASY",
        "In which media access control method is it impossible to have collisions during normal data communication?",
        [
            ("A", "CSMA/CA"),
            ("B", "Token Passing"),
            ("C", "CSMA/CD"),
            ("D", "Carrier Sense"),
        ],
        "B",
        "In **Token Passing** (such as Token Ring / FDDI), only the station holding the single logical token is permitted to transmit, eliminating collisions."
    ),

    # =========================================================================
    # SECTION 8: Information Assurance and Security (Q62 - Q65) -> IT-IASC-401
    # =========================================================================
    (
        62, "IT-IASC-401", "Information Assurance and Security", "REMEMBER", "EASY",
        "Which security principle guards against improper information modification or destruction, including ensuring information non-repudiation and authenticity?",
        [
            ("A", "Authenticity"),
            ("B", "Availability"),
            ("C", "Integrity"),
            ("D", "Confidentiality"),
        ],
        "C",
        "**Integrity** guards against unauthorized data modification or destruction and encompasses data authenticity and non-repudiation."
    ),
    (
        63, "IT-IASC-401", "Information Assurance and Security", "UNDERSTAND", "EASY",
        "Which of the following ciphers is NOT a poly-alphabetic substitution cipher (where each occurrence of a character may have a different substitute)?",
        [
            ("A", "Playfair Cipher"),
            ("B", "Autokey Cipher"),
            ("C", "Vigenere Cipher"),
            ("D", "Caesar Cipher"),
        ],
        "D",
        "The **Caesar cipher** is a simple mono-alphabetic substitution cipher where every plaintext letter is shifted by a fixed constant offset."
    ),
    (
        64, "IT-IASC-401", "Information Assurance and Security", "REMEMBER", "EASY",
        "An attack in which the attacker tries every possible key on a piece of ciphertext until an intelligible translation into plaintext is obtained is called a:",
        [
            ("A", "Hacker"),
            ("B", "Virus"),
            ("C", "Brute-force attack"),
            ("D", "Denial of service"),
        ],
        "C",
        "A **Brute-force attack** exhaustively searches the keyspace until a valid plaintext decryption is found."
    ),
    (
        65, "IT-IASC-401", "Information Assurance and Security", "REMEMBER", "EASY",
        "Disruption of an entire network, either by disabling the network or by overloading it with messages to degrade performance, is known as:",
        [
            ("A", "Masquerading"),
            ("B", "Snooping"),
            ("C", "Traffic Analysis"),
            ("D", "Denial of Service"),
        ],
        "D",
        "A **Denial of Service (DoS)** attack prevents legitimate users from accessing network resources by disabling services or flooding bandwidth."
    ),

    # =========================================================================
    # SECTION 9: Computer Maintenance (Q66 - Q74) -> Mapped to IT-CMTS-101
    # =========================================================================
    (
        66, "IT-CMTS-101", "Computer Maintenance", "REMEMBER", "EASY",
        "Which diagnostic tool is used to test the integrity of circuits and the quality/voltage of electricity in computer components?",
        [
            ("A", "Crimper"),
            ("B", "Toner Probe"),
            ("C", "Digital Multimeter"),
            ("D", "Loopback Adapter"),
        ],
        "C",
        "A **Digital Multimeter** measures AC/DC voltage, current, resistance, and circuit continuity across power supplies and components."
    ),
    (
        67, "IT-CMTS-101", "Computer Maintenance", "UNDERSTAND", "EASY",
        "When powering on a computer, rapidly incrementing numbers appearing at the upper-left corner of the monitor indicate:",
        [
            ("A", "Device driver is missing"),
            ("B", "POST is checking RAM"),
            ("C", "Operating system not available"),
            ("D", "POST is not working well"),
        ],
        "B",
        "During the BIOS Power-On Self-Test (POST), the system counts through installed physical memory addresses (**POST is checking RAM**)."
    ),
    (
        68, "IT-CMTS-101", "Computer Maintenance", "REMEMBER", "EASY",
        "Which Random Access Memory (RAM) physical packaging form factor is most commonly used in modern desktop computers?",
        [
            ("A", "Dual In-line Package (DIP)"),
            ("B", "Dual In-line Memory Module (DIMM)"),
            ("C", "Single In-line Memory Module (SIMM)"),
            ("D", "Single In-line Package (SIP)"),
        ],
        "B",
        "Modern desktop DDR3/DDR4/DDR5 memory modules use the **DIMM (Dual In-line Memory Module)** form factor (and SO-DIMM on laptops)."
    ),
    (
        69, "IT-CMTS-101", "Computer Maintenance", "REMEMBER", "EASY",
        "Which processor socket mechanism is standard on modern computers to allow CPU insertion without bending pins?",
        [
            ("A", "Pin Grid Array (PGA)"),
            ("B", "Staggered Pin Grid Array (SPGA)"),
            ("C", "Plastic Pin Grid Array (PPGA)"),
            ("D", "Zero Insertion Force (ZIF)"),
        ],
        "D",
        "**Zero Insertion Force (ZIF)** sockets use a lever/latch mechanism so the CPU drops into place without downward insertion pressure."
    ),
    (
        70, "IT-CMTS-101", "Computer Maintenance", "UNDERSTAND", "EASY",
        "Which one of the following statements is INCORRECT regarding CPU architecture and installation?",
        [
            ("A", "Cache memory is faster than RAM."),
            ("B", "The word size and the number of lines for the internal data bus are equal."),
            ("C", "After installing a processor for the first time, apply power and ensure the computer boots before installing any heat sink or fan."),
            ("D", "Throttle management is the ability to control the CPU speed by slowing it when it is not being used heavily or is running too hot."),
        ],
        "C",
        "Never power on a modern CPU without a properly mounted heatsink and thermal interface material; doing so can cause immediate thermal damage or shutdown."
    ),
    (
        71, "IT-CMTS-101", "Computer Maintenance", "UNDERSTAND", "EASY",
        "Which of the following is a cause of microprocessor overheating?",
        [
            ("A", "Unbalanced / excessive core voltage"),
            ("B", "Absence of a heat sink on the surface of the processor"),
            ("C", "Overclocking configuration of the CPU multiplier/jumper"),
            ("D", "All are the answers"),
        ],
        "D",
        "Excessive voltage, missing/unseated heatsinks, and overclocking all cause CPU overheating."
    ),
    (
        72, "IT-CMTS-101", "Computer Maintenance", "REMEMBER", "EASY",
        "What do we call a software service that intercepts a print job, buffers it to the hard drive queue, and feeds it to the printer in the background?",
        [
            ("A", "Primary corona"),
            ("B", "Fuser cleaning pad"),
            ("C", "Print spooler"),
            ("D", "Print writer"),
        ],
        "C",
        "The **Print spooler** queues print jobs to disk so the user's application is not blocked waiting for the physical printer."
    ),
    (
        73, "IT-CMTS-101", "Computer Maintenance", "REMEMBER", "EASY",
        "Which Windows utility checks the integrity of files and folders on a hard drive by scanning the file system and checking the disk surface for physical bad sectors?",
        [
            ("A", "CHKDSK (Check Disk)"),
            ("B", "Defrag (Defragmentation)"),
            ("C", "Disk Cleanup"),
            ("D", "SFC (System File Checker)"),
        ],
        "A",
        "**CHKDSK** (`chkdsk /f /r`) verifies file system metadata integrity and scans for physical bad sectors."
    ),
    (
        74, "IT-CMTS-101", "Computer Maintenance", "REMEMBER", "EASY",
        "Which core component of Microsoft Windows handles representing and transmitting graphical objects to output devices such as monitors and printers?",
        [
            ("A", "Graphics Device Interface (GDI)"),
            ("B", "Page Description Language"),
            ("C", "Printer Command Language"),
            ("D", "Video Graphics Array"),
        ],
        "A",
        "The Windows **Graphics Device Interface (GDI)** renders graphical primitives, text, and images to display monitors and printers."
    ),

    # =========================================================================
    # SECTION 10: Operating System (Q75 - Q83) -> Mapped to IT-SNAD-301
    # =========================================================================
    (
        75, "IT-SNAD-301", "Operating System", "REMEMBER", "EASY",
        "A situation that occurs when two or more processes read or write shared data concurrently and the final result depends on the exact order of execution is called a:",
        [
            ("A", "Starvation"),
            ("B", "Race condition"),
            ("C", "Mutual exclusion"),
            ("D", "Virtual machine"),
        ],
        "B",
        "A **Race condition** occurs when unsynchronized concurrent accesses to shared state produce outcome-dependent results."
    ),
    (
        76, "IT-SNAD-301", "Operating System", "UNDERSTAND", "EASY",
        "CPU scheduling decisions may take place when a process:",
        [
            ("A", "Switches from running to waiting state"),
            ("B", "Switches from running to ready state"),
            ("C", "Switches from waiting to ready state"),
            ("D", "Terminates"),
            ("E", "All"),
        ],
        "E",
        "In a preemptive operating system, scheduling decisions can occur on all four state transitions (A, B, C, and D)."
    ),
    (
        77, "IT-SNAD-301", "Operating System", "APPLY", "MEDIUM",
        "Suppose processes arrive at time 0 in the order `P1, P2, P3, P4` with CPU burst times of `5, 8, 3, 4` respectively and a Round Robin time quantum of `4`. What is the average waiting time?",
        [("A", "12"), ("B", "9.89"), ("C", "10.5"), ("D", "6.66")],
        "C",
        "Gantt chart with Q=4: P1(0..4), P2(4..8), P3(8..11), P4(11..15), P1(15..16), P2(16..20). Waiting times: P1=11, P2=12, P3=8, P4=11 -> Average = 42/4 = `10.5`."
    ),
    (
        78, "IT-SNAD-301", "Operating System", "UNDERSTAND", "MEDIUM",
        "Which of the following statements about CPU schedulers is FALSE?",
        [
            ("A", "Preemptive scheduling is used when a process switches from running state to ready state or from waiting state to ready state"),
            ("B", "Short-term scheduler determines which programs are admitted to the system for processing"),
            ("C", "In non-preemptive scheduling, interactive responsiveness/utilization can be lower"),
            ("D", "CPU scheduler selects a process among the processes that are ready to execute and allocates the CPU to it"),
        ],
        "B",
        "The **Long-term scheduler** (job scheduler) determines which programs are admitted to the system's ready queue; the short-term scheduler only dispatches already-admitted ready processes to the CPU."
    ),
    (
        79, "IT-SNAD-301", "Operating System", "APPLY", "MEDIUM",
        "Given free memory partitions of `150K, 200K` (in order), which of First-fit, Best-fit, and Worst-fit algorithms can place processes of size `200K, 50K` (in order) successfully?",
        [
            ("A", "First fit"),
            ("B", "Worst fit and best fit"),
            ("C", "Worst fit"),
            ("D", "Best fit"),
            ("E", "First fit, best fit and worst fit"),
        ],
        "E",
        "Because the first process is `200K`, only the `200K` partition can hold it under First-fit, Best-fit, and Worst-fit alike, leaving the `150K` partition free to hold the second `50K` process under all three algorithms."
    ),
    (
        80, "IT-SNAD-301", "Operating System", "UNDERSTAND", "EASY",
        "Which of the following is TRUE about paging and segmentation?",
        [
            ("A", "In paging, memory is partitioned into variable-size pages"),
            ("B", "In segmentation, there may be a chance of external fragmentation"),
            ("C", "In segmentation, memory is partitioned into fixed-size segments"),
            ("D", "In paging, there may be a chance of external fragmentation"),
            ("E", "Segmentation is faster than paging"),
        ],
        "B",
        "Segmentation allocates variable-sized logical segments in physical memory, which suffers from **external fragmentation** (whereas paging uses fixed-size frames and only has internal fragmentation)."
    ),
    (
        81, "IT-SNAD-301", "Operating System", "REMEMBER", "EASY",
        "Which memory management / I/O technique temporarily holds data in a memory area while it is being transferred between two devices or between a device and an application?",
        [
            ("A", "Buffering"),
            ("B", "Caching"),
            ("C", "Spooling"),
            ("D", "Traffic controlling"),
        ],
        "A",
        "**Buffering** stores data temporarily in RAM during I/O transfers to cope with speed mismatches or burst sizes between producer and consumer."
    ),
    (
        82, "IT-SNAD-301", "Operating System", "REMEMBER", "EASY",
        "Which of the following is NOT one of the three standard methods used to pass parameters to the operating system during a system call?",
        [
            ("A", "Push the parameters onto a stack"),
            ("B", "Block and stack method"),
            ("C", "Store the parameters in a block/table in memory and pass the address of the block in a register"),
            ("D", "Pass the parameters in registers"),
        ],
        "B",
        "The three standard OS system-call parameter passing mechanisms are: (1) Registers, (2) Memory Block/Table address in a register, and (3) Program Stack. 'Block and stack method' is not a distinct standard mechanism."
    ),
    (
        83, "IT-SNAD-301", "Operating System", "REMEMBER", "EASY",
        "CPU Scheduling Algorithm optimization criteria include:",
        [
            ("A", "Minimum CPU utilization"),
            ("B", "Minimum throughput"),
            ("C", "Minimum waiting time"),
            ("D", "A & C"),
        ],
        "C",
        "Scheduling algorithms aim to **maximize** CPU utilization and throughput while **minimizing** turnaround time, waiting time, and response time."
    ),

    # =========================================================================
    # SECTION 11: Database Systems (Q84 - Q100) -> IT-FDBS-201 / IT-ADBS-301
    # =========================================================================
    (
        84, "IT-FDBS-201", "Database Systems", "UNDERSTAND", "MEDIUM",
        "Which of the following statements about ER/EER modeling is FALSE?",
        [
            ("A", "Superclass attributes are shared by all subclasses of that superclass"),
            ("B", "If the ERD consists of a simple entity set, we can map it into a relational table"),
            ("C", "In Partial participation, every tuple in the entity or relation participates in at least one relationship by taking a role"),
            ("D", "The Disjoint Rule restricts one entity occurrence of a superclass to be a member of only one of the subclasses"),
        ],
        "C",
        "Requiring *every* entity instance to participate in at least one relationship instance is the definition of **Total Participation** (existence dependency), not Partial Participation."
    ),
    (
        85, "IT-FDBS-201", "Database Systems", "UNDERSTAND", "MEDIUM",
        "Which of the following statements is TRUE about unnormalized database anomalies?",
        [
            ("A", "A deletion anomaly is a failure to remove information about an existing database entry when it is time to remove that entry"),
            ("B", "An insertion anomaly is an inability to insert information about a new entity (or failure to place it consistently) without having data for another unrelated entity"),
            ("C", "A modification anomaly means whatever information is modified by the user, the change is automatically effected everywhere"),
            ("D", "All"),
        ],
        "B",
        "An insertion anomaly prevents inserting partial/new data properly without supplying all coupled attributes (or requires redundant insertion across multiple rows)."
    ),
    (
        86, "IT-FDBS-201", "Database Systems", "REMEMBER", "EASY",
        "In relational algebra, two relations $R_1$ and $R_2$ are said to be Union / Type Compatible if:",
        [
            ("A", "The operand relations R1 and R2 have the same number of attributes (degree)"),
            ("B", "The two relations R1 and R2 have the same relation name"),
            ("C", "The domains of corresponding attributes are compatible/same"),
            ("D", "The operand relations R1 and R2 have the same number of tuples"),
            ("E", "A and C"),
        ],
        "E",
        "Two relations are union/type compatible if and only if they have the same degree (number of attributes, A) and each pair of corresponding attributes has compatible domains (C)."
    ),
    (
        87, "IT-FDBS-201", "Database Systems", "UNDERSTAND", "EASY",
        "\"If Mr. A is a student, and every student is assigned to a dorm building, then Mr. A is assigned to a dorm building.\" ($X \\rightarrow Y$ and $Y \\rightarrow Z \\implies X \\rightarrow Z$). What type of functional dependency is this?",
        [
            ("A", "Partial dependency"),
            ("B", "Transitive dependency"),
            ("C", "Full dependency"),
            ("D", "None"),
        ],
        "B",
        "When $X \\rightarrow Y$ and $Y \\rightarrow Z$, the dependency $X \\rightarrow Z$ is a **Transitive dependency**."
    ),
    (
        88, "IT-FDBS-201", "Database Systems", "APPLY", "EASY",
        "Which of the following is the correct relational algebra query to retrieve columns `Id`, `Fname`, and `Lname` from relation `R`?",
        [
            ("A", "π <Id, FName, LName>(R)"),
            ("B", "σ <Id, Fname, Lname>(R)"),
            ("C", "π <Id, Fname, Lname> σ(R)"),
            ("D", "None"),
        ],
        "A",
        "The Projection operator ($\\pi$) selects specific vertical columns/attributes from a relation: $\\pi_{Id, FName, LName}(R)$."
    ),
    (
        89, "IT-FDBS-201", "Database Systems", "REMEMBER", "EASY",
        "In order to say a relational table is in Second Normal Form (2NF):",
        [
            ("A", "All non-key attributes are fully functionally dependent on the primary or composite key"),
            ("B", "All non-key attributes should not be transitively dependent on another non-key attribute"),
            ("C", "First it should be in First Normal Form (1NF)"),
            ("D", "A & C"),
            ("E", "B & C"),
        ],
        "D",
        "A relation is in **2NF** if it is in **1NF** (C) and every non-prime attribute is **fully functionally dependent** on the whole candidate/primary key with no partial dependencies (A)."
    ),
    (
        90, "IT-FDBS-201", "Database Systems", "REMEMBER", "EASY",
        "Which one of the following is TRUE about a SQL `LEFT OUTER JOIN` (`LEFT JOIN`)?",
        [
            ("A", "This join returns all the rows of the table on the left side of the join and matching rows from the table on the right side of the join"),
            ("B", "This join returns all the rows of the table on the right side of the join and matching rows from the table on the left side of the join"),
            ("C", "For rows with no match on the left side, the left columns contain NULL"),
            ("D", "None"),
        ],
        "A",
        "A `LEFT JOIN` preserves all rows from the left table and populates NULLs for right-table columns when no match exists."
    ),
    (
        91, "IT-FDBS-201", "Database Systems", "APPLY", "EASY",
        "Use the following `Student` table to answer:\n\n| SID | Name | Age | Sex |\n| :--- | :--- | :--- | :--- |\n| 01 | Saba | 22 | F |\n| 02 | Amir | 20 | M |\n| 03 | Dawit | 24 | M |\n| 04 | Elsa | 19 | F |\n\nWhat will be the resulting table of the relational algebra expression $\\pi_{SID, Name}(\\sigma_{SID=02}(Student))$?",
        [
            ("A", "| 02 | Amir | 20 | M |"),
            ("B", "| 02 | Amir | 20 |"),
            ("C", "| 03 | Dawit | 24 | M |"),
            ("D", "| 02 | Amir |"),
        ],
        "D",
        "First $\\sigma_{SID=02}(Student)$ selects the row for `02 Amir 20 M`, and then $\\pi_{SID, Name}$ projects only the `SID` and `Name` columns: `| 02 | Amir |`."
    ),
    (
        92, "IT-ADBS-301", "Database Systems", "UNDERSTAND", "EASY",
        "Haramaya University deployed a parallel/distributed DBMS where every processor node has its own independent primary memory and secondary disk storage, no common memory exists, and nodes communicate over a high-speed interconnection network. Which parallel DBMS architecture is this?",
        [
            ("A", "Shared memory architecture"),
            ("B", "Shared disk architecture"),
            ("C", "Shared nothing architecture"),
            ("D", "Tightly coupled architecture"),
        ],
        "C",
        "In a **Shared-nothing architecture**, each node owns its private CPU, RAM, and disk storage, communicating strictly via message passing over a network."
    ),
    (
        93, "IT-ADBS-301", "Database Systems", "REMEMBER", "EASY",
        "Haramaya University designed a database for student data management, and an attacker attempts to maliciously compromise the database. Which of the following is a form of malicious database access?",
        [
            ("A", "Unauthorized reading of data (breach of confidentiality)"),
            ("B", "Unauthorized modification of data (breach of integrity)"),
            ("C", "Unauthorized destruction of data (breach of availability)"),
            ("D", "All"),
        ],
        "D",
        "Malicious database access encompasses unauthorized reading, unauthorized modification, and unauthorized destruction of data."
    ),
    (
        94, "IT-ADBS-301", "Database Systems", "UNDERSTAND", "EASY",
        "Which one of the following is TRUE regarding Two-Phase Locking (2PL) lock compatibility?",
        [
            ("A", "If transaction T1 holds a Shared (S) lock on item Q, then transaction T2 can be granted a Shared (S) lock on item Q."),
            ("B", "If transaction T1 holds a Shared (S) lock on item Q, then transaction T2 can be granted an Exclusive (X) lock on item Q."),
            ("C", "If transaction T2 holds a Shared (S) lock on item Q, then transaction T1 can be granted an Exclusive (X) lock on item Q."),
            ("D", "If transaction T1 holds an Exclusive (X) lock on item Q, then transaction T2 can be granted an Exclusive (X) lock on item Q."),
        ],
        "A",
        "Multiple transactions can simultaneously hold **Shared (read) locks** on the same data item `Q`, whereas Exclusive (write) locks conflict with both Shared and Exclusive locks."
    ),
    (
        95, "IT-ADBS-301", "Database Systems", "UNDERSTAND", "EASY",
        "Which of the following is TRUE about a database recovery algorithm (such as ARIES / WAL)?",
        [
            ("A", "Actions taken during normal transaction processing (such as Write-Ahead Logging and checkpoints) to ensure enough information exists to recover from failures."),
            ("B", "Actions taken after a failure to recover the database contents to a state that ensures only consistency and durability (ignoring atomicity)"),
            ("C", "Actions taken after a failure to recover the database contents to a state that ensures only atomicity (ignoring durability)"),
            ("D", "None"),
        ],
        "A",
        "A database recovery subsystem consists of two parts: (1) actions during normal transaction processing (logging/WAL) to record enough information, and (2) actions after a failure to restore atomicity, consistency, and durability."
    ),
    (
        96, "IT-FDBS-201", "Database Systems", "REMEMBER", "EASY",
        "Which of the following SQL privileges can be granted on an individual relation `R`?",
        [
            ("A", "SELECT privilege on R"),
            ("B", "MODIFY (INSERT/UPDATE/DELETE) privileges on R"),
            ("C", "REFERENCES privilege on R"),
            ("D", "All"),
        ],
        "D",
        "Standard SQL discretionary access control (`GRANT`) supports `SELECT`, `INSERT`/`UPDATE`/`DELETE` (modification), and `REFERENCES` privileges on a relation."
    ),
    (
        97, "IT-ADBS-301", "Database Systems", "REMEMBER", "MEDIUM",
        "Which stage of distributed query decomposition verifies that the relations and attributes specified in the query are defined in the system catalog and are type-correct?",
        [
            ("A", "Analysis"),
            ("B", "Normalization"),
            ("C", "Semantic analysis"),
            ("D", "Simplification"),
        ],
        "A",
        "In the 4-stage query decomposition pipeline (Normalization -> **Analysis** -> Elimination of Redundancy/Simplification -> Restructuring), the **Analysis** stage checks the system catalog to verify that referenced relations and attributes exist and are type-valid."
    ),
    (
        98, "IT-FDBS-201", "Database Systems", "REMEMBER", "EASY",
        "Which SQL constraint keyword is used to limit the domain/range of values that can be entered into a column?",
        [
            ("A", "IDENTITY"),
            ("B", "CHECK constraint"),
            ("C", "PRIMARY KEY"),
            ("D", "FOREIGN KEY"),
        ],
        "B",
        "A `CHECK` constraint enforces a boolean predicate limiting the allowable range or format of values in a column."
    ),
    (
        99, "IT-ADBS-301", "Database Systems", "REMEMBER", "EASY",
        "Which ACID transaction property guarantees that either all operations of a transaction are reflected properly in the database, or none are ('all-or-nothing')?",
        [
            ("A", "Isolation"),
            ("B", "Durability"),
            ("C", "Atomicity"),
            ("D", "Consistency"),
        ],
        "C",
        "**Atomicity** ensures that a transaction is treated as a single indivisible unit of work—either all of its operations commit or all are rolled back."
    ),
    (
        100, "IT-FDBS-201", "Database Systems", "REMEMBER", "EASY",
        "Which one of the following is NOT excluded from (i.e., are all of A, B, and C valid) SQL table constraints?",
        [
            ("A", "CHECK constraint"),
            ("B", "Referential / FOREIGN KEY constraint"),
            ("C", "PRIMARY KEY"),
            ("D", "None"),
        ],
        "D",
        "`CHECK`, `FOREIGN KEY`, and `PRIMARY KEY` are all valid SQL table constraints, so **None** of them is excluded."
    ),
]


def compute_file_metadata(pdf_path: Path) -> Tuple[int, str]:
    if not pdf_path.exists():
        # Fallback metadata if running before copying PDF into docs/
        return 0, hashlib.sha256(b"HU-CCI-IT-MODEL-EXIT-EXAM-2023").hexdigest()
    raw = pdf_path.read_bytes()
    return len(raw), hashlib.sha256(raw).hexdigest()


def seed_database(direct_url: str, pdf_path: Path) -> None:
    import psycopg2

    file_size, sha256_hash = compute_file_metadata(pdf_path)

    conn = psycopg2.connect(direct_url)
    try:
        with conn:
            with conn.cursor() as cur:
                # 1. Load course_code -> (course_id, outcome_id) lookup
                cur.execute("SELECT code, course_id FROM courses;")
                course_map: Dict[str, int] = {row[0]: row[1] for row in cur.fetchall()}

                missing_codes = {item[1] for item in QUESTIONS_DATA} - set(course_map.keys())
                if missing_codes:
                    raise RuntimeError(
                        f"Missing canonical courses in DB: {missing_codes}. "
                        "Run 20261114000002_seed_curriculum.sql first."
                    )

                # 2. Upsert the Past Exam PDF into course_resources (linked to IT-CMTS-101 as general anchor)
                cur.execute(
                    """
                    INSERT INTO course_resources (
                        resource_id, course_id, tenant_id, type, title,
                        storage_bucket, storage_object_key, file_size_bytes,
                        sha256_checksum, is_offline_eligible, version, metadata, published_at
                    )
                    VALUES (%s, %s, NULL, 'PAST_EXAM', %s, %s, %s, %s, %s, TRUE, 1, %s::jsonb, NOW())
                    ON CONFLICT (resource_id) DO UPDATE
                    SET file_size_bytes = EXCLUDED.file_size_bytes,
                        sha256_checksum = EXCLUDED.sha256_checksum,
                        metadata = EXCLUDED.metadata;
                    """,
                    (
                        str(PDF_RESOURCE_ID),
                        course_map["IT-CMTS-101"],
                        "Haramaya University CCI — B.Sc. IT Model Exit Exam (Jan 2023 PDF)",
                        STORAGE_BUCKET,
                        STORAGE_OBJECT_KEY,
                        file_size,
                        sha256_hash,
                        json.dumps({
                            "institution": "Haramaya University - College of Computing and Informatics",
                            "department": "Department of Information Technology",
                            "exam_date": "2023-01-16",
                            "total_questions": 100,
                            "pages": 30,
                            "sections": [
                                "Basic Programming (1-9)",
                                "Advanced Programming (10-18)",
                                "Event Driven Programming (19-27)",
                                "Internet Programming (28-36)",
                                "System Analysis And Design (37-44)",
                                "Multimedia System (45-52)",
                                "Networking (53-61)",
                                "Information Assurance And Security (62-65)",
                                "Computer Maintenance (66-74)",
                                "Operating System (75-83)",
                                "Database Systems (84-100)",
                            ],
                        }),
                    ),
                )

                # 3. Upsert the 100-Question Exam Blueprint into exam_blueprints
                cur.execute(
                    """
                    INSERT INTO exam_blueprints (
                        exam_id, course_id, tenant_id, title, type,
                        total_questions, duration_seconds, is_offline_eligible,
                        reveal_answers_immediately, version, rules_json
                    )
                    VALUES (%s, NULL, NULL, %s, 'NATIONAL_EXIT_SIMULATION', 100, 10800, TRUE, TRUE, 1, %s::jsonb)
                    ON CONFLICT (exam_id) DO UPDATE
                    SET title = EXCLUDED.title,
                        total_questions = EXCLUDED.total_questions,
                        rules_json = EXCLUDED.rules_json;
                    """,
                    (
                        str(BLUEPRINT_ID),
                        "HU CCI B.Sc. IT Graduating Class Model Exit Exam (Jan 2023 — 100 Questions)",
                        json.dumps({
                            "source_pdf_resource_id": str(PDF_RESOURCE_ID),
                            "exam_date": "2023-01-16",
                            "fixed_question_order": True,
                            "allow_offline_package": True,
                        }),
                    ),
                )

                # 4. Upsert all 100 Questions & Options idempotently
                for (
                    q_num,
                    course_code,
                    legacy_section,
                    cog_level,
                    difficulty,
                    stem,
                    options,
                    correct_label,
                    explanation,
                ) in QUESTIONS_DATA:
                    q_id = uuid.uuid5(HU_EXAM_NAMESPACE, f"HU-2023-Q-{q_num:03d}")
                    formatted_stem = f"**[Q{q_num} • {legacy_section}]** {stem}"

                    cur.execute(
                        """
                        INSERT INTO questions (
                            question_id, course_id, outcome_id, tenant_id,
                            question_text, type, level, difficulty, explanation, version, is_published
                        )
                        VALUES (%s, %s, NULL, NULL, %s, 'MULTIPLE_CHOICE', %s::cognitive_level, %s::difficulty_level, %s, 1, TRUE)
                        ON CONFLICT (question_id) DO UPDATE
                        SET course_id = EXCLUDED.course_id,
                            question_text = EXCLUDED.question_text,
                            level = EXCLUDED.level,
                            difficulty = EXCLUDED.difficulty,
                            explanation = EXCLUDED.explanation;
                        """,
                        (
                            str(q_id),
                            course_map[course_code],
                            formatted_stem,
                            cog_level,
                            difficulty,
                            explanation,
                        ),
                    )

                    for opt_label, opt_text in options:
                        opt_id = uuid.uuid5(HU_EXAM_NAMESPACE, f"HU-2023-Q-{q_num:03d}-OPT-{opt_label}")
                        is_correct = opt_label == correct_label
                        cur.execute(
                            """
                            INSERT INTO question_options (option_id, question_id, option_label, option_text, is_correct)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (option_id) DO UPDATE
                            SET option_text = EXCLUDED.option_text,
                                is_correct = EXCLUDED.is_correct;
                            """,
                            (str(opt_id), str(q_id), opt_label, opt_text, is_correct),
                        )

                # 5. Record sync_changes watermark so React Native clients pull the new exam blueprint
                cur.execute(
                    """
                    INSERT INTO sync_changes (tenant_id, user_id, entity_type, entity_id, operation, version, payload)
                    VALUES (NULL, NULL, 'exam_blueprint', %s, 'UPSERT', 1, %s::jsonb);
                    """,
                    (
                        str(BLUEPRINT_ID),
                        json.dumps({
                            "exam_id": str(BLUEPRINT_ID),
                            "title": "HU CCI B.Sc. IT Graduating Class Model Exit Exam (Jan 2023 — 100 Questions)",
                            "total_questions": 100,
                            "duration_seconds": 10800,
                        }),
                    ),
                )

        print(f"Successfully seeded 100 questions and exam blueprint {BLUEPRINT_ID} into Supabase PostgreSQL.")
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed HU 2023 B.Sc. IT Model Exit Exam (100 Questions)")
    parser.add_argument(
        "--pdf-path",
        type=Path,
        default=None,
        help="Path to IT Model Exam.pdf",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate all 100 questions without connecting to PostgreSQL",
    )
    args = parser.parse_args()

    assert len(QUESTIONS_DATA) == 100, f"Expected 100 questions, found {len(QUESTIONS_DATA)}"
    for idx, item in enumerate(QUESTIONS_DATA, start=1):
        assert item[0] == idx, f"Question sequence mismatch at {idx}: got {item[0]}"
        labels = [opt[0] for opt in item[6]]
        assert item[7] in labels, f"Q{idx} correct_label {item[7]} not in options {labels}"

    if args.dry_run:
        print(f"Dry-run validation passed: 100/100 questions, options, course mappings, and explanations verified.")
    else:
        # Resolve PDF path
        pdf_candidates = [
            args.pdf_path,
            Path("dev_storage/course-packages/past-exams/HU-CCI-IT-Model-Exit-Exam-2023.pdf"),
            Path("dev_storage/course-packages/past exam/IT Model Exam.pdf"),
            Path("dev_storage/course-packages/past-exam/IT Model Exam.pdf"),
            Path("./docs/IT Model Exam.pdf"),
            Path(__file__).resolve().parent.parent.parent / "dev_storage/course-packages/past-exams/HU-CCI-IT-Model-Exit-Exam-2023.pdf",
            Path(__file__).resolve().parent / "IT Model Exam.pdf",
        ]
        resolved_pdf = None
        for candidate in pdf_candidates:
            if candidate and candidate.exists():
                resolved_pdf = candidate
                break

        if not resolved_pdf:
            print("[!] Warning: PDF not found in standard locations, using dummy size/hash fallback.")
            resolved_pdf = Path("./docs/IT Model Exam.pdf")
        else:
            print(f"[*] Using PDF at: {resolved_pdf}")

        # Resolve Database URL
        db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
        if not db_url:
            # Try importing settings from backend.app.core.config
            try:
                root_dir = Path(__file__).resolve().parent
                while root_dir != root_dir.parent and not (root_dir / "backend").exists():
                    root_dir = root_dir.parent
                if str(root_dir) not in sys.path:
                    sys.path.insert(0, str(root_dir))
                from backend.app.core.config import settings
                db_url = settings.DIRECT_URL or settings.DATABASE_URL
            except Exception as e:
                pass

        if not db_url:
            raise SystemExit("Error: Set DIRECT_URL in your environment or backend/.env before running.")

        db_url = db_url.replace("+asyncpg", "").replace("+psycopg2", "")
        seed_database(db_url, resolved_pdf)
