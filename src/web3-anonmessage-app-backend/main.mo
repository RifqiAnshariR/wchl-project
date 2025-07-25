// ===== Imports =====
import Text "mo:base/Text";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Iter "mo:base/Iter";
import Int "mo:base/Int";
import Nat "mo:base/Nat";

actor {

  // ===== Type Definitions =====
  type Message = {
    id: Nat;
    text: Text;
    timestamp: Int;
  };

  type ChatRoom = {
    id: Text;
    owner: Principal;
    messages: [Message];
    created: Int;
  };

  type CreateRoomResult = Result.Result<Text, Text>;
  type GetRoomResult = Result.Result<ChatRoom, Text>;

  // ===== State Variables =====
  private stable var nextMessageId : Nat = 1;
  private stable var roomEntries : [(Text, ChatRoom)] = [];
  private var chatRooms = HashMap.HashMap<Text, ChatRoom>(10, Text.equal, Text.hash);

  // ===== Upgrade System =====
  system func preupgrade() {
    roomEntries := Iter.toArray(chatRooms.entries());
  };

  system func postupgrade() {
    chatRooms := HashMap.fromIter<Text, ChatRoom>(
      roomEntries.vals(),
      roomEntries.size(),
      Text.equal,
      Text.hash
    );
    roomEntries := [];
  };

  // ===== Helpers =====
  private func generateRoomId(owner: Principal) : Text {
    let timestamp = Int.abs(Time.now());
    Principal.toText(owner) # "-" # Nat.toText(timestamp % 999999)
  };

  // ===== Public API =====
  // Create a new chat room (authenticated users only)
  public shared(msg) func createChatRoom() : async CreateRoomResult {
    if (Principal.isAnonymous(msg.caller)) {
      return #err("Authentication required");
    };

    let roomId = generateRoomId(msg.caller);
    let newRoom : ChatRoom = {
      id = roomId;
      owner = msg.caller;
      messages = [];
      created = Time.now();
    };

    chatRooms.put(roomId, newRoom);
    #ok(roomId)
  };

  // Check if a room exists
  public query func roomExists(roomId: Text) : async Bool {
    chatRooms.get(roomId) != null
  };

  // Get user's own chat rooms
  public shared(msg) func getMyChatRooms() : async [ChatRoom] {
    if (Principal.isAnonymous(msg.caller)) {
      return [];
    };

    Array.filter<ChatRoom>(
      Iter.toArray(chatRooms.vals()),
      func(room) = Principal.equal(room.owner, msg.caller)
    )
  };

  // Submit a message to a room (anonymous allowed)
  public func submitMessage(roomId: Text, text: Text) : async Result.Result<(), Text> {
    switch (chatRooms.get(roomId)) {
      case null { #err("Chat room not found") };
      case (?room) {
        if (Text.size(text) == 0) {
          return #err("Message cannot be empty");
        };

        let newMessage : Message = {
          id = nextMessageId;
          text = text;
          timestamp = Time.now();
        };

        let updatedMessages = Array.append(room.messages, [newMessage]);
        let updatedRoom = {
          id = room.id;
          owner = room.owner;
          messages = updatedMessages;
          created = room.created;
        };

        chatRooms.put(roomId, updatedRoom);
        nextMessageId += 1;
        #ok()
      };
    }
  };

  // Get all messages in a room
  public query func getMessages(roomId: Text) : async Result.Result<[Message], Text> {
    switch (chatRooms.get(roomId)) {
      case null { #err("Chat room not found") };
      case (?room) { #ok(room.messages) };
    }
  };

  // Get full chat room info
  public query func getChatRoom(roomId: Text) : async GetRoomResult {
    switch (chatRooms.get(roomId)) {
      case null { #err("Chat room not found") };
      case (?room) { #ok(room) };
    }
  };
}
