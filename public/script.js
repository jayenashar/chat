
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

// get user from firebase-auth
const nameInput = document.querySelector(".new-message .name");
const messageInput = document.querySelector(".new-message .text");
const button = document.querySelector("button");

let uid = null;
let stopReadingMessages = function () { };

onAuthStateChanged(auth, function (user) {
    if (user) {
        // User is signed in.
        nameInput.innerHTML = user.displayName;
        nameInput.classList.remove("placeholder");
        localStorage.setItem("login_hint", user.email);
        messageInput.contentEditable = true;
        button.disabled = false;
        uid = user.uid;
        const signOut = function () {
            auth.signOut();
            nameInput.removeEventListener("click", signOut);
        };
        nameInput.addEventListener("click", signOut);
        startReadingMessages();
    } else {
        // No user is signed in.
        messageInput.contentEditable = false;
        button.disabled = true;
        uid = null;
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
                    nameInput.removeEventListener("click", signIn);
                    messageInput.removeEventListener("click", signIn);
                })
                .catch(function (error) {
                    console.error(error);
                    alert(error.toString());
                });
        };
        nameInput.addEventListener("click", signIn);
        messageInput.addEventListener("click", signIn);
        stopReadingMessages();
    }
});

// Send message
const messagesCollection = collection(db, "messages");
const messagePlaceholder = `I did ...
I expected ...
but I got ...`;
messageInput.innerHTML = messagePlaceholder;
const send = function () {
    // textContent doesn't include line breaks.  innerHTML includes rich HTML and line breaks as <br/>, innerText includes line breaks as \r
    // any of the 3 can be used to set the value of the span, but we want innerText can be used to get the value of the span
    const name = nameInput.textContent;
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
button.addEventListener("click", send);
messageInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        if (!e.shiftKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            send();
        }
    }
});
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
    stopReadingMessages = onSnapshot(q, function (querySnapshot) {
        const currentScroll = messages.scrollTop;
        const maxScroll = messages.scrollHeight - messages.clientHeight;
        messages.innerHTML = "";
        querySnapshot.forEach(function (/** @type firebase. */ doc) {
            /** @type Message */
            const data = doc.data();
            // random colour based on hash of lowercase of letters in name
            const hash = data.name
                .toLowerCase()
                .replace(/[^a-z]/g, "")
                .split("")
                .reduce(function (acc, char) {
                    return 26 * acc + char.charCodeAt(0) - "a".charCodeAt(0);
                }, 0);
            const hue = hash % 360;
            // replace <br> with newlines and < and > with &lt; and &gt; (though < and > is not part of innerText)
            const text = data.message
                .replace(/<br.*?>/g, "\n")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            const message = document.createElement("div");
            message.classList.add("message");
            message.innerHTML = `
            <span class="timestamp">${(data.timestamp?.toDate() ?? new Date()).toLocaleString()}</span>
            <span class="name" style="color: hsl(${hue}, 100%, 80%)">${data.name}</span>
            ${data.uid === uid && text.charAt(0) !== '\n' && text.includes('\n')? `<button class="newline" data-path="${doc.ref.path}">⏎</button>` : ""}
            <span class="text">${text}</span>
          `;
            // prepend
            messages.prepend(message);
        });
        if (currentScroll === maxScroll) {
            getComputedStyle(messages); // force reflow
            messages.scrollTop = messages.scrollHeight - messages.clientHeight;
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
            updateDoc(document, { message }).catch(function (error) {
                console.error("Error updating document: ", error);
            });
        });
    }
});
