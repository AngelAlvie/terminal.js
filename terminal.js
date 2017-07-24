/** Terminal.js
* A Linux terminal emulator written in JavaScript
* Supports: Scrolling, AutoTyping, Cursor, and custom input evaluation
* Uses jQuery, might create a version sans jQuery
* terminal should be functional and reactive to input.
* Constructor Parameters:
* AutoTyper: specify an auto typer configuration
* selector: specify the element to be turned into the terminal
* rows: specify number of rows wide terminal will be
* columns: specify the number of columns wide the terminal will be
* Methods: [optional parameters]
* .start([loading strings, callback]) - initialize terminal
* .head(message) - set the head of the message, printed everytime in is called
* .in([message, callback]) - writes to the terminal using the AutoTyper,
    if no message is provided, then it is assumed that the terminal is accepting user IO
* .out(message [, callback ]) - writes to the terminal instantaneously
* .clear([callback]) - clears the terminal
* getInputLog() - returns the input log
* getOutputLog() = returns the output log
*/
/** Here is the namespace of HTML classes that are in use:
* cursor
* cursor-solid
* cursor-none
* prev
* next
* buffer
*/
// NOTE:  PLEASE DONT USE THESE IN HTML CLASSES IN OTHER PLACES IN YOUR CODE

// BUG: Cursor will create visual glitches and break if arrow keys are used to fast, maybe create a pause between keystrokes?
// BUG: NO GUARDING OF TAGS, SUPER VULNERABLE TO XSS

/** This stuff has nothing to do with terminals, it's just that I want to restrict the type of the protected methods and constructor */
//TODO Guard all the functions;
// I am using contracts to restrict the type of the input
const createContract = function(type) {
  if (typeof type === "string") {
    return function(x) {
      if (typeof x === type) {
        return x;  //return original object
      } else {
        throw new TypeError("Expected " + type + ", but recieved " + typeof x);
      }
    }
  } else {
    throw new TypeError("createContract expects a string");
  }
}

const bool = createContract('boolean');
const num = createContract('number');
const obj = createContract('object');
const str = createContract('string');
const func = createContract('function');
const undef = createContract('undefined');

// I know this isn't how maybe works, but it works for my purposes
const maybe = function(contract, other) {
  return function(item) {
    if (item) {
      return contract(item);
    } else {
      return other;
    }
  }
}


