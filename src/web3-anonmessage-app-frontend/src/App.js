import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory as timeCapsuleIDL, canisterId } from "declarations/web3-anonmessage-app-backend";

export default class App {
  constructor() {
    this.backend = null;
    this.agent = null;

    this.init();
  }

  async init() {
    try {
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

      this.agent = new HttpAgent({
        host: isLocal ? "http://localhost:4943" : "https://ic0.app",
      });

      if (isLocal) {
        try {
          await this.agent.fetchRootKey();
          console.log("Root key fetched (local)");
        } catch (err) {
          console.error("Failed to fetch root key (local dev):", err);
          alert("Gagal fetch root key. Pastikan `dfx start` sedang berjalan.");
          return;
        }
      }

      this.backend = Actor.createActor(timeCapsuleIDL, {
        agent: this.agent,
        canisterId,
      });

      document.getElementById("submitBtn").onclick = () => this.submitMessage();
      await this.loadMessages();
    } catch (error) {
      console.error("Initialization failed:", error);
      alert("Gagal inisialisasi aplikasi. Cek console.");
    }
  }

  async submitMessage() {
    try {
      const input = document.getElementById("messageInput");
      const text = input.value.trim();
      if (!text) return alert("Pesan kosong");

      await this.backend.submit(text);
      input.value = "";
      await this.loadMessages();
    } catch (error) {
      console.error("Failed to submit message:", error);
      alert("Gagal mengirim pesan. Cek koneksi ke canister.");
    }
  }

  async loadMessages() {
    try {
      const messages = await this.backend.getMessages();
      const list = document.getElementById("messageList");
      list.innerHTML = "";

      messages.forEach(([id, text]) => {
        const li = document.createElement("li");
        li.textContent = `#${id}: ${text}`;
        list.appendChild(li);
      });
    } catch (error) {
      console.error("Failed to load messages:", error);
      alert("Gagal memuat pesan.");
    }
  }
}
