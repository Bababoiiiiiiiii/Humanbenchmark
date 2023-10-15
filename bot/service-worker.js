
const breakpoints = {
    reactiontime: {
        columnNumber: 61054
    },
    sequence: {
        columnNumber: 125677
    },
    aim: {
        columnNumber: 104694
    },
    numbermemory: {
        columnNumber: 54995
    }

}


// using this bc if the toggles user does smth on another humanbenchmark page, the message.tabID  will be for the new one, where the debugger isnt attached and stuff 
// this tabID will be the correct one since the toggle is synced across pages and can only be updated on humanbenchmark pages -> if its turned on, cant be turned on again
let tabID
let script_id
let currentTest = null

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.type) {
        case "toggle":
            chrome.storage.sync.get('toggle', function (result) {
                if (result.toggle) {
                    tabID = message.tab_id
                    currentTest = message.test

                    switch (message.test) {
                        case "reactiontime":
                            addReactionTimeBot()
                            break

                        case "sequence":
                            addSequenceBot()
                            break

                        case "aim":
                            addAimBot()
                            break

                        case "number-memory":
                            addNumberMemoryBot()
                            break

                    }

                } else {

                    switch (message.test) {
                        case "reactiontime":
                            chrome.debugger.onEvent.removeListener(reactiontimeEvent)
                            break

                        case "sequence":
                            chrome.debugger.onEvent.removeListener(sequenceEvent)
                            break

                        case "aim":
                            chrome.debugger.onEvent.removeListener(aimbotEvent)
                            break

                    }
                    chrome.debugger.detach({ tabId: tabID });
                }
            });

            break

    }
});

///////////////////////////

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {

    chrome.storage.sync.get('popupopened', function (result) {
        if (result.popupopened === true && changeInfo.status === "complete" && !tab.url.includes(currentTest)) {// page didnt get refreshed and popup is open                        could probably add some optimization to other stuff as well, but thats some refactoring i dont want to do
            chrome.runtime.sendMessage({
                type: "urlchanged",
            }, () => {
                if (chrome.runtime.lastError) { } // no error should be shown as the poup is often closed, thus not available and there is no way to check if its opened
            });
        }
    })


    setTimeout(() => { // timeout bc sometimes this shit aint working, cant figure out why, it isnt bc dom isnt loaded
        if (tabId == tabID && changeInfo.audible === undefined && changeInfo.status === "complete" && changeInfo.url === undefined) { // audible exists when tab isnt reloaded but updated

            // update popup.html accordingly


            chrome.storage.sync.get('toggle', function (result) {

                if (result.toggle) {

                    console.log("url now:", tab.url)
                    console.log("test before", currentTest)
                    switch (currentTest) { // remove old shit
                        case "reactiontime":
                            chrome.debugger.onEvent.removeListener(reactiontimeEvent)
                            chrome.debugger.detach({ tabId: tabID })
                            break

                        case "sequence":
                            chrome.debugger.onEvent.removeListener(sequenceEvent)
                            chrome.debugger.detach({ tabId: tabID })
                            break

                        case "aim":
                            chrome.debugger.onEvent.removeListener(aimbotEvent)
                            chrome.debugger.detach({ tabId: tabID })
                            break

                        case "number-memory":
                            chrome.debugger.onEvent.removeListener(numberMemoryEvent)
                            chrome.debugger.detach({ tabId: tabID })
                            break

                    }


                    switch (tab.url) {
                        case "https://humanbenchmark.com/tests/reactiontime":
                            currentTest = "reactiontime"
                            addReactionTimeBot()
                            break

                        case "https://humanbenchmark.com/tests/sequence":
                            currentTest = "sequence"
                            addSequenceBot()
                            break

                        case "https://humanbenchmark.com/tests/aim":
                            currentTest = "aim"
                            addAimBot()
                            break

                        case "https://humanbenchmark.com/tests/number-memory":
                            currentTest = "number-memory"
                            addNumberMemoryBot()
                            break

                        default:
                            currentTest = null
                    }

                }

            })
        }
    }, 100)
});

/////////////////////


