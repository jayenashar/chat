
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/9.18.0/firebase-auth.js";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "https://www.gstatic.com/firebasejs/9.18.0/firebase-firestore.js";
import { getDownloadURL, getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-storage.js";

/**
 * @typedef Message
 * @property {string} name
 * @property {string} message
 * @property {firebase.firestore.Timestamp} timestamp
 * @property {string} chatRoom
 * @property {string} uid
 */

const firebaseConfig = {
    apiKey: "AIzaSyCmksKb8ymTVLsTrkCGQxbtdViOjEBpXtA",
    authDomain: "jayen-chat.firebaseapp.com",
    projectId: "jayen-chat",
    storageBucket: "jayen-chat.appspot.com",
    messagingSenderId: "95320847991",
    appId: "1:95320847991:web:53ba979442a96110323872",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage();

// get user from firebase-auth
const messageInput = document.querySelector(".new-message .text");

let uid = null;
let stopReadingMessages = function () { };

// manage body element
onAuthStateChanged(auth, function (user) {
    if (user) {
        document.body.classList.add("signed-in");
        localStorage.setItem("login_hint", user.email);
        // const signOut = function () {
        //     auth.signOut();
        //     document.body.removeEventListener("click", signOut);
        // };
        // document.body.addEventListener("click", signOut);
    } else {
        document.body.classList.remove("signed-in");
        const signIn = function () {
            // login with google
            const provider = new GoogleAuthProvider();
            const login_hint = localStorage.getItem("login_hint");
            if (login_hint?.endsWith("@students.mq.edu.au")) {
                provider.setCustomParameters({
                    login_hint,
                });
            }
            signInWithPopup(auth, provider)
                .then(function () {
                    document.body.removeEventListener("click", signIn);
                })
                .catch(function (error) {
                    console.error(error);
                    alert(error.toString());
                });
        };
        document.body.addEventListener("click", signIn);
    }
});

// manage name element
onAuthStateChanged(auth, function (user) {
    if (user) {
        const name = document.querySelector("option.name");
        name.value = user.displayName;
        name.innerHTML = user.displayName;
    }
});

onAuthStateChanged(auth, function (user) {
    if (user) {
        uid = user.uid;
        startReadingMessages();
    } else {
        uid = null;
        stopReadingMessages();
    }
});

// Paste image
messageInput.addEventListener("paste", function (e) {
    if (e.clipboardData) {
        const items = e.clipboardData.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    // image
                    const blob = items[i].getAsFile();
                    e.preventDefault();
                    addDoc(messagesCollection, {
                        name: document.querySelector("select.name").value,
                        image: true,
                        timestamp: serverTimestamp(),
                        chatRoom: location.origin,
                        uid,
                    }).then(function (docRef) {
                        console.log("Document written with ID: ", docRef.id);
                        const imageRef = ref(storage, `images/${docRef.id}`);
                        uploadBytes(imageRef, blob).then(function () {
                            console.log("Image uploaded");
                        }).catch(function (error) {
                            console.error("Error uploading image: ", error);
                        });
                    });
                }
            }
        }
    }
});

// Send message
const messagesCollection = collection(db, "messages");
const messagePlaceholder = `I did ...
I expected ...
but I got ...`;
messageInput.innerHTML = messagePlaceholder;
const send = function () {
    const name = document.querySelector("select.name").value;
    // textContent doesn't include line breaks.  innerHTML includes rich HTML and line breaks as <br/>, innerText includes line breaks as \r
    // any of the 3 can be used to set the value of the span, but we want innerText can be used to get the value of the span
    const message = messageInput.innerText;
    if (
        message &&
        messageInput.contentEditable &&
        !messageInput.classList.contains("placeholder")
    ) {
        addDoc(messagesCollection, {
            name,
            message,
            timestamp: serverTimestamp(),
            chatRoom: location.origin,
            uid,
        }).catch(function (error) {
            console.error("Error adding document: ", error);
            const newMessage = messageInput.innerText;
            if (newMessage) {
                messageInput.innerHTML = message + "\n\n" + newMessage;
            } else {
                messageInput.innerHTML = message;
            }
        });
        // if messageInput has focus, clear it
        if (document.activeElement.isEqualNode(messageInput)) {
            messageInput.innerHTML = "";
        } else {
            messageInput.innerHTML = messagePlaceholder;
            messageInput.classList.add("placeholder");
        }
    }
};
document.querySelector('.new-message button').addEventListener("click", send);
messageInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        if (!e.shiftKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            send();
        }
    }
});

