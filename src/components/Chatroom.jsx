import { useState, useEffect, useRef } from "react";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { Upload, X, ChevronDown, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

const Chatroom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("text"); // "text" for Gemini, "image" for Nebius
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("Gemini");
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const models = ["Gemini", "ChatGPT", "Mistral", "Claude", "Llama4"];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const inputElement = document.getElementById("chat-input");
    if (inputElement) {
      inputElement.focus();
    }
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;

    const userMessage = {
      role: "user",
      content: input,
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      if (mode === "text") {
        const response = await fetch("http://localhost:5000/api/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            model: selectedModel.toLowerCase(),
          }),
        });

        if (!response.ok) {
          throw new Error(`Text generation failed: ${response.statusText}`);
        }
        const data = await response.json();
        setMessages((prev) => [...prev, { role: "model", content: data.content }]);
      } else if (mode === "image") {
        const response = await fetch("http://localhost:5000/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: input }),
        });
        if (!response.ok) {
          throw new Error(`Image generation failed: ${response.statusText}`);
        }
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: "model", content: "Generated image:", image: data.image },
        ]);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "model", content: `Error: ${error.message}` },
      ]);
    } finally {
      setLoading(false);
      setUploadedFiles([]); // Clear uploaded files after sending
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    const filePromises = Array.from(files).map((file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            data: reader.result, // Base64 data URL
            url: URL.createObjectURL(file), // For local preview
          });
        };
        reader.readAsDataURL(file); // Convert to base64
      })
    );

    Promise.all(filePromises).then((newFiles) => {
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    });
  };

  const removeFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <SignedIn>
        <div className="flex flex-col h-screen bg-black text-white relative">
          <div className="absolute inset-0 z-0">
            <svg className="w-full h-full opacity-10" width="100%" height="100%">
              <pattern id="dotPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#dotPattern)" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="text-center pt-8 pb-4">
              <h1 className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent animate-pulse">
                BrainHouse
              </h1>
              <p className="text-lg mt-1 text-gray-300">
                The <span className="text-2xl md:text-3xl">∞</span> Research Den
              </p>
            </div>

            <div
              className="flex-1 px-4 md:px-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
              style={{ overscrollBehavior: "contain" }}
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <div className="w-16 h-16 mb-4 border-4 border-gray-600 rounded-full flex items-center justify-center shadow-md">
                    <Send size={24} className="text-gray-600" />
                  </div>
                  <p>Start a conversation with BrainHouse</p>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-6 p-4 rounded-xl ${
                    msg.role === "user"
                      ? "bg-gray-800 ml-auto max-w-[80%]"
                      : "bg-gray-900 border border-gray-700 mr-auto max-w-[80%]"
                  }`}
                >
                  {msg.files &&
                    msg.files.length > 0 &&
                    msg.files.map((file, fileIndex) => (
                      <div key={fileIndex} className="relative mb-2">
                        {file.type.startsWith("image/") ? (
                          <img
                            src={file.url}
                            alt={file.name}
                            className="h-24 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex items-center bg-gray-700 p-2 rounded-lg">
                            <Upload size={16} className="mr-2" />
                            <span className="text-sm truncate max-w-xs" title={file.name}>
                              {file.name}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}

                  {msg.content && (
                    msg.role === "model" ? (
                      <div className="markdown-content text-white">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-white">{msg.content}</p>
                    )
                  )}

                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="Generated image"
                      className="mt-3 max-w-full rounded-lg"
                    />
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center text-gray-400 space-x-2 p-4 bg-gray-900 bg-opacity-50 rounded-xl mr-auto max-w-[80%] mb-6">
                  <Loader2 className="animate-spin h-6 w-6 text-blue-400" />
                  <p>Thinking...</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="files-preview px-4 md:px-6 pt-2 bg-transparent">
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="relative bg-gray-800 rounded-lg p-1">
                      {file.type.startsWith("image/") ? (
                        <div className="relative">
                          <img
                            src={file.url}
                            alt={file.name}
                            className="h-16 rounded object-cover"
                          />
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute -top-2 -right-2 bg-gray-900 rounded-full p-1 hover:bg-red-600 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center pr-6 pl-2 py-1">
                          <span className="text-xs truncate max-w-xs" title={file.name}>
                            {file.name}
                          </span>
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute -top-2 -right-2 bg-gray-900 rounded-full p-1 hover:bg-red-600 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 md:px-6 py-4 bg-transparent">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    className="px-3 py-2 bg-gray-800 rounded-lg text-sm flex items-center hover:bg-gray-700 transition-colors"
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  >
                    <span>{selectedModel}</span>
                    <ChevronDown size={16} className="ml-2" />
                  </button>

                  {modelDropdownOpen && (
                    <div className="absolute bottom-full mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg w-48 z-10">
                      {models.map((model) => (
                        <button
                          key={model}
                          className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-sm transition-colors"
                          onClick={() => {
                            setSelectedModel(model);
                            setModelDropdownOpen(false);
                          }}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex p-1 bg-gray-800 rounded-lg">
                  <button
                    onClick={() => setMode("text")}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${
                      mode === "text" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Text
                  </button>
                  <button
                    onClick={() => setMode("image")}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${
                      mode === "image" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Image
                  </button>
                </div>

                {mode === "text" && (
                  <button
                    onClick={() => fileInputRef.current.click()}
                    className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Upload size={20} />
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </button>
                )}

                <div
                  className={`flex-1 relative ${dragActive ? "border-2 border-blue-500" : "border border-gray-700"} rounded-lg bg-gray-800 shadow-lg`}
                  onDragEnter={handleDrag}
                >
                  <input
                    id="chat-input"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder={
                      mode === "text"
                        ? "Ask for research help, article generation, etc..."
                        : "Describe the image you want to generate..."
                    }
                    className="w-full p-3 bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                  />
                  {dragActive && (
                    <div
                      className="absolute inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center rounded-lg"
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                    >
                      <p className="text-blue-400">Drop files here</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={loading}
                  className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Send size={20} />
                </button>
              </div>
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

// Custom CSS for markdown content to ensure dark mode compatibility
const markdownStyles = `
  .markdown-content h1 {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 1rem;
    color: #ffffff;
  }
  .markdown-content h2 {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 0.75rem;
    color: #ffffff;
  }
  .markdown-content p {
    margin-bottom: 1rem;
    color: #d1d5db;
  }
  .markdown-content a {
    color: #3b82f6; /* Tailwind blue-500 */
    text-decoration: underline;
  }
  .markdown-content ul {
    list-style-type: disc;
    margin-left: 1.5rem;
    margin-bottom: 1rem;
    color: #d1d5db;
  }
  .markdown-content li {
    margin-bottom: 0.5rem;
    color: #d1d5db;
  }
`;

// Inject styles into the document
const styleSheet = document.createElement("style");
styleSheet.textContent = markdownStyles;
document.head.appendChild(styleSheet);

export default Chatroom;