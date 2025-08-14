import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MoreHorizontal, ArrowLeft } from "lucide-react";
import { useParams } from "react-router-dom";

export default function DualSideFileTransfer() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [expiryDays, setExpiryDays] = useState(3);
  const [showExpiryOptions, setShowExpiryOptions] = useState(false);
  const [showBackSide, setShowBackSide] = useState(false);
  const [generatedToken, setGeneratedToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { id: fileId } = useParams();

  const navigate = useNavigate();
  const apiBase =
    window.location.hostname === "localhost" ? "http://localhost:5000" : "https://media-access.onrender.com";

  // In your token generation form
  const handleGenerateToken = async () => {
    try {
      setLoading(true);
      setError(null);

      // First check if token exists for this file
      const checkResponse = await fetch(
        `${apiBase}/api/token-for-file/${fileId}`
      );
      if (checkResponse.ok) {
        const existingToken = await checkResponse.json();
        setGeneratedToken(existingToken.token);
        setShowBackSide(true);
        return;
      }

      // Generate new token if none exists
      const response = await fetch(`${apiBase}/api/generate-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          fileId: fileId, 
        }),
      });

      const data = await response.json();
      setGeneratedToken(data.token);
      setShowBackSide(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startNewTransfer = () => {
    setName("");
    setEmail("");
    setMessage("");
    setExpiryDays(3);
    setGeneratedToken("");
    setShowBackSide(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div
        className={`bg-white rounded-none shadow-lg w-full max-w-sm overflow-hidden transition-all duration-300 ${
          showBackSide ? "rotate-y-180" : ""
        }`}
      >
        {!showBackSide ? (
          <div className="front-side">
            <div className="bg-black text-white text-center py-3 font-semibold text-lg">
              Generate Download Token
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="w-full border-b border-gray-300 px-1 py-2 text-sm focus:outline-none"
                required
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your Email"
                className="w-full border-b border-gray-300 px-1 py-2 text-sm focus:outline-none"
                required
              />

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Purpose of download (optional)"
                className="w-full border-b border-gray-300 px-1 py-2 text-sm focus:outline-none"
                rows="2"
              />

              <div className="relative">
                <div
                  className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm cursor-pointer"
                  onClick={() => setShowExpiryOptions(!showExpiryOptions)}
                >
                  <div className="flex items-center gap-1 text-blue-600">
                    <Calendar className="h-4 w-4" />
                    {expiryDays} day{expiryDays !== 1 ? "s" : ""}
                  </div>
                  <MoreHorizontal className="h-4 w-4 text-gray-500" />
                </div>

                {showExpiryOptions && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg py-1">
                    {[1, 3, 7, 14, 30].map((days) => (
                      <div
                        key={days}
                        className={`px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer ${
                          expiryDays === days ? "bg-blue-50 text-blue-600" : ""
                        }`}
                        onClick={() => {
                          setExpiryDays(days);
                          setShowExpiryOptions(false);
                        }}
                      >
                        {days} day{days !== 1 ? "s" : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerateToken}
                disabled={loading || !name || !email}
                className={`w-full rounded-full py-2 text-sm font-medium transition-colors ${
                  name && email
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                {loading ? "Generating..." : "Generate Token"}
              </button>
            </div>
          </div>
        ) : (
          <div className="back-side">
            <div className="bg-white p-4">
              <div className="flex justify-between items-center">
                <button
                  onClick={startNewTransfer}
                  className="flex items-center gap-1 text-black hover:bg-gray-200 p-1 rounded"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="text-center">
                  <div className="font-semibold text-lg">Token Generated</div>
                  <div className="text-sm opacity-90">
                    Your download token is ready
                  </div>
                </div>
                <div className="w-5"></div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="text-xl font-bold mb-1">
                  Your Download Token
                </div>
                <p className="text-gray-600 mb-4">
                  {message || "No specific purpose provided"}
                </p>

                <div className="bg-gray-100 rounded-lg p-4 mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Name</span>
                    <span className="font-medium">{name}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Email</span>
                    <span className="font-medium">{email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Expires in</span>
                    <span className="font-medium">
                      {expiryDays} day{expiryDays !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div className="bg-gray-100 p-2 rounded text-sm font-mono break-all mb-2 text-center">
                  {generatedToken}
                </div>
                <button
                  className="w-full bg-black text-white rounded py-2 text-sm font-medium hover:bg-gray-800"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedToken);
                    alert("Token copied to clipboard!");
                  }}
                >
                  Copy Token
                </button>
              </div>

              <button
                className="w-full bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700"
                onClick={() => navigate("/")}
              >
                Back to Gallery
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