function Terminal(properties) {
  //these properties are optional, as such, they can be defined by the user, or it will default to
  obj(properties);
  var head = maybe(str, ">")(properties.head);
  // these objects are fixed with respect to the terminal.
  if (!properties.autoTyper) {
    properties.autoTyper = {
      speed: 250,
      momentum: 4,
      accuracy: 0.95
    }
  }
  const autoTyper = new AutoTyper(properties.autoTyper);
  const terminal = new Interactor(str(properties.selector),num(properties.rows),num(properties.columns));
  const cursor = new Cursor(str(properties.selector), 300);

  // Internal state variables
  var inputLog = []; //The log is a permanent record of what is typed, the html can be cleared.
  var outputLog = [];
  // queues that help asynchronously insert code
  var typeQueue = [];
  var outQueue = [];
  var queue = []; //runs functions after the terminal is ready for them
  var temp;
  var inputIndex = 0;
  // state that helps with logic
  var writing = false; //if the terminal or the user is currently typing
  var writable = false; // if the terminal will allow the AutoTyper or user to type
  var readied = false;
  var typable = false; //if the terminal is allowing for the user to type
  //Methods - Notice that the public methods come in pairs

  //initialize terminal
  var start = this.start = function(loadingStrings = undefined, callback = () => {return;}) {
    terminal.format();
    cursor.start();

    if (loadingStrings) {
      loadingStrings.forEach(function(string, index, array) {
        //we can do this because JS supports enclosures.
        out(string, function() {
          //call the callback after all the strings have been loaded
          if ((index + 1 ) === array.length) {
            callback();
          }
        });
      });
    } else {
      callback();
    }
  }
  //delete all relevant terminal data, permanently stop terminal
  var kill = this.kill = function() {
    cursor.kill();
    if (typable) { stop(); }
    terminal.clear();
  }

  this.getInputLog = function() {
    return inputLog;
  }
  this.getOutputLog = function() {
    return outputLog;
  }
  //queue processor
  var process = function() {
    if (queue.length > 0) {
      var busy = queue[0].func(queue[0].callback);
      if (!busy) {
        queue.shift();
        process();
      }
    }
  }
  //IO methods
  var write = function(cb = () => {}) {
    if (outQueue.length > 0) {
      if (!writing && !typable) {
        if(readied) {
          unready();
        }
        //Now we can actually print out to the terminal
        terminal.writeln(outQueue[0]);
        outputLog.unshift(outQueue[0]);
        outQueue.shift();
        writable = true;
        //we want to process the queue here if we can.
        cb();
      } else {
        return {func: write, callback: cb};
      }
    } else {
      writable = true;
      //we want to process the queue here if we can.
      cb();
    }
  }
  var out = this.out = function(message, callback = () => {}) {
    outQueue.push(message);
    var busy = write(callback); //we know that the write method will return an object if it can't be run.
    if (busy) {
      queue.push(busy);
    } else {
      process();
    }
  }

  var input = function(cb) {
    if (typeQueue.length > 0) {
      if (writable && !writing && !typable) {
        if (!readied) {
          ready();
        }
        writing = true;
        cursor.typing();
        autoTyper.type(typeQueue[0], terminal, function() {
          cursor.idle();
          inputLog.unshift(typeQueue[0]);
          typeQueue.shift();
          writing = false;
          readied = false; //since we used up the ready from last time.
          cb();
          process();
        });
      } else {
        return {func: input, callback: cb};
      }
    } else {
      cb();
    }
  }
  this.in = function(message = undefined, callback = () => {}) {
    if (message) {
      //Use the autotyper to write the input
      typeQueue.push(message);
      var busy = input(callback);
      if (busy) {
        queue.push(busy);
      } else {
        process();
      }
    } else {
      var busy = listen(callback);
      if (busy) {
        queue.push(busy);
      } else {
        process();
      }
    }
  }
  var listen = function(callback = () => {return;}) {
    //make the terminal ready to accept input
      var cursorSetter;
      if (writable && !writing && !typable) {
        if (!readied) {
          ready();
        }
        writing = true;
        cursor.idle();
        //create local instance of unbinder using callback
        var unbind = function() {
          if (window.removeEventListener) {
            window.removeEventListener("keydown", keyhandler);
          } else if (window.detachEvent) {
            window.detachEvent("keydown", keyhandler);
          }
        }
        //Proably doesn't handle all events
        var keyhandler = function(event) {
          clearInterval(cursorSetter);
          cursor.typing();
          cursorSetter = setTimeout(cursor.idle, 500);
          switch(event.key) {
            case "Enter":
              inputLog.unshift(terminal.getText());
              temp = "";
              inputIndex = 0;
              cursor.idle();
              writing = false;
              readied = false;
              unbind();

                terminal.removeBuffer();
                terminal.enter();
              callback();
              process();
              break;
            case "ArrowRight":
              terminal.right();
              break;
            case "ArrowLeft":
              terminal.left();
              break;
            case "ArrowUp":
              if (inputLog.length > 0) {
                console.log("before logic:" + inputIndex);
                if (inputIndex === 0) {
                  temp  = terminal.getText();
                  console.log(temp);
                }
                inputIndex = Math.min(inputLog.length, ++inputIndex);
                cursor.reset();
                console.log("after logic:" + inputIndex);
                terminal.type(inputLog[inputIndex-1]);
              }
              break;
            case "ArrowDown":
              if (inputLog.length > 0) {

                console.log("before logic:" + inputIndex);
                inputIndex = Math.max(0, --inputIndex);
                if (inputIndex === 0) {
                  cursor.reset();
                  terminal.type(temp);
                  console.log("after logic:" + inputIndex);
                } else {
                  cursor.reset();
                  terminal.type(inputLog[inputIndex-1]);
                  console.log("after logic:" + inputIndex);
                }
              }
              break;
            case "Backspace":
              terminal.backspace();
              break;
            case "Delete":
              terminal.delete();
              break;
            case "Shift":
              break;
            case "Tab":
              break;
            case "CapsLock":
              break;
            case "Escape":
              break;
            case "End":
              break;
            case "Home":
              break;
            case "PageUp":
              break;
            case "PageDown":
              break;
            case "Control":
              break;
            case "Meta":
              break;
            case "Alt":
              break;
            case "WakeUp":
              break;
            case "F1":
              break;
            case "F2":
              break;
            case "F3":
              break;
            case "F4":
              break;
            case "F5":
              break;
            case "F6":
              break;
            case "F7":
              break;
            case "F8":
              break;
            case "F9":
              break;
            case "F10":
              break;
            case "F11":
              break;
            case "F12":
              break;
            default:
              terminal.type(event.key);
          }
        }

        //bind events
        if (window.addEventListener) {
          window.addEventListener("keydown", keyhandler);
        } else if (window.attachEvent) {
          window.attachEvent("keydown", keyhandler);
        }
      } else {
        return {func:listen, callback: callback};
      }

  }

  var stop = function(callback = () => {return;}) {

      var unbind = function() {
        if (window.removeEventListener) {
          window.removeEventListener("keydown", keyhandler);
        } else if (window.detachEvent) {
          window.detachEvent("keydown", keyhandler);
        }
        unready();
        callback();
      }

    unbind();
  }

  this.clear = function(callback = function() {}) {
    inputLog = [];
    outputLog = [];
    if (!writing && !typable) {
      terminal.clear();
      process();
    } else {
      queue.push({
        func: function(cb) {
          terminal.clear();
          cb();
        },
        callback: callback
      });;
    }
  }

  // make terminal ready to take input
  var ready = this.ready = function() {
    terminal.write(head);
    if (typable) {
        listen();
    }
    terminal.createBuffer();
    cursor.reset();
    cursor.idle();
    writable = true;
    writing = false;
    readied = true;

  }
  // stop input accepting, and stop terminal from accepting input
  var unready = this.unready = function() {
    if (writable) {
      if (typable){
        stop();
        typable = false;
      }
      terminal.removeBuffer();
      terminal.enter();
      cursor.kill();
      autoTyper.kill(terminal);
    }
    writable = false;
    writing = false;
    readied = false;
  }
  //sets head to new string
  this.head = function(newHead) {
    str(newHead);
    head = newHead;
  }

}

