import { useState, useEffect } from "react";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

const Chatroom = () => {
  const [messages, setMessages] = useState([]); // Removed the system message
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("text"); // "text" for Gemini, "image" for Replicate

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to the chat
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      if (mode === "text") {
        const response = await fetch("http://localhost:5000/api/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, userMessage] }),
        });
        const data = await response.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      } else if (mode === "image") {
        const response = await fetch("http://localhost:5000/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: input }),
        });
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Generated image:", image: data.image },
        ]);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SignedIn>
        <div className="flex flex-col h-screen bg-n-8 text-n-1">
          {/* Chat Header */}
          <div className="p-4 border-b border-n-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold">Research Assistant Chatroom</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("text")}
                className={`px-3 py-1 rounded-lg ${
                  mode === "text" ? "bg-color-1 text-n-1" : "bg-n-7 text-n-1/50"
                }`}
              >
                Text Mode
              </button>
              <button
                onClick={() => setMode("image")}
                className={`px-3 py-1 rounded-lg ${
                  mode === "image" ? "bg-color-1 text-n-1" : "bg-n-7 text-n-1/50"
                }`}
              >
                Image Mode
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-4 p-3 rounded-lg ${
                  msg.role === "user" ? "bg-n-7 ml-auto max-w-[80%]" : "bg-n-6 mr-auto max-w-[80%]"
                }`}
              >
                {msg.image ? (
                  <>
                    <p>{msg.content}</p>
                    <img src={msg.image} alt="Generated image" className="mt-2 max-w-full rounded-lg" />
                  </>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            ))}
            {loading && <p className="text-n-1/50">Processing...</p>}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-n-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder={
                  mode === "text"
                    ? "Ask for research help, article generation, etc..."
                    : "Describe the image you want to generate..."
                }
                className="flex-1 p-2 rounded-lg bg-n-7 text-n-1 border border-n-6 focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={loading}
                className="px-4 py-2 bg-color-1 text-n-1 rounded-lg hover:bg-color-2 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
};

export default Chatroom;