function set_breakpoint(tabID, script_id, lineNumber, columnNumber, condition, callback) {

    chrome.debugger.sendCommand({ tabId: tabID }, 'Debugger.setBreakpoint', {
        location: {
            scriptId: script_id,
            lineNumber: lineNumber,
            columnNumber: columnNumber
        },
        condition: condition
    }, (breakpoint) => {
        if (!chrome.runtime.lastError && breakpoint.breakpointId) {
            console.log('Breakpoint set: ' + breakpoint.breakpointId);
            chrome.storage.sync.set({
                tries: 1,
            })
            callback(breakpoint.breakpointId)

        } else {
            chrome.storage.sync.get('tries', function (result) {
                if (result.tries <= 3) {
                    console.log(`Failed to set breakpoint, trying again by reloading page in 1 second. [${result.tries}/3]`)
                    chrome.storage.sync.set({
                        tries: result.tries + 1,
                    })
                    setTimeout(() => chrome.tabs.reload(tabID), 2000)
                } else {
                    chrome.storage.sync.set({
                        tries: 1,
                    })
                    console.error(chrome.runtime.lastError || 'Failed to set breakpoint');
                }
            });


        }
    })
}

function onEvent(src, method, info) {
    if (method === 'Debugger.scriptParsed' && info.url === "https://humanbenchmark.com/static/js/main.bb78a4d6.chunk.js") {
        script_id = info.scriptId
    }
}

function attachDebugger(tabId, callback) {
    chrome.debugger.attach({ tabId: tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
            console.log('Failed to attach debugger:', chrome.runtime.lastError.message);
        }

        chrome.debugger.onEvent.addListener(onEvent);
        chrome.debugger.sendCommand({ tabId: tabId }, 'Debugger.enable', {}, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to enable debugger:', chrome.runtime.lastError.message);
            }

            const interval = setInterval(() => {
                if (script_id !== undefined) {
                    clearInterval(interval);
                    chrome.debugger.onEvent.removeListener(onEvent);
                    callback();
                }
            });
        });
    });
}




/////////////////////

function reactiontimeEvent(debuggeeId, message, params) {
    let waitTime

    if (tabID == debuggeeId.tabId && message == 'Debugger.paused') {

        chrome.debugger.sendCommand({ tabId: tabID }, 'Runtime.getProperties', {
            objectId: params.callFrames[0].scopeChain[0].object.objectId, // local scope
        }, (result) => {
            if (chrome.runtime.lastError) { console.error('Failed to get properties for local scope:', chrome.runtime.lastError) }

            chrome.debugger.sendCommand({ tabId: tabID }, 'Runtime.getProperties', {
                objectId: result.result[2].value.objectId, // array n
            }, (result) => {
                if (chrome.runtime.lastError) { console.error('Failed to get properties for result.result[2].value:', chrome.runtime.lastError) }

                chrome.debugger.sendCommand({ tabId: tabID }, 'Runtime.getProperties', {
                    objectId: result.result[2].value.objectId, // currentTrial
                }, (result) => {
                    if (chrome.runtime.lastError) { console.error('Failed to get properties for currentTrial:', chrome.runtime.lastError) }

                    chrome.debugger.sendCommand({ tabId: tabID }, 'Debugger.resume') // RESUME

                    waitTime = result.result[0].value.value
                    console.log(waitTime)
                    setTimeout(() => {
                        chrome.scripting.executeScript({
                            target: { tabId: tabID, allFrames: true },
                            func: () => {
                                let click_me = document.querySelector("#root > div > div:nth-child(4) > div.view-go.e18o0sx0.css-saet2v.e19owgy77 > div");

                                // safety check to not send event too early, bc the timer gets desynced
                                if (click_me == null) {
                                    const l = setInterval(() => {
                                        click_me = document.querySelector("#root > div > div:nth-child(4) > div.view-go.e18o0sx0.css-saet2v.e19owgy77 > div");
                                        console.log(click_me)
                                        if (click_me != null) {
                                            clearInterval(l)
                                            click_me.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                        }
                                    }, 1);
                                } else {
                                    click_me.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                }

                            }
                        })

                    }, waitTime);

                });
            });
        });

    }
}


