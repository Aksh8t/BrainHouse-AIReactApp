import { useState, useEffect, useRef } from "react";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { Upload, X, ChevronDown, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { GlowingEffect } from "../components/design/glowing-effect";
import { PlaceholdersAndVanishInput } from "../components/design/placeholders-and-vanish-input";

const Chatroom = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("text");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("Gemini");
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const models = ["Gemini", "ChatGPT", "Mistral", "Claude", "Llama4"];
  const chatPlaceholders = [
    "Ask for research help...",
    "Generate an article about...",
    "Summarize this paper...",
    "What are some ideas for experiments on...",
    "Help me brainstorm research topics related to...",
    "Can you explain quantum entanglement?",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const styleId = "markdown-styles";
    const markdownStyles = `
      .markdown-content { line-height: 1.6; }
      .markdown-content h1 { font-size: 1.6em; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.8em; border-bottom: 1px solid #4b5563; padding-bottom: 0.3em; color: #ffffff; }
      .markdown-content h2 { font-size: 1.4em; font-weight: 600; margin-top: 1.4em; margin-bottom: 0.7em; border-bottom: 1px solid #4b5563; padding-bottom: 0.3em; color: #ffffff; }
      .markdown-content h3 { font-size: 1.2em; font-weight: 600; margin-top: 1.2em; margin-bottom: 0.6em; color: #ffffff; }
      .markdown-content p { margin-bottom: 1em; color: #d1d5db; }
      .markdown-content a { color: #60a5fa; text-decoration: none; }
      .markdown-content a:hover { text-decoration: underline; }
      .markdown-content ul, .markdown-content ol { margin-left: 1.8rem; margin-bottom: 1em; color: #d1d5db; }
      .markdown-content li { margin-bottom: 0.5em; }
      .markdown-content li > p { margin-bottom: 0.3em; }
      .markdown-content code { background-color: #374151; color: #e5e7eb; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; font-family: monospace; }
      .markdown-content pre { background-color: #1f2937; color: #d1d5db; padding: 1em; border-radius: 5px; overflow-x: auto; margin-bottom: 1em; font-size: 0.9em; font-family: monospace; }
      .markdown-content pre code { background-color: transparent; padding: 0; border-radius: 0; }
      .markdown-content blockquote { border-left: 4px solid #4b5563; padding-left: 1em; margin-left: 0; margin-bottom: 1em; color: #9ca3af; font-style: italic; }
      .markdown-content table { border-collapse: collapse; width: auto; margin-bottom: 1em; color: #d1d5db; }
      .markdown-content th, .markdown-content td { border: 1px solid #4b5563; padding: 0.5em 0.8em; }
      .markdown-content th { background-color: #374151; font-weight: 600; text-align: left; }
      .markdown-content hr { border: none; border-top: 1px solid #4b5563; margin-top: 1.5em; margin-bottom: 1.5em; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
    `;
    if (!document.getElementById(styleId)) {
      const styleSheet = document.createElement("style");
      styleSheet.id = styleId;
      styleSheet.textContent = markdownStyles;
      document.head.appendChild(styleSheet);
    }
    return () => {
      const e = document.getElementById(styleId);
      if (e) e.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      uploadedFiles.forEach((f) => {
        if (f.url) URL.revokeObjectURL(f.url);
      });
    };
  }, [uploadedFiles]);

  const handleSendMessage = async () => {
    const currentInput = input.trim();
    if (!currentInput && uploadedFiles.length === 0) return;

    const userMessage = {
      role: "user",
      content: currentInput,
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentMessageHistory = [...messages, userMessage];

    setInput("");
    setUploadedFiles([]);
    setLoading(true);

    try {
      const baseURL =  "https://localhost/5000/api/";
      if (!baseURL) {
        throw new Error("API base URL not configured.");
      }

      let endpoint = baseURL;
      let body = {};

      if (mode === "text") {
        endpoint += "text";
        body = {
          messages: currentMessageHistory,
          model: selectedModel.toLowerCase(),
        };
      } else if (mode === "image") {
        endpoint += "image";
        body = { prompt: currentInput };
      } else {
        throw new Error("Invalid mode selected");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error(`${mode} failed: ${response.statusText}`);
        }
        throw new Error(
          errorData.error ||
            errorData.message ||
            `${mode} failed: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (mode === "text") {
        setMessages((prev) => [
          ...prev,
          { role: "model", content: data.content },
        ]);
      } else if (mode === "image") {
        setMessages((prev) => [
          ...prev,
          { role: "model", content: "Generated image:", image: data.image },
        ]);
      }
    } catch (error) {
      console.error("API Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "model", content: `Error: ${error.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleInputSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "text") return;
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "text") return;
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
      e.target.value = null;
    }
  };

  const handleFiles = (files) => {
    if (mode !== "text") return;

    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length !== files.length) {
      console.warn("Non-image files were selected and ignored.");
    }

    const filePromises = imageFiles.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            resolve({
              name: file.name,
              type: file.type,
              size: file.size,
              data: reader.result,
              url: URL.createObjectURL(file),
            });
          reader.onerror = (err) => {
            console.error("FileReader error:", err);
            reject(err);
          };
          reader.readAsDataURL(file);
        })
    );

    Promise.all(filePromises)
      .then((newFiles) => setUploadedFiles((prev) => [...prev, ...newFiles]))
      .catch((err) => console.error("Error processing files:", err));
  };

  const removeFile = (index) => {
    const file = uploadedFiles[index];
    if (file?.url) URL.revokeObjectURL(file.url);
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <SignedIn>
        <div className="flex flex-col h-screen bg-black text-white relative">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <svg
              className="w-full h-full opacity-15"
              width="100%"
              height="100%"
            >
              <pattern
                id="dotPattern"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#dotPattern)" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="text-center py-6 md:py-10 flex-shrink-0">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent drop-shadow-sm">
                BrainHouse
              </h1>
              <p className="mt-3 text-base md:text-lg text-gray-400 italic">
                The{" "}
                <span className="text-xl md:text-2xl font-semibold text-gray-300 not-italic">
                  ∞
                </span>{" "}
                Research Den
              </p>
            </div>

            <div
              className="flex-1 px-4 md:px-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent pb-32"
              style={{ overscrollBehavior: "contain" }}
            >
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <div className="w-16 h-16 mb-4 border-4 border-gray-600 rounded-full flex items-center justify-center shadow-md">
                    <Send size={24} className="text-gray-600" />
                  </div>
                  <p>Start a conversation with BrainHouse</p>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={`${msg.role}-${index}-${Date.now()}`}
                  className="relative mb-6 animate-fade-in"
                >
                  <GlowingEffect
                    spread={msg.role === "user" ? 20 : 15}
                    proximity={msg.role === "user" ? 40 : 30}
                  />
                  <div
                    className={`relative p-4 rounded-xl overflow-hidden ${
                      msg.role === "user"
                        ? "bg-gray-800 ml-auto max-w-[80%]"
                        : "bg-gray-900 border border-gray-700 mr-auto max-w-[80%]"
                    }`}
                  >
                    {msg.role === "user" && msg.files?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.files.map((file, fileIndex) => (
                          <div key={fileIndex} className="relative">
                            <img
                              src={file.url}
                              alt={file.name}
                              className="h-20 w-20 rounded-lg object-cover border border-gray-600"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.content &&
                      (msg.role === "model" ? (
                        <div className="markdown-content text-white">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-white whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      ))}
                    {msg.role === "model" && msg.image && (
                      <img
                        src={msg.image}
                        alt="Generated"
                        className="mt-3 max-w-sm w-full rounded-lg border border-gray-700"
                      />
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="relative mb-6 mr-auto max-w-[80%]">
                  <GlowingEffect spread={15} proximity={30} />
                  <div className="relative flex items-center text-gray-400 space-x-2 p-4 bg-gray-900 bg-opacity-70 border border-gray-700 rounded-xl overflow-hidden">
                    <Loader2 className="animate-spin h-6 w-6 text-blue-400" />
                    <p>Thinking...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex-shrink-0 px-4 md:px-6 pb-4 pt-2 bg-gradient-to-t from-black via-black to-transparent z-20">
              <div className="relative max-w-4xl mx-auto">
                <GlowingEffect spread={30} proximity={50} />
                <div
                  className={`relative bg-gray-800 rounded-xl shadow-xl p-3 md:p-4 border border-gray-700 overflow-hidden`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  {uploadedFiles.length > 0 && (
                    <div className="files-preview pb-3 border-b border-gray-700 mb-3">
                      <div className="flex flex-wrap gap-2">
                        {uploadedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="relative bg-gray-900 rounded-lg p-1 border border-gray-700"
                          >
                            <img
                              src={file.url}
                              alt={file.name}
                              className="h-16 w-16 rounded object-cover"
                            />
                            <button
                              onClick={() => removeFile(index)}
                              className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors z-10"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex items-center gap-2 md:gap-3 w-full ${
                      dragActive && mode === "text"
                        ? "outline outline-dashed outline-blue-500 outline-offset-4 rounded-lg"
                        : ""
                    }`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                  >
                    <div className="relative flex-shrink-0">
                      <button
                        className="px-3 py-2 bg-gray-900 rounded-lg text-sm flex items-center hover:bg-gray-700 transition-colors"
                        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                      >
                        <span>{selectedModel}</span>
                        <ChevronDown size={16} className="ml-2" />
                      </button>
                      {modelDropdownOpen && (
                        <div className="absolute bottom-full mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg w-48 z-30">
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
                    <div className="flex p-1 bg-gray-900 rounded-lg flex-shrink-0">
                      <button
                        onClick={() => setMode("text")}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${
                          mode === "text"
                            ? "bg-blue-600 text-white"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Text
                      </button>
                      <button
                        onClick={() => setMode("image")}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${
                          mode === "image"
                            ? "bg-blue-600 text-white"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        Image
                      </button>
                    </div>
                    {mode === "text" && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                        aria-label="Upload image"
                      >
                        <Upload size={20} />
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileInput}
                        />
                      </button>
                    )}
                    <div className="flex-1 relative">
                      <PlaceholdersAndVanishInput
                        placeholders={chatPlaceholders}
                        onChange={handleInputChange}
                        onSubmit={handleInputSubmit}
                        value={input}
                      />
                      {dragActive && mode === "text" && (
                        <div className="absolute inset-0 bg-gray-800 bg-opacity-80 flex items-center justify-center rounded-lg pointer-events-none">
                          <p className="text-blue-400 font-semibold">
                            Drop image files here
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={
                        loading || (!input.trim() && uploadedFiles.length === 0)
                      }
                      className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                      aria-label="Send message"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
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

export default Chatroom;
