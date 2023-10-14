// TODO
// Whole thing lmao
// different tests
// settings on how fast test should go, if the bot should be active on the given test etc
// USE setBreakpointByUrl
// properly remove events

const supported_urls = ["https://humanbenchmark.com/tests/reactiontime", "https://humanbenchmark.com/tests/sequence", "https://humanbenchmark.com/tests/aim"]
let tab_id


document.addEventListener("DOMContentLoaded", () => main())

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log(message)
    if (message.type == "urlchanged") {
        main()
    }
})

// this doesnt work :C
// document.addEventListener("beforeonunload", () => {
//     console.log(closed)
//     chrome.storage.sync.set({
//         popupopened: false,
//     })
// })

chrome.storage.sync.set({
    popupopened: true,
})


function main() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        // const tab_id = tabs[0].id

        document.body.innerHTML=`<center><h1>HumanBenchmark</h1></center><center><h2>INVALID URL</h2></center><script src="popup.js"></script>`
        if (!supported_urls.includes(tabs[0].url)) {
            console.log("[HumanBenchmark Bot] Invalid URL")
        } else {

            test_name = tabs[0].url.split("tests/", 2)[1].split("/", 1)[0]

            document.querySelector("body > center:nth-child(2) > h2").textContent = test_name.charAt(0).toUpperCase() + test_name.slice(1)

            let toggle = document.createElement("input");
            toggle.setAttribute("type", "checkbox");
            toggle.setAttribute("id", "toggle");

            chrome.storage.sync.get('toggle', function (result) {
                toggle.checked = result.toggle || false;
            });

            let toggle_label = document.createElement("label");
            toggle_label.innerHTML = `<label for="toggle">Enable Bot</label>`

            document.body.appendChild(toggle_label);
            document.body.appendChild(toggle);

            if (test_name == "sequence" || "aim") {
                
                let delay_input = document.createElement("div")
                delay_input.innerHTML = '<div><label for="delay">Delay (ms) :  </label><input type="number" id="delay" name="delay" min="1" max="60000" value="50"></div>'
                
                document.body.appendChild(delay_input)
                chrome.storage.sync.set({
                    delay: 50,
                })
                
                delay_input.addEventListener("change", function () {
                    chrome.storage.sync.set({
                        delay: Number(document.getElementById("delay").value),
                    })
                });
            }

            toggle.addEventListener("change", function () {
                chrome.storage.sync.set({
                    toggle: toggle.checked,
                })
                chrome.runtime.sendMessage({
                    type: "toggle",
                    tab_id: tabs[0].id,
                    test: test_name
                });
            });
        }


    });
}

// 1-2 ms