function addReactionTimeBot() {
    attachDebugger(tabID, () => {
        set_breakpoint(tabID, script_id, 0, breakpoints.reactiontime.columnNumber, null, () => {
            chrome.debugger.onEvent.addListener(reactiontimeEvent);
        });
    });
}

//////////////////////////////


function sequenceEvent(debuggeeId, message, params) {
    let length
    let sequence

    if (tabID == debuggeeId.tabId && message == 'Debugger.paused') {
        chrome.debugger.sendCommand({ tabId: tabID }, 'Runtime.getProperties', {
            objectId: params.callFrames[0].returnValue.objectId, // return value of function rr (returns sequence for the following)
        }, (result) => {
            if (chrome.runtime.lastError) { console.error('Failed to get properties for return Value:', chrome.runtime.lastError) }


            console.log(result)
            chrome.debugger.sendCommand({ tabId: tabID }, 'Runtime.getProperties', {
                objectId: result.result[1].value.objectId, // array sequence
            }, (result) => {
                if (chrome.runtime.lastError) { console.error('Failed to get properties for return Value:', chrome.runtime.lastError) }

                length = result.result.length - 51 // default attributes

                sequence = []
                for (let i = 0; i < length; i++) {
                    sequence.push(result.result[i].value.value) // add each square of sequence into own sequence
                }

                chrome.debugger.sendCommand({ tabId: tabID }, 'Debugger.resume')

                chrome.storage.sync.get("delay", function (delay_result) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabID, allFrames: true },
                        args: [sequence, delay_result.delay],
                        func: (sequence, delay) => {
                            console.log(sequence)
                            setTimeout(() => {
                                wait_for_squares = setInterval(() => {

                                    squares = document.getElementsByClassName("square")

                                    if (squares[sequence[sequence.length - 1]].className !== "square active") { // check if last square from sequence is not active anymore
                                        clearInterval(wait_for_squares)


                                        let i = 0
                                        loop = setInterval(() => {
                                            if (i < sequence.length) {

                                                const square_element = squares[sequence[i]]
                                                if (delay >= 20) {
                                                    square_element.style.opacity = "1";
                                                    square_element.style.background = "white";
                                                    square_element.style.transform = "scale(1, 1)";
                                                    square_element.style.transition = "none 0s ease 0s";
                                                }

                                                square_element.dispatchEvent(new Event("mousedown", { bubbles: true }))

                                                if (delay >= 20) {
                                                    setTimeout(() => {
                                                        square_element.style.opacity = "";
                                                        square_element.style.background = "";
                                                        square_element.style.transform = "";
                                                        square_element.style.transition = "";
                                                    }, 1 + delay / 20) // if its too short, it can reference the wrong thing lol or whatever idk
                                                }

                                                i++;

                                            } else {
                                                clearInterval(loop)
                                            }

                                        }, delay)

                                    }
                                }, 10)

                            }, sequence.length * 500 + 1000) // start wait = 1000, 500 delay between every square
                        }
                    })

                });

            })
        })

    }
}


function addSequenceBot() {
    attachDebugger(tabID, () => {
        set_breakpoint(tabID, script_id, 0, breakpoints.sequence.columnNumber, null, () => {
            chrome.debugger.onEvent.addListener(sequenceEvent)
        })
    })
}


//////////////////////

function aimbotEvent(debuggeeId, message, params) {
    if (tabID == debuggeeId.tabId && message == 'Debugger.paused') {

        chrome.storage.sync.get("delay", function (delay_result) {

            chrome.scripting.executeScript({

                target: { tabId: tabID, allFrames: true },
                args: [delay_result.delay],
                func: (delay) => {
                    if (delay < 5) {
                        for (let i = 0; i < 30; i++) {
                            document.querySelector("#root > div > div:nth-child(4) > div.css-12ibl39.e19owgy77 > div > div.desktop-only > div > div > div > div:nth-child(2)").dispatchEvent(new Event("mousedown", {
                                "bubbles": true
                            }))
                        }


                    } else {
                        let i = 0
                        loop = setInterval(() => {

                            if (i < 30) {

                                document.querySelector("#root > div > div:nth-child(4) > div.css-12ibl39.e19owgy77 > div > div.desktop-only > div > div > div > div:nth-child(2)").dispatchEvent(new Event("mousedown", {
                                    "bubbles": true
                                }))
                                i++;

                            } else {
                                clearInterval(loop)
                            }

                        }, delay)
                    }
                }
            })

        });

        chrome.debugger.sendCommand({ tabId: tabID }, 'Debugger.resume')
    }

}

