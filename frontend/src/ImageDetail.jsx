import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function ImageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const apiBase =
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://media-access.onrender.com";
  const watermarkedUrl = `${apiBase}/api/file/${id}/watermark`;
  const cleanUrl = `${apiBase}/api/download/${id}`;

  const handleVerifyToken = async () => {
    try {
      setLoading(true);
      setError(null);

      // Local decode without secret key
      const decoded = jwtDecode(token);
      if (!decoded) throw new Error("Invalid token format");
      if (new Date(decoded.exp * 1000) < new Date()) {
        throw new Error("Token has expired");
      }

      // Server verification
      const response = await fetch(
        `${cleanUrl}?token=${encodeURIComponent(token)}`,
        {
          method: "HEAD", // Just check headers, don't download content
        }
      );

      if (!response.ok) {
        throw new Error("Token verification failed");
      }

      setIsVerified(true);
    } catch (err) {
      setError(err.message);
      setIsVerified(false);
    } finally {
      setLoading(false);
    }
  };

const handleDownload = (withWatermark = false) => {
  try {
    setLoading(true);
    setError(null);

    const downloadUrl = withWatermark
      ? `${watermarkedUrl}?token=${encodeURIComponent(token)}`
      : `${cleanUrl}?token=${encodeURIComponent(token)}`;

    // ✅ Create a temporary <a> element
    const link = document.createElement("a");
    link.href = downloadUrl;

    // Let the browser decide the filename or you can force one:
    // link.download = "myfile.mp4"; // optional
    link.target = "_blank"; // ensures some browsers respect download

    // Append, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setLoading(false);
  } catch (err) {
    setError(err.message);
    setLoading(false);
  }
};


  useEffect(() => {
    const fetchFileInfo = async () => {
      try {
        const response = await fetch(`${apiBase}/api/file-info/${id}`);
        const data = await response.json();
        setFileInfo(data);
      } catch (err) {
        setError("Failed to load file information");
        console.error(err);
      }
    };

    fetchFileInfo();
  }, [id, apiBase]);

  return (
    <div className="min-h-screen bg-black">
      <main className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-none overflow-hidden mt-[12px]">
        {/* File Preview Section */}
        <div className="relative">
          {fileInfo?.mimeType?.startsWith("video/") ? (
            <video
              src={watermarkedUrl}
              controls
              className="w-full max-h-[50vh] object-cover"
            />
          ) : (
            <img
              src={watermarkedUrl}
              alt={fileInfo?.name}
              className="w-full max-h-[50vh] object-cover"
            />
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
            <p className="text-white text-xs font-medium">
              {fileInfo?.name || `FILE ID: ${id}`}
            </p>
          </div>
        </div>

        {/* Download Options Section */}
        <div className="p-4 border-t border-gray-200">
          <h2 className="text-lg font-light mb-3">DOWNLOAD OPTIONS</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Watermarked Download */}
            <div className="border border-gray-200 p-3 hover:bg-gray-50 transition cursor-pointer">
              <h3 className="font-medium text-sm mb-1">WATERMARKED</h3>
              <p className="text-xs text-gray-600 mb-2">
                Preview with watermark
              </p>
              <a
                href={`${watermarkedUrl}?token=${encodeURIComponent(token)}`} // dynamic URL
                download // browser decides filename, ya server se filename aaye
                className={`w-full py-1.5 bg-black text-white text-xs font-medium rounded-none hover:bg-gray-800 transition-colors uppercase tracking-wider inline-block text-center ${
                  loading
                    ? "opacity-50 pointer-events-none cursor-not-allowed"
                    : ""
                }`}
              >
                {loading ? "Downloading..." : "DOWNLOAD"}
              </a>
            </div>

            {/* Generate Token */}
            <div className="border border-gray-200 p-3 hover:bg-gray-50 transition cursor-pointer">
              <h3 className="font-medium text-sm mb-1">GENERATE TOKEN</h3>
              <p className="text-xs text-gray-600 mb-2">
                Get access to original files
              </p>
              <Link to={`/generate-token/${id}`}>
                <button className="w-full py-1.5 bg-black text-white text-xs font-medium rounded-none hover:bg-gray-800 transition-colors uppercase tracking-wider">
                  GET TOKEN
                </button>
              </Link>
            </div>

            {/* Clean Download */}
            <div className="border border-gray-200 p-3 hover:bg-gray-50 transition cursor-pointer">
              <h3 className="font-medium text-sm mb-1">ORIGINAL QUALITY</h3>
              <p className="text-xs text-gray-600 mb-2">Full quality version</p>
              <button
                onClick={() => handleDownload(false)}
                disabled={loading || !isVerified}
                className={`w-full py-1.5 text-xs font-medium rounded-none uppercase tracking-wider ${
                  isVerified
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                } ${loading ? "opacity-50" : ""}`}
              >
                {loading
                  ? "PREPARING..."
                  : isVerified
                  ? "DOWNLOAD CLEAN"
                  : "VERIFY TOKEN FIRST"}
              </button>
            </div>
          </div>

          {/* Token Verification Section */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-medium text-sm mb-2">VERIFY YOUR TOKEN</h3>
            {error && <div className="text-red-500 text-xs mb-2">{error}</div>}
            {isVerified && (
              <div className="text-green-500 text-xs mb-2">
                Token verified! You can now download the original files.
              </div>
            )}
            <div className="flex flex-col md:flex-row gap-2">
              <input
                type="text"
                placeholder="Paste your access token here"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="flex-1 border border-gray-300 p-2 text-xs focus:outline-none focus:border-black"
                disabled={isVerified || loading}
              />
              <button
                onClick={handleVerifyToken}
                disabled={loading || isVerified}
                className={`py-2 px-4 text-xs font-medium rounded-none uppercase tracking-wider whitespace-nowrap ${
                  loading
                    ? "bg-gray-300 text-gray-500"
                    : isVerified
                    ? "bg-green-500 text-white"
                    : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                {loading ? "VERIFYING..." : isVerified ? "VERIFIED" : "VERIFY"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