/** Lets define the various objects that are going to be interacting to make this terminal happen */
function Interactor(Selector, Rows, Cols) {
  const selector = Selector;
  const terminal = $(selector);
  const rows = Rows;
  const columns = Cols;
  // Set all the necesary conditions to set the terminal's properties
  this.format = function() {
    clear();
    terminal.css("height", rows + "em");
    terminal.css("width", columns + "em");
    terminal.css("text-align", "left");
    terminal.css("font-family", "Courier");
    terminal.css("overflow-y", "scroll");
    terminal.css("overflow-x", "hidden");
    terminal.css("line-height", "120%");
    terminal.css("word-wrap","break-word");
  };
  //resets the state of the terminal's html. clears entire element, WARNING: WILL DESTROY CURSOR
  var clear = this.clear = function() {
    terminal.html("");
  };
  this.getText = function() {
      console.log($(selector + ' .buffer').text());
    return $(selector + ' .buffer').text();
  }
  //creates new buffer
  this.createBuffer = function() {
    $(selector).append('<span class="buffer"></span>');
  }
  //only call remove buffer if it is the last element in the terminal
  this.removeBuffer = function() {
    var text = $(selector + ' .buffer').text();
    console.log(text);
    $(selector + ' .buffer').remove();
    $(selector).append(text);
  }
  //inserts on current line, does not create new space
  var write = this.write = function(string) {
    terminal.append(string);
  };

  //inserts on current line, but then returns the output
  this.writeln = function(string) {
    write(string);
    enter();
    scroll();
  };
  //creates a carriage return, the equivalent of hitting enter
  var enter = this.enter = function(string) {
    terminal.append("<br>");
  };
  //inserts string before the cursor
  this.type = function(string) {
    scroll();
    $( selector + ' .prev').append(string);
  }
  var scroll = this.scroll = function() {
      //keep cursor scrolled to the bottom
      terminal.scrollTop(terminal[0].scrollHeight);
  }
  //moves cursor to left if there is space
  this.left = function() {
    var before = $(selector + ' .prev').text().slice(-1);
    if (before !== "") {
      //perform the shift: first move cursor to next, then move prev to cursor, then delete last thing from prev
      $(selector + " .next").prepend($(selector + ' .cursor').text());
      $(selector + ' .cursor').text(before);
      $(selector + ' .prev').text(function (_,txt) {
        return txt.slice(0, -1);
      });
    }
  }
  //moves cursor right if there is space
  this.right = function() {
    var after = $(selector + ' .next').text().slice(0,1);
    if (after !== "" ) {
      $(selector + " .prev").append($(selector + ' .cursor').text());
      $(selector + ' .cursor').text(after);
      $(selector + ' .next').text(function (_,txt) {
      return txt.slice(1, -1);
      });
    }
  }
  //deletes the character before the cursor, unless at the begining, in which case it does nothing
  this.backspace = function() {
    var before = $(selector + ' .prev').text().slice(-1);
    if (before !== "") {
      //perform the shift: first move cursor to next, then move prev to cursor, then delete last thing from prev
      $(selector + ' .prev').text(function (_,txt) {
        return txt.slice(0, -1);
      });
    }
  }
  this.delete = function() {
    var after = $(selector + ' .next').text().slice(0,1);
    if (after !== "") {
      $(selector + ' .cursor').text(after);
      $(selector + ' .next').text(function (_,txt) {
      return txt.slice(1);
      });
    }
  }

  //handle deletion

}

