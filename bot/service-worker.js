
let breakpoints = {
    reactiontime: {
        columnNumber: 61054,
    },
    sequence: {
        columnNumber: 125677,
    }
}


// using this bc if the toggles user does smth on another humanbenchmark page, the message.tabID  will be for the new one, where the debugger isnt attached and stuff 
// this tabID will be the correct one since the toggle is synced across pages and can only be updated on humanbenchmark pages -> if its turned on, cant be turned on again
let tabID
let script_id

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log(message)
    switch (message.type) {
        case "toggle":
            chrome.storage.sync.get('toggle', function (result) {
                console.log(result)
                if (result.toggle) {
                    tabID = message.tab_id

                    switch (message.test) {
                        case "reactiontime":
                            addReactionTimeBot()
                            break

                        case "sequence":
                            addSequenceBot(tabID)
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
                    }
                    chrome.debugger.detach({ tabId: tabID }); // tabID is only used here
                }
            });

            break

    }
});

///////////////////////////

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {

    if (tabId == tabID && changeInfo.audible === undefined && changeInfo.status == "complete") { // audbile exists when tab isnt reloaded but updated
        let start_function

        chrome.storage.sync.get('toggle', function (result) {

            if (result.toggle) {

                switch (tab.url) {

                    case "https://humanbenchmark.com/tests/reactiontime":
                        chrome.debugger.onEvent.removeListener(reactiontimeEvent)
                        start_function = addReactionTimeBot

                    case "https://humanbenchmark.com/tests/sequence":
                        chrome.debugger.onEvent.removeListener(sequenceEvent)
                        start_function = addSequenceBot

                        chrome.debugger.detach({ tabId: tabID })

                }

                if (changeInfo.url === undefined) { // page got refreshed, now we need to reapply breakpoints, for convinience we're going to restart the whole bot
                    start_function()
                }

            }
        });
    }
});

/////////////////////


function set_breakpoint(tabID, script_id, lineNumber, columnNumber, callback) {
    console.log(tabID, script_id, lineNumber, columnNumber)
    chrome.debugger.sendCommand({ tabId: tabID }, 'Debugger.setBreakpoint', {
        location: {
            scriptId: script_id,
            lineNumber: lineNumber,
            columnNumber: columnNumber // 61054 = Wait for Green | 61215 = Click
        }
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
                        tries: result.tries+1,
                    })
                    setTimeout(() => chrome.tabs.reload(tabID), 1000)
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
            if (chrome.runtime.lastError) { console.error('Failed to get properties for params.callFrames[0].scopeChain[0].object:', chrome.runtime.lastError) }

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
        set_breakpoint(tabID, script_id, 0, breakpoints.reactiontime.columnNumber, () => {
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
                                                    }, 1+ delay / 20) // if its too short, it can reference the wrong thing lol or whatever idk
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
            // modify variables on breakpoint
            // chrome.debugger.sendCommand({ tabId: tabID }, 'Debugger.evaluateOnCallFrame', {
            //     callFrameId: params.callFrames[0].callFrameId,
            //     throwOnSideEffect: false,
            //     silent: true,
            //     returnByValue: false,
            //     expression: `variable=xyz`

            // }, function () {}

        })

    }
}


function addSequenceBot() {
    attachDebugger(tabID, () => {
        set_breakpoint(tabID, script_id, 0, breakpoints.sequence.columnNumber, () => {
            chrome.debugger.onEvent.addListener(sequenceEvent)
        })
    })
}