function addAimBot() {
    attachDebugger(tabID, () => {
        set_breakpoint(tabID, script_id, 0, breakpoints.aim.columnNumber, 'document.querySelector("#root > div > div:nth-child(4) > div.css-12ibl39.e19owgy77 > div > div.desktop-only > span") === null', () => {
            chrome.debugger.onEvent.addListener(aimbotEvent)
        })
    })
}

//////////////////////

function numberMemoryEvent(debuggeeId, message, params) {
    if (tabID == debuggeeId.tabId && message == 'Debugger.paused') {
        chrome.debugger.sendCommand({ tabId: tabID }, 'Runtime.getProperties', {
            objectId: params.callFrames[0].scopeChain[0].object.objectId, // local scope
        }, (result) => {

            if (chrome.runtime.lastError) { console.error('Failed to get properties for local scope:', chrome.runtime.lastError) }

            chrome.debugger.sendCommand({ tabId: tabID }, 'Runtime.getProperties', {
                objectId: result.result[3].value.objectId, // array c
            }, (result) => {

                answer = result.result[2].value.value // c.currentAnswer

                // this doesnt work as the submit button checks if the input field was used and stuff... at some point i will find a use for this
                // chrome.debugger.sendCommand({ tabId: tabID }, 'Debugger.evaluateOnCallFrame', {
                //     callFrameId: params.callFrames[0].callFrameId,
                //     throwOnSideEffect: false,
                //     silent: true,
                //     returnByValue: false,
                //     expression: `c.userAnswer=${answer}`
                // })


                chrome.debugger.sendCommand({ tabId: tabID }, 'Debugger.resume', () => {
                    chrome.storage.sync.get('toggle_autonext', function (result) {
                        
                        chrome.scripting.executeScript({

                            target: { tabId: tabID, allFrames: true },
                            args: [answer, result.toggle_autonext],
                            func: (answer, toggle_autonext) => {
                                document.querySelector("#root > div > div:nth-child(4) > div.number-memory-test.prompt.e12yaanm0.css-18qa6we.e19owgy77 > div > div > div > form > div:nth-child(2) > input[type=text]").value = answer
                                document.querySelector("#root > div > div:nth-child(4) > div.number-memory-test.prompt.e12yaanm0.css-18qa6we.e19owgy77 > div > div > div > form > div:nth-child(2) > input[type=text]").dispatchEvent(new InputEvent("input", { "bubbles": true })) // make the button do smth
                                document.querySelector("#root > div > div:nth-child(4) > div.number-memory-test.prompt.e12yaanm0.css-18qa6we.e19owgy77 > div > div > div > form > div:nth-child(3) > button").click()
                                
                                if (toggle_autonext) {
                                    document.querySelector("#root > div > div:nth-child(4) > div.number-memory-test.anim-correct.e12yaanm0.css-18qa6we.e19owgy77 > div > div > div > div:nth-child(2) > button").click()
                                }
                            }
                        })

                    });
                })


            })
        })
    }
}

function addNumberMemoryBot() {
    attachDebugger(tabID, () => {
        // breakpoint would break on input too if not for the condition
        set_breakpoint(tabID, script_id, 0, breakpoints.numbermemory.columnNumber, 'document.querySelector("#root > div > div:nth-child(4) > div.number-memory-test.question.e12yaanm0.css-18qa6we.e19owgy77 > div > div > div > div.big-number") !== null', () => {
            chrome.debugger.onEvent.addListener(numberMemoryEvent)
        })
    })
}