/** The cursor object will be a simple way to insert text and make the terminal look more realistic */
function Cursor(Selector, Delay) {
  this.delay = Delay;
  var typing = false;
  var selector = Selector;
  var animationID;
  var currentState = false;
  var prevState = false;

  function cursor() {
    //Set the state of the cursor
    if (typing) {
      solidState = true;
    } else {
      if (prevState) {
        prevState = solidState;
        solidState = false;
      } else {
        prevState = solidState;
        solidState = true;
      }
    }
    //Change the html state of the cursor
    if (solidState) {
      $(selector + ' .cursor').removeClass('cursor-none');
      $(selector + ' .cursor').addClass('cursor-solid');
    } else {
        $(selector + ' .cursor').addClass('cursor-solid');
        $(selector + ' .cursor').addClass('cursor-none');
    }
  }
  this.idle = function() {
    typing = false;
  }
  this.typing = function() {
    typing = true;
  }
  //reset the state of the cursor by first deleting it then re-adding it, purely HTML changes
  this.reset = function() {    //once the cursor is removed
    $(selector +' .cursor').remove();
    $(selector +' .prev').remove();
    $(selector +' .next').remove();
    $(selector +' .buffer').append('<span class="prev"></span><span class="cursor">&nbsp</span><span class="next"></span>');
  }
  //pause cursor animation
  this.pause = function() {
    clearInterval(animationID);
  }
  //reset timer the cursor
  this.resume = function() {
    animationID = setInterval(cursor, this.delay);
  }
  this.kill = function() {
    // stop cursor indefinitely
    //remove cursor from selector, then clear interval
    clearInterval(animationID);
    $(selector +' .cursor').remove();
  }
  this.start = function() {
    // initialize cursor, adds cursor object to end of the selector
    var element = $(selector);
    solidState = true;
    //start the animation
    animationID = setInterval(cursor, this.delay);
  }
}

/** The Autotyper handles trying to type like a human. Maybe in a future version, I can make it create KeyBoard Events, in order to simplify the input code */
function AutoTyper(properties) {
  //recieved from the properties of the console
  obj(properties);
  var speed = num(properties.speed);
  var accuracy = num(properties.accuracy);
  var momentum = num(properties.momentum);
  var buffer;
  var AnimationID;

  //basically rolls n continuous dice from 0 to 1. takes the sum to produce a normal distribution
  var norm = function(n) {
    var num = 0;
    for (i = 0; i < n; i++) {
      num += Math.random();
    }
    num /= n;
    return num;
  };

  var generateTime = function() {
    var time = (60000 / speed);
    time = (norm(2)*time*2); //can reduce this number to increase variance
    return time;
  }
  this.kill = function(Interactor) {
    clearInterval(AnimationID);
    Interactor.removeBuffer();
    Interactor.enter();
  }

  this.type = function(string, Interactor, cb) {
    var buffer = string;
    var recursiveExecutuion = function() {
      if(buffer.length > 0) {
        if ((Math.random() > accuracy) && !(/[^a-zA-Z0-9]/.test(buffer[0]))) {
          //we screw up the current letter
          AnimationID = setTimeout(() => {
            var possible = 'qwertyuiopasdfghjklzxcvbnm';
            if (!isNaN(buffer[0])) {
              possible = '1234567890';
            } else if (buffer === buffer.toUpperCase()) {
              var possible = 'QWERTYUIOPASDFGHJKLZXCVBNM';
            }
            possible.replace(buffer[0], "");
            Interactor.type(possible.charAt(Math.floor(Math.random() * possible.length)));
            //buffer = buffer.slice(1);
            //here is where we decide to make another mistake, based on the momentum,
            // the higher the momentum, the more likely, they will keep typing.
            //we then, after the mistake is realized, we hit backspace a bunch until we got back to the original
            //decide to keep going
            var mistakes = Math.min( Math.max(Math.ceil(momentum * Math.random()), 1), buffer.length);
            var iter = 1;
            var timer = function(func, next) {
              if (iter < mistakes) {
                setTimeout(() => {
                  func(buffer[iter]);
                  iter++;
                  timer(func, next);
                }, generateTime());
              } else {
                next();
              }
            }
            timer(Interactor.type,() => {
              iter = 0;
              timer(Interactor.backspace, recursiveExecutuion);
            });
          }, generateTime());
        } else {
          //successfully typed a letter
          AnimationID = setTimeout(() => {
            Interactor.type(buffer[0]);
            buffer = buffer.slice(1);
            recursiveExecutuion();
          }, generateTime());
        }
      } else {
        Interactor.removeBuffer();
        Interactor.enter();
        cb();
      }
    }
    recursiveExecutuion();
  };
}
