import Text "mo:base/Text";
import Array "mo:base/Array";

actor {
  type Message = (Nat, Text);

  var messages : [Message] = [];
  var nextId : Nat = 1;

  public func submit(text: Text) : async () {
    messages := Array.append(messages, [(nextId, text)]);
    nextId += 1;
  };

  public query func getMessages() : async [Message] {
    return messages;
  };
};
