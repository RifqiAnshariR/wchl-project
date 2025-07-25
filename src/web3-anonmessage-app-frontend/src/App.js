import { AuthClient } from "@dfinity/auth-client";
import { createActor } from "declarations/web3-anonmessage-app-backend";
import { canisterId } from "declarations/web3-anonmessage-app-backend/index.js";

const network = process.env.DFX_NETWORK;
const identityProvider =
  network === 'ic'
    ? 'https://identity.ic0.app'
    : 'http://uxrrr-q7777-77774-qaaaq-cai.localhost:4943/';

export default class App {
  constructor() {
    this.authClient = undefined;
    this.actor = undefined;
    this.currentRoomId = null;
    this.isAuthenticated = false;
    this.init();
  }

  async init() {
    this.authClient = await AuthClient.create();

    if (await this.authClient.isAuthenticated()) {
      await this.handleAuthenticated();
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const roomId = urlParams.get("room");
      if (roomId) {
        await this.setupAnonymousActor();
        this.showChatScreen(roomId);
      } else {
        this.showLoginScreen();
      }
    }

    this.setupEventListeners();
    this.startAutoRefresh();
  }

  setupEventListeners() {
    document.querySelector("#loginBtn")?.addEventListener("click", () => this.login());
    document.querySelector("#logoutBtn")?.addEventListener("click", () => this.logout());
    document.querySelector("#createRoomBtn")?.addEventListener("click", () => this.createNewRoom());
    document.querySelector("#joinRoomForm")?.addEventListener("submit", (e) => this.joinRoom(e));
    document.querySelector("#backHomeBtn")?.addEventListener("click", () => this.goHome());
    document.querySelector("#messageForm")?.addEventListener("submit", (e) => this.sendMessage(e));
  }

  async setupAuthenticatedActor() {
    this.actor = createActor(canisterId, {
      agentOptions: {
        identity: this.authClient.getIdentity(),
      },
    });
  }

  async setupAnonymousActor() {
    this.actor = createActor(canisterId);
  }

  async login() {
    try {
      await this.authClient.login({
        identityProvider,
        onSuccess: () => this.handleAuthenticated()
      });
    } catch (error) {
      this.showError("Login failed: " + error.message);
    }
  }

  async handleAuthenticated() {
    this.isAuthenticated = true;
    await this.setupAuthenticatedActor();
    this.showHomeScreen();
    this.loadUserRooms();
  }

  async logout() {
    await this.authClient.logout();
    this.isAuthenticated = false;
    this.actor = null;
    this.showLoginScreen();
  }

  async createNewRoom() {
    try {
      const result = await this.actor.createChatRoom();
      if ("ok" in result) {
        const roomId = result.ok;
        this.showChatScreen(roomId);
      } else {
        this.showError(result.err);
      }
    } catch (error) {
      this.showError("Failed to create room: " + error.message);
    }
  }

  async joinRoom(event) {
    event.preventDefault();

    const roomId = document.getElementById("roomIdInput").value.trim();
    if (!roomId) {
      this.showError("Please enter a room ID");
      return;
    }

    if (!this.actor) {
      await this.setupAnonymousActor();
    }

    const exists = await this.actor.roomExists(roomId);
    if (!exists) {
      this.showError("Invalid room ID");
      return;
    }

    this.showChatScreen(roomId);
  }

  async loadUserRooms() {
    try {
      const rooms = await this.actor.getMyChatRooms();
      this.displayRooms(rooms);
    } catch (error) {
      this.showError("Failed to load rooms: " + error.message);
    }
  }

  displayRooms(rooms) {
    const roomList = document.getElementById("roomList");
    if (rooms.length === 0) {
      roomList.innerHTML = '<p style="color: #666;">No rooms yet. Create your first room!</p>';
      return;
    }

    roomList.innerHTML = rooms
      .map(
        (room) => `
        <button class="room-item" data-room-id="${room.id}">
          <strong>Room ID:</strong> ${room.id}<br>
          <small>Messages: ${room.messages.length} | Created: ${new Date(
            Number(room.created / 1000000n)
          ).toLocaleDateString()}</small>
        </div>
      `
      )
      .join("");

    roomList.querySelectorAll(".room-item").forEach((item) => {
      item.addEventListener("click", () => {
        const roomId = item.dataset.roomId;
        this.showChatScreen(roomId);
      });
    });
  }

  hideAllScreens() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("homeScreen").style.display = "none";
    document.getElementById("chatScreen").style.display = "none";
  }

  showSpinner() {
    const spinner = document.getElementById("spinner");
    if (spinner) {
      spinner.style.display = "block";
    }
  }

  hideSpinner() {
    const spinner = document.getElementById("spinner");
    if (spinner) spinner.style.display = "none";
  }

  showChatScreen(roomId) {
    this.hideAllScreens();
    this.showSpinner();
    setTimeout(async () => {
      this.currentRoomId = roomId;
      document.getElementById("chatScreen").style.display = "block";
      document.getElementById("chatTitle").innerHTML = `<strong>Room ID:</strong> ${roomId}`;
      const newUrl = `${window.location.pathname}?room=${roomId}`;
      window.history.pushState({}, "", newUrl);
      await this.loadMessages();
      this.hideSpinner();
    }, 500);
  }

  async loadMessages() {
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const result = await this.actor.getMessages(this.currentRoomId);
      if ("ok" in result) {
        this.displayMessages(result.ok);
      } else {
        this.showError(result.err);
      }
    } catch (error) {
      this.showError("Failed to load messages: " + error.message);
    }
  }

  displayMessages(messages) {
    const messagesDiv = document.getElementById("messages");
    if (messages.length === 0) {
      messagesDiv.innerHTML = '<p style="color: #666;">No messages yet. Be the first to send one!</p>';
      return;
    }

    messagesDiv.innerHTML = messages
      .map(
        (message) => `
        <div class="message">
          <div>${message.text}</div>
          <small style="color: #666;">${new Date(
            Number(message.timestamp / 1000000n)
          ).toLocaleString()}</small>
        </div>
      `
      )
      .join("");

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async sendMessage(event) {
    event.preventDefault();

    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;

    try {
      const result = await this.actor.submitMessage(this.currentRoomId, text);
      if ("ok" in result) {
        input.value = "";
        this.loadMessages();
      } else {
        this.showError(result.err);
      }
    } catch (error) {
      this.showError("Failed to send message: " + error.message);
    }
  }

  goHome() {
    if (this.isAuthenticated) {
      this.showHomeScreen();
      this.loadUserRooms();
    } else {
      this.showLoginScreen();
    }
    window.history.pushState({}, "", window.location.pathname);
  }

  showLoginScreen() {
    this.hideAllScreens();
    this.showSpinner();
    setTimeout(() => {
      document.getElementById("loginScreen").style.display = "block";
      this.hideSpinner();
    }, 500);
  }

  showHomeScreen() {
    this.hideAllScreens();
    this.showSpinner();
    setTimeout(() => {
      document.getElementById("homeScreen").style.display = "block";
      this.hideSpinner();
    }, 500);
  }

  showError(message) {
    const errorDiv = document.getElementById("error");
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
    setTimeout(() => {
      errorDiv.style.display = "none";
    }, 5000);
  }

  startAutoRefresh() {
    setInterval(() => {
      if (this.currentRoomId && document.getElementById("chatScreen").style.display !== "none") {
        this.loadMessages();
      }
    }, 3000);
  }
}