// manage placeholder
messageInput.addEventListener("focus", function () {
    if (messageInput.classList.contains("placeholder")) {
        messageInput.innerHTML = "";
    }
    messageInput.classList.remove("placeholder");
});
messageInput.addEventListener("blur", function () {
    if (!messageInput.innerText) {
        messageInput.innerHTML = messagePlaceholder;
        messageInput.classList.add("placeholder");
    }
});

// Get messages
const messages = document.querySelector(".messages");
const q = query(
    messagesCollection,
    where("chatRoom", "==", location.origin),
    orderBy("timestamp", "desc"),
    limit(101)
);
function startReadingMessages() {
    const imagesURL = {};
    stopReadingMessages = onSnapshot(q, function (querySnapshot) {
        const currentScroll = messages.scrollTop;
        const maxScroll = messages.scrollHeight - messages.clientHeight;
        querySnapshot.docChanges().reverse().forEach(function (change) {
            const doc = change.doc;
            /** @type Message */
            const data = doc.data();
            const text = data?.message
                // replace <br> with newlines
                ?.replace(/<br.*?>/g, "\n")
                // replace < and > with &lt; and &gt; (though < and > is not part of innerText)
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                // remove trailing whitespace
                .replace(/[^\S\r\n]+$/gm, "")
                // collapse multiple newlines into two
                .replace(/\n{3,}/g, "\n\n");
            if (change.type === "added") {
                // random colour based on hash of lowercase of letters in name
                const hash = data.name
                    .toLowerCase()
                    .replace(/[^a-z]/g, "")
                    .split("")
                    .reduce(function (acc, char) {
                        return 26 * acc + char.charCodeAt(0) - "a".charCodeAt(0);
                    }, 0);
                const hue = hash % 360;
                const image = data.image;
                const message = `
                <div class="message" data-id="${doc.id}">
                    <span class="timestamp">${(data.timestamp?.toDate() ?? new Date()).toLocaleString()}</span>
                    <span class="name" style="color: hsl(${hue}, 100%, 80%)">${data.name}</span>
                    ${data.uid === uid && text && text.charAt(0) !== '\n' && text.includes('\n') ? `<button class="newline" data-path="${doc.ref.path}">⏎</button>` : ""}
                    ${image && !text ?
                        imagesURL[doc.id] ?
                            `<img src="${imagesURL[doc.id]}" />` :
                            `<img data-id="${doc.id}" />` :
                        ""}
                    ${text && !image ? `<span class="text">${text}</span>` : ""}
                </div>
                `;
                messages.insertAdjacentHTML("beforeend", message);
            }
            if (change.type === "modified") {
                if (!data.image) {
                    document.querySelector(`.message[data-id="${doc.id}"] .text`).innerHTML = text;
                }
            }
            if (change.type === "removed") {
                document.querySelector(`.message[data-id="${doc.id}"]`).remove();
            }
        });
        if (currentScroll === maxScroll) {
            getComputedStyle(messages); // force reflow
            messages.scrollTop = messages.scrollHeight - messages.clientHeight;
        }
        // set src of images
        const images = messages.querySelectorAll("img[data-id]:not([src])");
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const id = image.getAttribute("data-id");
            const path = `images/${id}`;
            setSrc();
            function setSrc() {
                getDownloadURL(ref(storage, path)).then(function (url) {
                    image.setAttribute("src", url);
                    imagesURL[id] = url;
                    image.addEventListener("load", function () {
                        if (currentScroll === maxScroll) {
                            getComputedStyle(messages); // force reflow
                            messages.scrollTop = messages.scrollHeight - messages.clientHeight;
                        }
                    });
                }).catch(function (error) {
                    console.log(`Error getting download URL: ${error}. Retrying...`);
                    setTimeout(setSrc, 100);
                });
            }
        }
    });
}
document.addEventListener("click", function (e) {
    if (e.target instanceof HTMLButtonElement && e.target.classList.contains("newline")) {
        e.preventDefault();
        const path = e.target.getAttribute("data-path");
        const document = doc(db, path);
        getDoc(document).then(function (doc) {
            const data = doc.data();
            const oldMessage = data.message;
            const message = '\n' + oldMessage;
            updateDoc(document, { message }).then(function (){
                e.target.remove();
            }).catch(function (error) {
                console.error("Error updating document: ", error);
            });
        });
    }
});
