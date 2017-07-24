# Terminal.js

### A Linux terminal emulator for web projects.

Supports the following features:
* Scrolling
* An active cursor
* custom input evaluation
* An AutoTyper That can simulate human input

#### The current version uses JQuery, A future version may be available sans JQuery.

## How to use

* I've tried to make the API as simple as possible, you'll first start by creating a terminal Object in your HTML:
```HTML
<div id = "terminal"></div>
```
* The next step is to import the code from this library
  (I will include this step as soon as I figure it out, for now, you will have to simple write inside the file)
* Next you will want to create a new Terminal object in your javascript. The following are properties of the terminal object:
  * head - similar to the file location on an actual terminal: can be set upon construction. Similar to this:`username@domain:~$ `.
  * AutoTyper: specify an auto typer configuration. The AutoTyper is an object with the following properties:
    * speed - How fast the AutoTyper types, in Characters per Minute
    * accuracy - How often the auto typer makes a mistake, on a continuous scale from 0 to 1, higher being more accurate.
    * momentum - When the AutoTyper does make a mistake, how much more will it type at the most before it realizes it's mistake. So a momentum of 4 means that it could type four more characters before correcting it's errors.
  * selector - specifies the element to be converted into the terminal object. Uses the JQuery format.
  * rows - specifies the number of rows wide terminal will be.
  * columns - specifies the number of columns wide the terminal will be.
* An example configuration may look like this:
```javascript
var term = new Terminal({
  head: 'username@domain:~$ ',
  AutoTyper: {
    speed: 300,
    accuracy: .95,
    momentum: 5
  },
  selector: "#terminal",
  rows: 20,
  columns: 30
});
```
* Now you're ready to start issuing commands to the terminal. use the `start()` method to start the new terminal. Start has two optional parameters, `loadingStrings`, An array of strings to display on start up, and `callback`, a function to call after the terminal is started
```javascript
term.start(['Loading...','Ready'], () => {
  console.log("Ready");
})
```
* You might be interested in I/O. There are two methods for that.
* The `out()` method prints a string to the terminal, without delay. It has two parameters, a message, and an optional callback.
```javascript
term.out("Hello Guest.", () => {
  console.log("Output cleared");
});
```
* The next I/O method is the `in()` method. This method is of a similar nature, except it is meant to emulate user typing. It also has two methods, a message and the callback, except the message is also optional. If you do not provide a message or give it a value of `null` or `false`, then it will assume that the user will provide an input. If a message is provided, then the AutoTyper will write it to the terminal. Either after the user provides input, or the AutoTyper finishes typing, will the callback be executed. Note that before the terminal accepts input, the terminal will print the head to the front of the input.
```javascript
term.in(false); //this will accept user input
term.in("echo hello world!"); //this will be typed by the AutoTyper
```
* There is also the `clear()` method, that will simply clear the terminal.
* The `getInputLog()` method will return an array of all the input strings.
* likewise, the `getOutputLog()` method will return an array of all the output arrays. The loading strings passed to the start method count as output
* The logs act more like a queue, because recent elements are prepended to the beginning of the log, be wary of that when designing you own handlers
* Another feature of this terminal is that it works in both synchronous and asynchronous time. what I mean is that you can write code like this:
```javascript
term.in("python tests.py");
term.out("Running Unit tests...");
term.out("Test 1....... PASS");
term.out("Test 2....... PASS");
term.out("Test 3....... FAIL");
term.out("Test 4....... FAIL");
term.out("2/4 tests failed, unit tests failed");
term.in(false, () => {
  console.log("user input just entered.");
});
```
* or like this:
```javascript
term.in("python tests.py", () => {  
 term.out("Running Unit tests...", () =>{
  term.out("Test 1....... PASS", () => {
   term.out("Test 2....... PASS", () => {
    term.out("Test 3....... FAIL", () => {
     term.out("Test 4....... FAIL", () => {
      term.out("2/4 tests failed, unit tests failed", () => {
       term.in(false, () => {
        console.log("user input just entered.");
       });  
      });
     });
    });
   });
  });
 });
});
```
* While the latter may look like callback hell, sometimes its nice to know when a particular function is called and to be able to react to it using the callback. The reason the former works, is because the `in`, `out` and `clear` behave really well with each other. I have a bit of internal state that prevents them from interrupting each other. but if running the function would cause an issue, I add the function to a queue, where it waits to be executed. once its it's turn (wow that was a dozey), then it will call the next element in the queue.
the synchronous code execution works because the methods are guaranteed to run in the order you specify them to run.
* But if you want to create your own interpreter, compiler or kernel, you can run it after every `in()` call, and use it in conjunction with `.getInputLog()[0]` to receive and parse the last input.

### Other information
Here are some HTML/CSS classes that I am using, so if you don't want stuff to get screwy, don't use these classes elsewhere in the code:
* cursor
* cursor-solid
* cursor-none
* prev
* next
* buffer
You could however be creative: for instance:
to make the cursor visible and blinking use the `cursor-solid` and `cursor-none` classes:
```CSS
.cursor-solid {
  background-color:#FFFFFF;
  color:#000000;
}
.cursor-none {
  background-color:#000000;
  color:#FFFFFF;
}
```
Trust me, you're going to want to do something like this.
Another idea is to set the header to a `.head` class and style that:
```javascript
term.head("<span class=\"head\">Prelude> </span>");
```
and in your css:
```CSS
.head {
  color: #FF8000;
}
```

#### Be warned: The terminal input is vulnerable to XSS. type `<script>alert("You got pranked!")</script>` into the terminal to see what I mean.
#### Unless you are doing server side filtering and escaping the tag characters in the code (which I should do soon), please don't use this in production.

Have fun!
